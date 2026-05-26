# Cloudflare Worker patch · `/notify` route

This patch extends the existing `kofy-notion-proxy` Worker with one new route that proxies notifications to Resend (email) and Twilio (WhatsApp + SMS), and logs every send to the **Notificaciones** DB in Notion.

Nothing about the existing routes (`/query`, `/pages`, `/pages/:id`, `/database/:id`) changes. This is additive.

---

## 1 · Provider accounts to create first

Before deploying, Kafay sets up:

1. **Resend** — sign up at resend.com, verify a domain on `kofy.io` (or use `onboarding@resend.dev` for testing). Grab the API key.
2. **Twilio** — sign up at twilio.com, buy a number for SMS (or use the trial), and request WhatsApp sender approval (sandbox is fine for v1 — Kafay's phone joins the sandbox by texting the join code to the Twilio number).
3. **Notion** — note the page id of the new **Notificaciones** DB created by `warehouse-setup.html`.

---

## 2 · Worker env vars to add

In the Cloudflare dashboard → Workers & Pages → `kofy-notion-proxy` → Settings → Variables:

| Name | Example | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` | From resend.com dashboard |
| `FROM_EMAIL` | `hola@kofy.io` | Verified sender on the Resend domain |
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx` | From twilio.com console |
| `TWILIO_AUTH_TOKEN` | `xxxxxxxx` | Treat as secret |
| `TWILIO_WA_FROM` | `whatsapp:+14155238886` | Twilio sandbox or your approved number, prefixed `whatsapp:` |
| `TWILIO_SMS_FROM` | `+14155551212` | Twilio number for SMS |
| `NOTIFICACIONES_DB_ID` | `abc123...` | From `warehouse-setup.html` after migration |

Set them as **Secret** (not plaintext) for credentials.

---

## 3 · Worker code to paste

Open the worker source. Locate the request router (likely a `switch (url.pathname)` or `if (url.pathname === '/query')`). Add a new branch:

```js
// ============================================================
// /notify  —  dispatch email | whatsapp | sms via Resend/Twilio
// ============================================================
if (url.pathname === '/notify' && request.method === 'POST') {
  return handleNotify(request, env);
}
```

Then add this `handleNotify` function alongside the existing helpers:

```js
// ---- Notification templates (server-side copy) ----
// Keep in sync with TEMPLATES in warehouse-comms.html.
const TEMPLATES = {
  order_created_leo: {
    body: 'Nueva orden {orderId} de {clientName}. Pedido: {itemsSummary}. ETA {eta}. A tostar.'
  },
  order_cv_leo: {
    body: 'Verde apartado para {orderId}. Listo para tostar.'
  },
  order_ready_customer: {
    subject: 'Tu pedido {orderId} está listo',
    body: 'Hola {clientName},\n\nTu pedido ya está empacado y listo. Acordemos la entrega cuando te quede bien.\n\nGracias por la conexión.\n— Kofy'
  },
  order_delivered: {
    subject: 'Gracias · {orderId}',
    body: 'Hola {clientName},\n\nQuedó entregado. ¿Cómo te fue con el café? Cualquier nota nos sirve.\n\n— Kofy'
  },
  order_cancelled_customer: {
    subject: 'Tu pedido {orderId} fue cancelado',
    body: 'Hola {clientName},\n\nTu pedido {orderId} fue cancelado: {razon}.\nSi querés que lo retomemos, respondemos por acá.\n\n— Kofy'
  },
  stock_low_origen:  { body: '{origenName} bajo: {kgRemanente} kg. Hora de reponer.' },
  stock_low_empaque: { body: 'Empaque {bind} bajo: {stock} bolsas quedan.' },
  b2b_cadence:       { body: '{clientName} no ha ordenado en {dias} días. ¿Confirmamos?' },
  archived_audit:    { body: 'Orden {orderId} archivada por {persona}.' }
};

function render(tpl, data) {
  if (!tpl) return '';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (data && data[k] != null) ? data[k] : '');
}

async function handleNotify(request, env) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  let payload;
  try { payload = await request.json(); }
  catch { return new Response(JSON.stringify({ status:'failed', error:'bad json' }), { status:400, headers: cors }); }

  const { channel, to, template, data = {}, meta = {} } = payload;
  const tpl = TEMPLATES[template] || { body: data.body || '' };
  const body = render(tpl.body, data);
  const subject = render(tpl.subject || '', data);

  // Default to "pending"; we'll flip after the provider call.
  let status = 'pending', providerResp = null, errMsg = null;

  // If a "status" was preset in meta (e.g. skipped from loader), short-circuit.
  if (meta.status === 'skipped') {
    status = 'skipped';
    providerResp = { skipReason: meta.skipReason || 'no recipient' };
  } else if (meta.status === 'sent' && to === '(internal)') {
    // Audit-only entry (e.g. archived_audit) — no provider call
    status = 'sent';
    providerResp = { audit: true };
  } else {
    try {
      if (channel === 'email') {
        if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
        const r = await fetch('https://api.resend.com/emails', {
          method:'POST',
          headers:{ 'Authorization':'Bearer ' + env.RESEND_API_KEY, 'Content-Type':'application/json' },
          body: JSON.stringify({
            from:    env.FROM_EMAIL,
            to:      [to],
            subject: subject || '(sin asunto)',
            text:    body
          })
        });
        providerResp = await r.json().catch(()=>({}));
        status = r.ok ? 'sent' : 'failed';
        if (!r.ok) errMsg = providerResp?.message || ('resend ' + r.status);

      } else if (channel === 'whatsapp' || channel === 'sms') {
        if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) throw new Error('TWILIO creds not set');
        const from = channel === 'whatsapp' ? env.TWILIO_WA_FROM : env.TWILIO_SMS_FROM;
        const dest = channel === 'whatsapp' ? ('whatsapp:' + to) : to;
        const form = new URLSearchParams({ From: from, To: dest, Body: body });
        const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
        const r = await fetch(
          'https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json',
          { method:'POST', headers:{ 'Authorization':'Basic ' + auth, 'Content-Type':'application/x-www-form-urlencoded' }, body: form }
        );
        providerResp = await r.json().catch(()=>({}));
        status = r.ok ? 'sent' : 'failed';
        if (!r.ok) errMsg = providerResp?.message || ('twilio ' + r.status);

      } else {
        status = 'failed';
        errMsg = 'unknown channel: ' + channel;
      }
    } catch (e) {
      status = 'failed';
      errMsg = e.message;
      providerResp = { exception: e.message };
    }
  }

  // ---- Log to Notion ----
  const notifId = 'NOTIF-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Math.floor(Math.random()*1000)).padStart(3,'0');
  if (env.NOTIFICACIONES_DB_ID) {
    const props = {
      'Notification ID': { title: [{ text: { content: notifId } }] },
      'Trigger':         { select: { name: meta.trigger || 'Otro' } },
      'Channel':         { select: { name: channel } },
      'Recipient name':  { rich_text: [{ text: { content: meta.recipientName || '' } }] },
      'Recipient address': { rich_text: [{ text: { content: String(to) } }] },
      'Body sent':       { rich_text: [{ text: { content: body.slice(0, 1900) } }] },
      'Status':          { select: { name: status } },
      'Provider response': { rich_text: [{ text: { content: JSON.stringify(providerResp || {}).slice(0, 1900) } }] },
      'Fecha':           { date: { start: new Date().toISOString() } }
    };
    if (meta.relatedOrden)   props['Related Orden']   = { relation: [{ id: meta.relatedOrden }] };
    if (meta.relatedMiembro) props['Related Miembro'] = { relation: [{ id: meta.relatedMiembro }] };
    if (meta.relatedCliente) props['Related Cliente'] = { relation: [{ id: meta.relatedCliente }] };
    if (meta.triggeredBy && /^[a-f0-9-]{32,}$/.test(meta.triggeredBy)) {
      props['Triggered by'] = { relation: [{ id: meta.triggeredBy }] };
    }
    // Fire-and-forget the Notion log; do not let a Notion outage block the response.
    fetch('https://api.notion.com/v1/pages', {
      method:'POST',
      headers:{ 'Authorization':'Bearer ' + env.NOTION_KEY, 'Content-Type':'application/json', 'Notion-Version':'2022-06-28' },
      body: JSON.stringify({ parent: { database_id: env.NOTIFICACIONES_DB_ID }, properties: props })
    }).catch(() => {});
  }

  return new Response(JSON.stringify({
    status, notifId, error: errMsg || undefined, providerResp
  }), { status: 200, headers: cors });
}
```

> **Note on the existing `NOTION_KEY` env var.** The worker already has it for the `/query` and `/pages` routes — `handleNotify` reuses it. No new Notion key needed.

---

## 4 · Deploy steps

1. Open the worker source in Cloudflare's editor (or `wrangler` locally).
2. Paste the route branch (§3 first snippet) into the router.
3. Paste the `handleNotify` function and `TEMPLATES`/`render` helpers into the worker scope.
4. Save / `wrangler deploy`.
5. In Cloudflare → Workers → Variables, add the 7 env vars from §2.
6. Smoke test from the terminal:
   ```bash
   curl -X POST https://kofy-notion-proxy.delicate-surf-529c.workers.dev/notify \
     -H 'Content-Type: application/json' \
     -d '{"channel":"email","to":"kafay@kofy.io","template":"order_ready_customer","data":{"orderId":"TEST-1","clientName":"Kafay"},"meta":{"trigger":"manual_test"}}'
   ```
   You should get back `{ "status": "sent", "notifId": "NOTIF-..." }` and an email in Kafay's inbox.

---

## 5 · CORS

The existing worker already sets `Access-Control-Allow-Origin: *` on its responses. The snippet above mirrors that. If your worker uses a stricter CORS policy, copy the same headers `handleNotify` returns.

---

## 6 · Failure modes & what they look like

| Scenario | Response | Notion log status |
|---|---|---|
| Missing API key env var | `{ status:'failed', error:'RESEND_API_KEY not set' }` | `failed` |
| Invalid email address | Resend returns 422 with detail | `failed` |
| WhatsApp recipient outside 24h window | Twilio 400 (need template) — see §9.6 of handoff | `failed` |
| Loader detected missing phone on Miembro | Loader sends `meta.status: 'skipped'` directly | `skipped` |
| Notion log failure | Response still returns OK; log silently missing | (no row written) |

The worker **always returns 200** unless the JSON body is malformed — failures are surfaced in the response payload, not as HTTP errors. This keeps the loader simple (no need to differentiate 4xx vs 5xx from "your recipient doesn't exist").
