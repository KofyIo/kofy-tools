/* ============================================================================
 * kofy-comms-loader.js · v1
 * ----------------------------------------------------------------------------
 * Lightweight event-bus loader. Drop one <script src="kofy-comms-loader.js">
 * line at the bottom of each warehouse-*.html and the comms module starts
 * listening for kofy:* CustomEvents and dispatching notifications.
 *
 * Decoupled by design: this file knows about the warehouse via events only.
 * Existing apps know nothing about this file. Remove the <script> tag and
 * the warehouse keeps working unchanged.
 *
 * Settings live in localStorage under "kofy_comms_settings_v1" and are
 * managed from warehouse-comms.html. DB IDs are read from either:
 *   - window.KOFY_DB_IDS  (set inline by warehouse-setup.html), OR
 *   - localStorage "kofy_comms_setup_v1" (written by setup runner)
 * If absent, sensible defaults from §5.2 of the handoff apply.
 * ========================================================================= */
(function () {
  'use strict';

  // ---- Constants -----------------------------------------------------------
  const WORKER = 'https://kofy-notion-proxy.delicate-surf-529c.workers.dev';
  const SETTINGS_KEY  = 'kofy_comms_settings_v1';
  const PERSONA_KEY   = 'kofy_warehouse_persona_v1';
  const DEDUP_KEY     = 'kofy_comms_dedup_v1'; // {key: epoch_ms_sent}
  const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000;  // 6h — don't re-spam the same alert
  const SETUP_KEY     = 'kofy_comms_setup_v1'; // setup-runner config (DB IDs)

  // ---- DB IDs · fallback chain --------------------------------------------
  //   1. window.KOFY_DB_IDS — set inline by warehouse-setup.html in production
  //   2. localStorage SETUP_KEY — written by kofy-comms-setup-runner.html
  //   3. nothing — loader logs a warning when it needs them
  function _readDbIds() {
    if (window.KOFY_DB_IDS && Object.values(window.KOFY_DB_IDS).some(Boolean)) {
      return window.KOFY_DB_IDS;
    }
    try {
      const cfg = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}');
      return {
        MIEMBROS:       cfg.miembros       || null,
        CLIENTES:       cfg.clientes       || null,
        ORIGENES:       cfg.origenes       || null,
        QUINTALES:      cfg.quintales      || null,
        ORDENES:        cfg.ordenes        || null,
        NOTIFICACIONES: cfg.notificaciones || null
      };
    } catch (e) {
      return { MIEMBROS:null, CLIENTES:null, ORIGENES:null, QUINTALES:null, ORDENES:null, NOTIFICACIONES:null };
    }
  }
  const DB_IDS = _readDbIds();

  // ---- Defaults ------------------------------------------------------------
  const DEFAULT_SETTINGS = {
    triggers: {
      order_created:        { enabled: true,  channels: ['whatsapp'],          recipients: ['Leo'] },
      order_advanced_CV:    { enabled: true,  channels: ['whatsapp'],          recipients: ['Leo'] },
      order_ready_envio:    { enabled: true,  channels: ['email','whatsapp'],  recipients: ['customer','Partner'] },
      order_delivered:      { enabled: true,  channels: ['email'],             recipients: ['customer'] },
      order_cancelled:      { enabled: true,  channels: ['email','whatsapp'],  recipients: ['customer','Kafay'] },
      stock_low_origen:     { enabled: true,  channels: ['whatsapp'],          recipients: ['Kafay'] },
      stock_low_empaque:    { enabled: true,  channels: ['whatsapp'],          recipients: ['Kafay'] },
      b2b_cadence_reached:  { enabled: false, channels: ['whatsapp'],          recipients: ['Kafay','Partner'] }, // v2 — needs cron
      free_coffee_dispatch: { enabled: true,  channels: ['sms'],               recipients: ['Kafay'] }
    },
    stockUmbralOrigenKg: 10
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return structuredClone(DEFAULT_SETTINGS);
      const parsed = JSON.parse(raw);
      const merged = structuredClone(DEFAULT_SETTINGS);
      Object.assign(merged, parsed);
      merged.triggers = Object.assign({}, DEFAULT_SETTINGS.triggers, parsed.triggers || {});
      return merged;
    } catch (e) {
      console.warn('[kofy-comms] settings load failed, using defaults', e);
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  // ---- Notion proxy helpers -----------------------------------------------
  async function notionQuery(database_id, filter) {
    const body = filter ? { database_id, filter } : { database_id };
    const r = await fetch(WORKER + '/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('query ' + r.status);
    return r.json();
  }

  function plain(prop) {
    if (!prop) return '';
    if (prop.type === 'title')        return (prop.title    || []).map(t => t.plain_text).join('');
    if (prop.type === 'rich_text')    return (prop.rich_text|| []).map(t => t.plain_text).join('');
    if (prop.type === 'email')        return prop.email || '';
    if (prop.type === 'phone_number') return prop.phone_number || '';
    if (prop.type === 'select')       return prop.select?.name || '';
    if (prop.type === 'number')       return prop.number ?? '';
    if (prop.type === 'date')         return prop.date?.start || '';
    if (prop.type === 'checkbox')     return !!prop.checkbox;
    return '';
  }

  // Cache members for 60s so each event firing doesn't re-query.
  let _memberCache = { at: 0, data: null };
  async function getMembers() {
    if (Date.now() - _memberCache.at < 60_000 && _memberCache.data) return _memberCache.data;
    if (!DB_IDS.MIEMBROS) {
      console.warn('[kofy-comms] MIEMBROS db id not set; cannot resolve recipients');
      return [];
    }
    const { results } = await notionQuery(DB_IDS.MIEMBROS);
    _memberCache = { at: Date.now(), data: results };
    return results;
  }

  async function findMemberByName(name) {
    const all = await getMembers();
    return all.find(p => plain(p.properties?.Nombre).toLowerCase() === name.toLowerCase());
  }

  // ---- Dedupe -------------------------------------------------------------
  function dedupKey(trigger, ref) { return trigger + '::' + ref; }
  function shouldSkip(trigger, ref) {
    try {
      const map = JSON.parse(localStorage.getItem(DEDUP_KEY) || '{}');
      const last = map[dedupKey(trigger, ref)];
      if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
    } catch (_) {}
    return false;
  }
  function markSent(trigger, ref) {
    try {
      const map = JSON.parse(localStorage.getItem(DEDUP_KEY) || '{}');
      map[dedupKey(trigger, ref)] = Date.now();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
      localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  async function resolveRecipients(roles, detail) {
    const out = [];
    for (const role of roles) {
      if (role === 'customer') {
        if (detail.clientName || detail.clientEmail || detail.clientPhone) {
          out.push({
            name:      detail.clientName  || 'Cliente',
            email:     detail.clientEmail || null,
            whatsapp:  detail.clientPhone || null,
            sms:       detail.clientPhone || null,
            clienteId: detail.clientId    || null
          });
        }
        continue;
      }
      const m = await findMemberByName(role);
      if (!m) continue;
      out.push({
        name:      plain(m.properties?.Nombre),
        email:     plain(m.properties?.Email),
        whatsapp:  plain(m.properties?.WhatsApp),
        sms:       plain(m.properties?.SMS),
        miembroId: m.id
      });
    }
    return out;
  }

  async function postNotify(payload) {
    const r = await fetch(WORKER + '/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body: j };
  }

  async function fire(trigger, template, detail, opts) {
    opts = opts || {};
    const settings = loadSettings();
    const t = settings.triggers[trigger];
    if (!t || !t.enabled) return;

    const dedupRef = opts.dedupRef || detail.orderId || detail.origenId || detail.empaqueId || trigger;
    if (opts.dedup !== false && shouldSkip(trigger, dedupRef)) return;

    const recipients = await resolveRecipients(t.recipients, detail);
    for (const r of recipients) {
      for (const channel of t.channels) {
        const to = r[channel] || (channel === 'whatsapp' ? r.sms : null) || null;
        if (!to) {
          await postNotify({
            channel, to: '(missing)', template,
            data: { ...detail, recipientName: r.name },
            meta: {
              trigger,
              status: 'skipped',
              skipReason: 'no ' + channel + ' on file for ' + r.name,
              relatedOrden:   detail.orderPageId || null,
              relatedMiembro: r.miembroId || null,
              relatedCliente: r.clienteId || null,
              triggeredBy:    detail.createdBy || detail.persona || null,
              recipientName:  r.name
            }
          }).catch(() => {});
          continue;
        }
        await postNotify({
          channel, to, template,
          data: { ...detail, recipientName: r.name },
          meta: {
            trigger,
            relatedOrden:   detail.orderPageId || null,
            relatedMiembro: r.miembroId || null,
            relatedCliente: r.clienteId || null,
            triggeredBy:    detail.createdBy || detail.persona || null,
            recipientName:  r.name
          }
        }).catch(err => console.warn('[kofy-comms] notify failed', err));
      }
    }
    markSent(trigger, dedupRef);
  }

  // ---- Event listeners (see §6.2 of handoff) ------------------------------
  window.addEventListener('kofy:orderCreated', e => {
    fire('order_created', 'order_created_leo', e.detail || {});
  });

  window.addEventListener('kofy:orderStageAdvanced', e => {
    const d = e.detail || {};
    const stages = d.stages || [];
    if (stages.includes('CV')) fire('order_advanced_CV',  'order_cv_leo',         d, { dedupRef: d.orderId + ':CV' });
    if (stages.includes('E'))  fire('order_ready_envio',  'order_ready_customer', d, { dedupRef: d.orderId + ':E'  });
    if (stages.includes('EN')) fire('order_delivered',    'order_delivered',      d, { dedupRef: d.orderId + ':EN' });
  });

  window.addEventListener('kofy:orderCancelled', e => {
    fire('order_cancelled', 'order_cancelled_customer', e.detail || {});
  });

  window.addEventListener('kofy:orderArchived', e => {
    const d = e.detail || {};
    postNotify({
      channel: 'email', to: '(internal)', template: 'archived_audit',
      data: d, meta: { trigger: 'order_archived', status: 'sent',
        relatedOrden: d.orderPageId || null, triggeredBy: d.persona || null }
    }).catch(() => {});
  });

  window.addEventListener('kofy:stockLowOrigen', e => {
    fire('stock_low_origen', 'stock_low_origen', e.detail || {});
  });

  window.addEventListener('kofy:stockLowEmpaque', e => {
    fire('stock_low_empaque', 'stock_low_empaque', e.detail || {});
  });

  window.addEventListener('kofy:b2bCadenceReached', e => {
    fire('b2b_cadence_reached', 'b2b_cadence', e.detail || {});
  });

  window.addEventListener('kofy:manualTest', e => {
    const d = e.detail || {};
    postNotify({
      channel: d.channel, to: d.to, template: d.template, data: d.data || {},
      meta: { trigger: 'manual_test', triggeredBy: d.persona || null }
    }).then(r => { window.dispatchEvent(new CustomEvent('kofy:manualTestResult', { detail: r })); });
  });

  // ---- Tiny public API for the settings UI --------------------------------
  window.KofyComms = {
    version: '1.0.1',
    loadSettings,
    saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); },
    DEFAULT_SETTINGS,
    DB_IDS,
    fire,
    postNotify
  };

  if (window.console) console.info('[kofy-comms] loader v' + window.KofyComms.version + ' ready · DB_IDS:', DB_IDS);
})();
