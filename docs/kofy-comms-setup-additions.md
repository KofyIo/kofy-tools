# Setup additions for `warehouse-setup.html`

Two pieces to splice into the existing setup file:

1. **Migration A** — add `Email`, `WhatsApp`, `SMS` properties to **Miembros** and **Clientes**.
2. **Migration B** — create the new **Notificaciones** DB with the full schema from §5.3 of the handoff.

Both use `PATCH /database/:id` (singular path — the worker convention, see §3 of the handoff). Each migration is idempotent: re-running it does nothing if the property already exists.

---

## Where to paste

`warehouse-setup.html` already has a section that runs schema setup for the 7 core DBs. Add the two migration buttons to the same UI grid, and paste the two functions alongside the existing `setupOrigenes()`, `setupOrdenes()`, etc.

```html
<!-- In the migrations grid: -->
<button class="primary" id="btnMigrateRecipients">A · Email/WhatsApp/SMS en Miembros + Clientes</button>
<button class="primary" id="btnCreateNotificaciones">B · Crear DB Notificaciones</button>

<!-- And in the seed/data section, if relevant: -->
<button class="ghost" id="btnSeedTestNotif">Seed · 1 notificación de prueba</button>
```

---

## Migration A · Miembros + Clientes recipient fields

```js
// Adds Email + WhatsApp + SMS properties (idempotent — PATCH is a no-op
// if the property already exists with matching type).
async function migrateRecipientFields() {
  if (!CONFIG.MIEMBROS_DB_ID || !CONFIG.CLIENTES_DB_ID) {
    return alert('Falta MIEMBROS_DB_ID o CLIENTES_DB_ID en CONFIG.');
  }

  // ---- Miembros ----
  await fetch(WORKER + '/database/' + CONFIG.MIEMBROS_DB_ID, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      properties: {
        'Email':    { email: {} },
        'WhatsApp': { phone_number: {} },
        'SMS':      { phone_number: {} }
      }
    })
  }).then(r => r.json()).then(j => console.log('miembros ok', j));

  // ---- Clientes ----
  // 'Teléfono' likely already exists — we add 'Email' if missing and
  // 'WhatsApp' as a separate phone_number for the explicit channel.
  await fetch(WORKER + '/database/' + CONFIG.CLIENTES_DB_ID, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      properties: {
        'Email':    { email: {} },
        'WhatsApp': { phone_number: {} }
      }
    })
  }).then(r => r.json()).then(j => console.log('clientes ok', j));

  alert('Migración recipient fields completa. Ya podés cargar emails/teléfonos en warehouse-comms.html → Recipients.');
}
document.getElementById('btnMigrateRecipients').addEventListener('click', migrateRecipientFields);
```

---

## Migration B · Create the Notificaciones DB

Notion has no "create database" REST endpoint exposed via the existing worker `/database/:id` patch route — that route only edits existing DBs. So this migration uses the worker's `/pages` route to create a child database **inside an existing parent page** (typically the same parent as the other DBs).

> **Action required from Kafay:** create a blank database page in Notion called "Notificaciones", share it with the `Kofy Forms` integration, copy its ID into the `CONFIG.NOTIFICACIONES_DB_ID` slot, then click "B" to patch the schema. This mirrors how the other DBs were bootstrapped originally.

