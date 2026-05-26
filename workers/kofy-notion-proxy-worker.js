/* =============================================================================
 * kofy-notion-proxy · Cloudflare Worker · v2 (drop-in replacement)
 * -----------------------------------------------------------------------------
 * Replaces the existing worker source entirely. Keeps the original Notion-
 * proxy routes (/query, /pages, /pages/:id, /database/:id) and adds /notify
 * for the comms module.
 *
 * Routes
 *   POST    /query            Proxies to Notion databases/:id/query
 *   POST    /pages            Proxies to Notion pages (create)
 *   PATCH   /pages/:id        Proxies to Notion pages/:id (update / archive)
 *   PATCH   /database/:id     Proxies to Notion databases/:id (schema patch)
 *   POST    /notify           Sends email/WhatsApp/SMS + logs to Notificaciones
 *   GET     /  or  /health    Returns {ok:true, version:'2.0.0'}
 *   OPTIONS *                 CORS preflight
 *
 * Env vars (set in Cloudflare → Workers → Settings → Variables)
 *   NOTION_KEY              [secret]   existing Notion integration token
 *   SENDGRID_API_KEY        [secret]   from sendgrid.com → Settings → API Keys
 *   FROM_EMAIL              [plain]    "admin@kofy.io" (Single Sender verified)
 *   FROM_NAME               [plain]    optional, e.g. "Kofy"
 *   TWILIO_ACCOUNT_SID      [secret]   from twilio.com → Account info
 *   TWILIO_AUTH_TOKEN       [secret]   same place
 *   TWILIO_WA_FROM          [plain]    "whatsapp:+14155238886" for sandbox
 *   TWILIO_SMS_FROM         [plain]    optional, only if SMS used
 *   NOTIFICACIONES_DB_ID    [plain]    optional until Migration B runs
 *
 * Smoke test from terminal once deployed:
 *   curl -X POST https://<worker-url>/notify \
 *     -H 'Content-Type: application/json' \
 *     -d '{"channel":"email","to":"you@example.com","template":"order_ready_customer",
 *          "data":{"orderId":"TEST-1","clientName":"Test"},
 *          "meta":{"trigger":"manual_test"}}'
 * ============================================================================= */

const NOTION_API     = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400'
};

function json(body, init = {}) {
  const data = (typeof body === 'string') ? body : JSON.stringify(body);
  return new Response(data, {
    status: init.status || 200,
    headers: { ...CORS, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
}

async function notionFetch(path, init, env) {
  return fetch(NOTION_API + path, {
    ...init,
    headers: {
      'Authorization':  'Bearer ' + env.NOTION_KEY,
      'Notion-Version': NOTION_VERSION,
      'Content-Type':   'application/json',
      ...(init.headers || {})
    }
  });
}

// ============================================================================
// Main router
// ============================================================================
export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight (all routes)
    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      // -------- POST /query --------
      if (path === '/query' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (!body.database_id) return json({ error: 'database_id required' }, { status: 400 });
        const { database_id, filter, sorts, page_size, start_cursor } = body;
        const notionBody = {};
        if (filter)        notionBody.filter        = filter;
        if (sorts)         notionBody.sorts         = sorts;
        if (page_size)     notionBody.page_size     = page_size;
        if (start_cursor)  notionBody.start_cursor  = start_cursor;
        const r = await notionFetch('/databases/' + database_id + '/query', {
          method: 'POST',
          body: JSON.stringify(notionBody)
        }, env);
        const j = await r.json().catch(() => ({}));
        return json(j, { status: r.status });
      }

      // -------- POST /pages --------
      if (path === '/pages' && method === 'POST') {
        const body = await request.text();
        const r = await notionFetch('/pages', { method: 'POST', body }, env);
        const j = await r.json().catch(() => ({}));
        return json(j, { status: r.status });
      }

      // -------- PATCH /pages/:id --------
      if (path.startsWith('/pages/') && method === 'PATCH') {
        const id = path.slice('/pages/'.length);
        if (!id) return json({ error: 'page id required' }, { status: 400 });
        const body = await request.text();
        const r = await notionFetch('/pages/' + id, { method: 'PATCH', body }, env);
        const j = await r.json().catch(() => ({}));
        return json(j, { status: r.status });
      }

      // -------- PATCH /database/:id (singular by convention) --------
      if (path.startsWith('/database/') && method === 'PATCH') {
        const id = path.slice('/database/'.length);
        if (!id) return json({ error: 'database id required' }, { status: 400 });
        const body = await request.text();
        const r = await notionFetch('/databases/' + id, { method: 'PATCH', body }, env);
        const j = await r.json().catch(() => ({}));
        return json(j, { status: r.status });
      }

      // -------- POST /notify --------
      if (path === '/notify' && method === 'POST') {
        return handleNotify(request, env, ctx);
      }

      // -------- Health --------
      if (path === '/' || path === '/health') {
        return json({ ok: true, worker: 'kofy-notion-proxy', version: '2.0.0' });
      }

      return json({ error: 'not found', path, method }, { status: 404 });

    } catch (e) {
      return json({ error: 'worker exception', message: e.message, stack: e.stack }, { status: 500 });
    }
  }
};

