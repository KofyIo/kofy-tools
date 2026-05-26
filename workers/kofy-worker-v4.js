// kofy-worker-v4.js
// Adds POST /notify — templates + send via Microsoft Graph (email) or Meta WhatsApp API,
// logs every send to Notificaciones DB.
//
// Replaces v3: swapped Twilio → Meta WhatsApp Cloud API, swapped Resend → Microsoft Graph.
// Email uses same Azure app + KOFY_EMAIL as kofy-ai-worker.js (client_credentials flow).
//
// Required env vars:
//   NOTION_KEY           — Notion integration token (existing)
//   NOTIFICACIONES_DB_ID — Notion DB ID for the Notificaciones DB (existing)
//   MS_CLIENT_ID         — Azure app client ID (same as kofy-ai-worker.js)
//   MS_TENANT_ID         — Azure directory tenant ID (same as kofy-ai-worker.js)
//   MS_CLIENT_SECRET     — Azure app client secret (same as kofy-ai-worker.js)
//   KOFY_EMAIL           — sending mailbox e.g. admin@kofy.io (same as kofy-ai-worker.js)
//   WA_PHONE_ID          — Meta WhatsApp Phone Number ID (pending Meta verification)
//   WA_TOKEN             — Meta WhatsApp permanent access token (pending Meta verification)

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url   = new URL(request.url);
    const path  = url.pathname;
    const token = `Bearer ${env.NOTION_KEY}`;

    // READ: query a database ──────────────────────────────────────────────────
    if (request.method === "POST" && path === "/query") {
      const body = await request.json();
      const res  = await fetch(
        `https://api.notion.com/v1/databases/${body.database_id}/query`,
        { method: "POST", headers: notionHeaders(token), body: JSON.stringify({}) }
      );
      return cors(new Response(await res.text(), {
        status: res.status, headers: { "Content-Type": "application/json" },
      }));
    }

    // CREATE: new page ─────────────────────────────────────────────────────────
    if (request.method === "POST" && path === "/pages") {
      const body = await request.json();
      const res  = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status, headers: { "Content-Type": "application/json" },
      }));
    }

    // UPDATE: patch an existing page ──────────────────────────────────────────
    if (request.method === "PATCH" && path.startsWith("/pages/")) {
      const pageId = path.replace("/pages/", "");
      const body   = await request.json();
      const res    = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status, headers: { "Content-Type": "application/json" },
      }));
    }

    // UPDATE DATABASE SCHEMA ───────────────────────────────────────────────────
    if (request.method === "PATCH" && path.startsWith("/database/")) {
      const dbId = path.replace("/database/", "");
      const body = await request.json();
      const res  = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: "PATCH", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status, headers: { "Content-Type": "application/json" },
      }));
    }

    // NOTIFY: send via Microsoft Graph (email) or Meta WhatsApp Cloud API ──────
    if (request.method === "POST" && path === "/notify") {
      const body = await request.json().catch(() => ({}));
      const { channel, to, template: tplKey, data = {}, meta = {} } = body;

      // Templates (Spanish, conexión-aligned — Kafay writes final copy)
      const TEMPLATES = {
        order_created_leo:        { body: "Nueva orden {orderId} de {clientName}. Pedido: {itemsSummary}. ETA {eta}. A tostar." },
        order_cv_leo:             { body: "Verde apartado para {orderId}. Listo para tostar." },
        order_ready_customer:     { subject: "Tu pedido {orderId} está listo", body: "Hola {clientName},\n\nTu pedido ya está empacado y listo. Acordemos la entrega cuando te quede bien.\n\nGracias por la conexión.\n— Kofy" },
        order_delivered:          { subject: "Gracias · {orderId}", body: "Hola {clientName},\n\nQuedó entregado. ¿Cómo te fue con el café? Cualquier nota nos sirve.\n\n— Kofy" },
        order_cancelled_customer: { subject: "Tu pedido {orderId} fue cancelado", body: "Hola {clientName},\n\nTu pedido {orderId} fue cancelado: {razon}.\nSi querés que lo retomemos, respondemos por acá.\n\n— Kofy" },
        stock_low_origen:         { body: "{origenName} bajo: {kgRemanente} kg. Hora de reponer." },
        stock_low_empaque:        { body: "Empaque {bind} bajo: {stock} bolsas quedan." },
        b2b_cadence:              { body: "{clientName} no ha ordenado en {dias} días. ¿Confirmamos?" },
      };

      const tpl        = TEMPLATES[tplKey] || { body: JSON.stringify(data) };
      const render     = str => str.replace(/\{(\w+)\}/g, (_, k) => data[k] !== undefined ? data[k] : "{" + k + "}");
      const msgBody    = render(tpl.body   || "");
      const msgSubject = tpl.subject ? render(tpl.subject) : "Kofy · Notificación";

      const date    = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const notifId = "NOTIF-" + date + "-" + (100 + Math.floor(Math.random() * 900));

      let sendStatus       = "skipped";
      let providerResponse = "";
      let sendError        = null;

      const missingRecipient = !to || to === "(missing)" || to === "(internal)";

      if (missingRecipient) {
        sendStatus       = meta.status || "skipped";
        providerResponse = meta.skipReason || "no recipient";

      } else if (channel === "email") {
        // Microsoft Graph sendMail — same Azure app as kofy-ai-worker.js
        if (!env.MS_CLIENT_ID || !env.MS_TENANT_ID || !env.MS_CLIENT_SECRET || !env.KOFY_EMAIL) {
          sendStatus       = "skipped";
          providerResponse = "MS_CLIENT_ID / MS_TENANT_ID / MS_CLIENT_SECRET / KOFY_EMAIL not configured";
        } else {
          try {
            const msToken = await getMSToken(env);
            const res = await fetch(
              "https://graph.microsoft.com/v1.0/users/" + env.KOFY_EMAIL + "/sendMail",
              {
                method:  "POST",
                headers: { "Authorization": "Bearer " + msToken, "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: {
                    subject: msgSubject,
                    body:    { contentType: "Text", content: msgBody },
                    toRecipients: [{ emailAddress: { address: to } }],
                  },
                  saveToSentItems: true,
                }),
              }
            );
            // sendMail returns 202 with empty body on success
            providerResponse = res.ok ? "sent via Graph" : ("HTTP " + res.status + " " + (await res.text().catch(() => "")));
            sendStatus = res.ok ? "sent" : "failed";
            if (!res.ok) sendError = "HTTP " + res.status;
          } catch (e) {
            sendStatus = "failed"; sendError = e.message; providerResponse = e.message;
          }
        }

      } else if (channel === "whatsapp") {
        // Direct Meta WhatsApp Cloud API — same pattern as kofy-ai-worker.js
        if (!env.WA_PHONE_ID || !env.WA_TOKEN) {
          sendStatus       = "skipped";
          providerResponse = "WA_PHONE_ID or WA_TOKEN not configured (pending Meta verification)";
        } else {
          try {
            const res = await fetch(
              "https://graph.facebook.com/v19.0/" + env.WA_PHONE_ID + "/messages",
              {
                method:  "POST",
                headers: { Authorization: "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
                body:    JSON.stringify({
                  messaging_product: "whatsapp",
                  to,
                  type: "text",
                  text: { body: msgBody },
                }),
              }
            );
            const j = await res.json().catch(() => ({}));
            providerResponse = JSON.stringify(j).slice(0, 1000);
            sendStatus = res.ok ? "sent" : "failed";
            if (!res.ok) sendError = (j.error?.message) || ("HTTP " + res.status);
          } catch (e) {
            sendStatus = "failed"; sendError = e.message; providerResponse = e.message;
          }
        }

      } else {
        sendStatus       = "skipped";
        providerResponse = "unsupported channel: " + channel;
      }

      // Log to Notificaciones DB regardless of outcome
      if (env.NOTIFICACIONES_DB_ID) {
        const logProps = {
          "Notification ID":   { title:     [{ text: { content: notifId } }] },
          "Trigger":           { select:    { name: (meta.trigger || "Otro").slice(0, 100) } },
          "Channel":           { select:    { name: channel } },
          "Recipient name":    { rich_text: [{ text: { content: (meta.recipientName || "").slice(0, 2000) } }] },
          "Recipient address": { rich_text: [{ text: { content: (to || "").slice(0, 2000) } }] },
          "Body sent":         { rich_text: [{ text: { content: msgBody.slice(0, 2000) } }] },
          "Status":            { select:    { name: sendStatus } },
          "Provider response": { rich_text: [{ text: { content: providerResponse.slice(0, 2000) } }] },
          "Fecha":             { date:      { start: new Date().toISOString() } },
        };
        if (meta.relatedOrden)   logProps["Related Orden"]   = { relation: [{ id: meta.relatedOrden }] };
        if (meta.relatedMiembro) logProps["Related Miembro"] = { relation: [{ id: meta.relatedMiembro }] };
        if (meta.relatedCliente) logProps["Related Cliente"] = { relation: [{ id: meta.relatedCliente }] };
        if (meta.triggeredBy)    logProps["Triggered by"]    = { relation: [{ id: meta.triggeredBy }] };

        await fetch("https://api.notion.com/v1/pages", {
          method:  "POST",
          headers: notionHeaders(token),
          body:    JSON.stringify({ parent: { database_id: env.NOTIFICACIONES_DB_ID }, properties: logProps }),
        }).catch(() => {});
      }

      return cors(new Response(JSON.stringify({
        status: sendStatus,
        notifId,
        ...(sendError ? { error: sendError } : {}),
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }

    return new Response("Not found", { status: 404 });
  },
};

// Microsoft Graph — client credentials token (same flow as kofy-ai-worker.js)
async function getMSToken(env) {
  const res = await fetch(
    "https://login.microsoftonline.com/" + env.MS_TENANT_ID + "/oauth2/v2.0/token",
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     env.MS_CLIENT_ID,
        client_secret: env.MS_CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await res.json();
  return data.access_token;
}

function notionHeaders(token) {
  return {
    "Authorization":  token,
    "Notion-Version": "2022-06-28",
    "Content-Type":   "application/json",
  };
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin",  "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers: h });
}