```js
async function createNotificacionesSchema() {
  if (!CONFIG.NOTIFICACIONES_DB_ID) {
    return alert('Falta CONFIG.NOTIFICACIONES_DB_ID. Creá una DB vacía en Notion "Notificaciones", compartila con la integración, y pegá su ID en CONFIG.');
  }
  if (!CONFIG.ORDENES_DB_ID || !CONFIG.MIEMBROS_DB_ID || !CONFIG.CLIENTES_DB_ID) {
    return alert('Configura primero las DBs de Órdenes, Miembros y Clientes (las relaciones las requieren).');
  }

  const body = {
    properties: {
      'Notification ID':   { title: {} },
      'Trigger':           { select: { options: [
        { name:'order_created',        color:'blue'    },
        { name:'order_advanced_CV',    color:'orange'  },
        { name:'order_ready_envio',    color:'green'   },
        { name:'order_delivered',      color:'green'   },
        { name:'order_cancelled',      color:'red'     },
        { name:'order_archived',       color:'gray'    },
        { name:'stock_low_origen',     color:'yellow'  },
        { name:'stock_low_empaque',    color:'yellow'  },
        { name:'b2b_cadence_reached',  color:'purple'  },
        { name:'free_coffee_dispatch', color:'pink'    },
        { name:'manual_test',          color:'default' },
        { name:'Otro',                 color:'default' }
      ] } },
      'Channel':           { select: { options: [
        { name:'email',    color:'blue'   },
        { name:'whatsapp', color:'green'  },
        { name:'sms',      color:'purple' }
      ] } },
      'Recipient name':    { rich_text: {} },
      'Recipient address': { rich_text: {} },
      'Body sent':         { rich_text: {} },
      'Status':            { select: { options: [
        { name:'pending', color:'gray'   },
        { name:'sent',    color:'green'  },
        { name:'failed',  color:'red'    },
        { name:'skipped', color:'yellow' }
      ] } },
      'Provider response': { rich_text: {} },
      'Related Orden':     { relation: { database_id: CONFIG.ORDENES_DB_ID,  single_property: {} } },
      'Related Miembro':   { relation: { database_id: CONFIG.MIEMBROS_DB_ID, single_property: {} } },
      'Related Cliente':   { relation: { database_id: CONFIG.CLIENTES_DB_ID, single_property: {} } },
      'Triggered by':      { relation: { database_id: CONFIG.MIEMBROS_DB_ID, single_property: {} } },
      'Fecha':             { date: {} }
    }
  };

  const r = await fetch(WORKER + '/database/' + CONFIG.NOTIFICACIONES_DB_ID, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!r.ok) return alert('Error: ' + r.status + ' — ¿la DB está compartida con la integración?');
  const j = await r.json();
  console.log('Notificaciones schema ok', j);
  alert('Notificaciones lista. Anotá este ID también en el Worker como NOTIFICACIONES_DB_ID env var.');
}
document.getElementById('btnCreateNotificaciones').addEventListener('click', createNotificacionesSchema);
```

---

## Optional · Seed one test notification

To verify the schema visually right after creating the DB:

```js
async function seedTestNotif() {
  if (!CONFIG.NOTIFICACIONES_DB_ID) return alert('Migrate B primero.');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  await fetch(WORKER + '/pages', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      parent: { database_id: CONFIG.NOTIFICACIONES_DB_ID },
      properties: {
        'Notification ID':   { title: [{ text:{ content: 'NOTIF-' + today + '-001' } }] },
        'Trigger':           { select: { name: 'manual_test' } },
        'Channel':           { select: { name: 'email' } },
        'Recipient name':    { rich_text: [{ text:{ content: 'Test' } }] },
        'Recipient address': { rich_text: [{ text:{ content: 'test@kofy.io' } }] },
        'Body sent':         { rich_text: [{ text:{ content: 'Hola — test de seed' } }] },
        'Status':            { select: { name: 'sent' } },
        'Fecha':             { date: { start: new Date().toISOString() } }
      }
    })
  });
  alert('Seed listo. Refrescá warehouse-comms.html → Log.');
}
document.getElementById('btnSeedTestNotif').addEventListener('click', seedTestNotif);
```

---

## Expose DB IDs to the loader

So the loader and `warehouse-comms.html` can find the new DB without re-pasting IDs everywhere, add this near the top of every warehouse HTML file (or in a shared `kofy-config.js` if one exists):

```html
<script>
  window.KOFY_DB_IDS = {
    MIEMBROS:       'xxx',  // paste from Notion
    CLIENTES:       'xxx',
    ORIGENES:       'xxx',
    QUINTALES:      'xxx',
    ORDENES:        'xxx',
    ITEMS:          'xxx',
    USOS:           'xxx',
    EMPAQUE:        'xxx',
    NOTIFICACIONES: 'xxx'   // ← new
  };
</script>
```

`kofy-comms-loader.js` reads `window.KOFY_DB_IDS` on boot.

---

## Test sequence

1. Click **A** · migration log shows `miembros ok` and `clientes ok` in the console.
2. Open `warehouse-comms.html` → Recipients tab → confirm Email/WhatsApp/SMS fields render for each member.
3. Create blank Notion DB "Notificaciones", share with `Kofy Forms` integration, paste its ID into `CONFIG.NOTIFICACIONES_DB_ID`.
4. Click **B** · schema applied.
5. (Optional) Click seed · one row appears in Notion.
6. Refresh `warehouse-comms.html` → Log tab → seed row visible.
