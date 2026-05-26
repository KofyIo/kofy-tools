export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url   = new URL(request.url);
    const path  = url.pathname;
    const token = `Bearer ${env.NOTION_KEY}`;

    // READ: query a database
    if (request.method === "POST" && path === "/query") {
      const body = await request.json();
      const res  = await fetch(
        `https://api.notion.com/v1/databases/${body.database_id}/query`,
        { method: "POST", headers: notionHeaders(token), body: JSON.stringify({}) }
      );
      return cors(new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // CREATE: new page
    if (request.method === "POST" && path === "/pages") {
      const body = await request.json();
      const res  = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // UPDATE: patch an existing page
    if (request.method === "PATCH" && path.startsWith("/pages/")) {
      const pageId = path.replace("/pages/", "");
      const body   = await request.json();
      const res    = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // UPDATE DATABASE SCHEMA: add/update properties on a database
    if (request.method === "PATCH" && path.startsWith("/database/")) {
      const dbId = path.replace("/database/", "");
      const body = await request.json();
      const res  = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: "PATCH", headers: notionHeaders(token), body: JSON.stringify(body),
      });
      return cors(new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // NOTIFY: send via Resend (email) or Twilio (WhatsApp/SMS) and log to Notificaciones DB
    if (request.method === "POST" && path === "/notify") {
      const body = await request.json().catch(() => ({}));
      const { channel, to, template: tplKey, data = {}, meta = {} } = body;

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

      const tpl       = TEMPLATES[tplKey] || { body: JSON.stringify(data) };
      const render    = str => str.replace(/\{(\w+)\}/g, (_, k) => data[k] !== undefined ? data[k] : "{" + k + "}");
      const msgBody   = render(tpl.body || "");
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
        if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
          sendStatus = "skipped";
          providerResponse = "RESEND_API_KEY or FROM_EMAIL not configured in worker env vars";
        } else {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject: msgSubject, text: msgBody }),
            });
            const j = await res.json().catch(() => ({}));
            providerResponse = JSON.stringify(j).slice(0, 1000);
            sendStatus = res.ok ? "sent" : "failed";
            if (!res.ok) sendError = j.message || ("HTTP " + res.status);
          } catch (e) {
            sendStatus = "failed";
            sendError = e.message;
            providerResponse = e.message;
          }
        }

      } else if (channel === "whatsapp" || channel === "sms") {
        if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
          sendStatus = "skipped";
          providerResponse = "Twilio credentials not configured in worker env vars";
        } else {
          try {
            const from  = channel === "whatsapp"
              ? (env.TWILIO_WA_FROM || ("whatsapp:" + env.TWILIO_SMS_FROM))
              : env.TWILIO_SMS_FROM;
            const toFmt = channel === "whatsapp" ? "whatsapp:" + to : to;
            const auth  = btoa(env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN);
            const form  = new URLSearchParams({ From: from, To: toFmt, Body: msgBody });
            const res   = await fetch(
              "https://api.twilio.com/2010-04-01/Accounts/" + env.TWILIO_ACCOUNT_SID + "/Messages.json",
              {
                method: "POST",
                headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
                body: form.toString(),
              }
            );
            const j = await res.json().catch(() => ({}));
            providerResponse = JSON.stringify(j).slice(0, 1000);
            sendStatus = res.ok ? "sent" : "failed";
            if (!res.ok) sendError = j.message || ("HTTP " + res.status);
          } catch (e) {
            sendStatus = "failed";
            sendError = e.message;
            providerResponse = e.message;
          }
        }
      }

      // Log to Notificaciones DB regardless of send outcome
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
          method: "POST",
          headers: notionHeaders(token),
          body: JSON.stringify({ parent: { database_id: env.NOTIFICACIONES_DB_ID }, properties: logProps }),
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