// ============================================================================
// /notify implementation
// ============================================================================
const TEMPLATES = {
  order_created_leo: {
    body: 'Nueva orden {orderId} de {clientName}. Pedido: {itemsSummary}. ETA {eta}. A tostar.'
  },
  order_cv_leo: {
    body: 'Verde apartado para {orderId}. Listo para tostar.'
  },
  order_ready_customer: {
    subject: 'Tu pedido {orderId} está listo',
    body:    'Hola {clientName},\n\nTu pedido ya está empacado y listo. Acordemos la entrega cuando te quede bien.\n\nGracias por la conexión.\n— Kofy'
  },
  order_delivered: {
    subject: 'Gracias · {orderId}',
    body:    'Hola {clientName},\n\nQuedó entregado. ¿Cómo te fue con el café? Cualquier nota nos sirve.\n\n— Kofy'
  },
  order_cancelled_customer: {
    subject: 'Tu pedido {orderId} fue cancelado',
    body:    'Hola {clientName},\n\nTu pedido {orderId} fue cancelado: {razon}.\nSi querés que lo retomemos, respondemos por acá.\n\n— Kofy'
  },
  stock_low_origen:  { body: '{origenName} bajo: {kgRemanente} kg. Hora de reponer.' },
  stock_low_empaque: { body: 'Empaque {bind} bajo: {stock} bolsas quedan.' },
  b2b_cadence:       { body: '{clientName} no ha ordenado en {dias} días. ¿Confirmamos?' },
  archived_audit:    { body: 'Orden {orderId} archivada por {persona}.' }
};

function render(tpl, data) {
  if (!tpl) return '';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (data && data[k] != null) ? String(data[k]) : '');
}

async function handleNotify(request, env, ctx) {
  let payload;
  try { payload = await request.json(); }
  catch { return json({ status: 'failed', error: 'bad json' }, { status: 400 }); }

  const { channel, to, template, data = {}, meta = {} } = payload;
  const tpl     = TEMPLATES[template] || { body: data.body || '' };
  const body    = render(tpl.body, data);
  const subject = render(tpl.subject || '', data);

  let status = 'pending', providerResp = null, errMsg = null;

  // Loader-marked skipped (no recipient on file) — log only, no provider call.
  if (meta.status === 'skipped') {
    status = 'skipped';
    providerResp = { skipReason: meta.skipReason || 'no recipient' };

  // Audit-only entries (e.g. archived_audit) — no provider call.
  } else if (meta.status === 'sent' && to === '(internal)') {
    status = 'sent';
    providerResp = { audit: true };

  } else {
    try {
      // -------- EMAIL · SendGrid --------
      if (channel === 'email') {
        if (!env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not set');
        const fromEmail = env.FROM_EMAIL || 'admin@kofy.io';
        const fromName  = env.FROM_NAME  || 'Kofy';
        const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method:  'POST',
          headers: {
            'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from:    { email: fromEmail, name: fromName },
            subject: subject || '(sin asunto)',
            content: [{ type: 'text/plain', value: body }]
          })
        });
        // SendGrid returns 202 Accepted with empty body on success.
        if (r.ok || r.status === 202) {
          status = 'sent';
          providerResp = { sendgrid: r.status + ' accepted', from: fromEmail, to };
        } else {
          status = 'failed';
          providerResp = await r.json().catch(() => ({}));
          errMsg = (providerResp?.errors?.[0]?.message) || ('sendgrid ' + r.status);
        }

      // -------- WHATSAPP / SMS · Twilio --------
      } else if (channel === 'whatsapp' || channel === 'sms') {
        if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
          throw new Error('TWILIO credentials not set');
        }
        const from = channel === 'whatsapp' ? env.TWILIO_WA_FROM : env.TWILIO_SMS_FROM;
        if (!from) throw new Error((channel === 'whatsapp' ? 'TWILIO_WA_FROM' : 'TWILIO_SMS_FROM') + ' not set');

        const cleanTo = String(to).replace(/^whatsapp:/, '');
        const dest = channel === 'whatsapp' ? ('whatsapp:' + cleanTo) : cleanTo;

        const form = new URLSearchParams({ From: from, To: dest, Body: body });
        const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
        const r = await fetch(
          'https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json',
          {
            method:  'POST',
            headers: {
              'Authorization': 'Basic ' + auth,
              'Content-Type':  'application/x-www-form-urlencoded'
            },
            body: form
          }
        );
        providerResp = await r.json().catch(() => ({}));
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

  // -------- Log to Notion Notificaciones DB --------
  const notifId =
    'NOTIF-' +
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  if (env.NOTIFICACIONES_DB_ID) {
    const props = {
      'Notification ID':   { title:     [{ text: { content: notifId } }] },
      'Trigger':           { select:    { name: meta.trigger || 'Otro' } },
      'Channel':           { select:    { name: channel || 'email' } },
      'Recipient name':    { rich_text: [{ text: { content: meta.recipientName || '' } }] },
      'Recipient address': { rich_text: [{ text: { content: String(to) } }] },
      'Body sent':         { rich_text: [{ text: { content: body.slice(0, 1900) } }] },
      'Status':            { select:    { name: status } },
      'Provider response': { rich_text: [{ text: { content: JSON.stringify(providerResp || {}).slice(0, 1900) } }] },
      'Fecha':             { date:      { start: new Date().toISOString() } }
    };
    const idLike = /^[a-f0-9-]{32,}$/i;
    if (meta.relatedOrden   && idLike.test(meta.relatedOrden))   props['Related Orden']   = { relation: [{ id: meta.relatedOrden   }] };
    if (meta.relatedMiembro && idLike.test(meta.relatedMiembro)) props['Related Miembro'] = { relation: [{ id: meta.relatedMiembro }] };
    if (meta.relatedCliente && idLike.test(meta.relatedCliente)) props['Related Cliente'] = { relation: [{ id: meta.relatedCliente }] };
    if (meta.triggeredBy    && idLike.test(meta.triggeredBy))    props['Triggered by']    = { relation: [{ id: meta.triggeredBy    }] };

    // Fire-and-forget so a Notion outage doesn't block the notify response.
    // ctx.waitUntil keeps the worker alive until the log write completes.
    const logPromise = fetch(NOTION_API + '/pages', {
      method:  'POST',
      headers: {
        'A