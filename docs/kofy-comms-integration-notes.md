# Integration notes · for the warehouse Claude

Short notes on decisions made in isolation that you should double-check against the real codebase before merging.

## 1 · Decisions taken without you

- **Accent color**: `#2BB59E` (teal). The handoff offered teal or violet; teal feels closer to *conexión* and distinct from the warehouse `#D97757` coffee accent. Easy to flip — single CSS variable in `warehouse-comms.html`.
- **Settings storage**: `localStorage["kofy_comms_settings_v1"]` per device, not Notion. Trade-off: settings don't sync across Kafay's phone/laptop, but it's instant and removes one round-trip per event. v2 can promote this to a Notion settings page.
- **B2B cadence checker (#8 trigger)**: **disabled by default**. The check needs a Cloudflare Worker cron trigger (or scheduled task) — the loader runs in the browser and can't fire while no app is open. The trigger key, settings UI row, and template are all wired up; only the periodic poller is missing. Leaving it for v2 keeps v1 scope tight.
- **Notion log entry IDs**: generated server-side in the worker (`NOTIF-YYYYMMDD-NNN` with a random 3-digit). At Kofy's volume (well under 1000/day) collision risk is negligible. If it becomes a worry, swap for an atomic counter in KV.
- **Dedupe window**: 6 hours per `(trigger, ref)` key in the loader's localStorage. Stops the same low-stock alert from firing every 20s as inventario polls. Adjustable in `kofy-comms-loader.js` (`DEDUP_WINDOW_MS`).
- **Template strings**: I wrote first-draft Spanish copy in `warehouse-comms.html` and the worker. **Treat them as placeholders** — Kafay must rewrite for the actual *conexión* voice before going live. The template names (keys) are stable; only the body strings change.

## 2 · Assumptions about existing schema

The loader and patch list assume these properties exist (or will, after Migration A):

- `Miembros`: `Nombre` (title), `Iniciales` (rich_text), `Email`, `WhatsApp`, `SMS`
- `Clientes`: `Nombre / Razón Social` (title) **or** `Nombre`, `Email`, `Teléfono` or `WhatsApp`
- `Órdenes`: `Order ID` (title), `Cliente` (relation → Clientes)
- `Orígenes`: `ID Origen` (title), `Hacienda` (rich_text), KG remanente as a rollup or formula

If any property name differs in the real schema, edit the `plain(props['ExactName'])` lookups — they're isolated to:
- `warehouse-comms.html` → `renderMiembros`, `renderClientes`, `renderLog`
- `kofy-comms-loader.js` → `findMemberByName`, `resolveRecipients`

## 3 · Gotchas with existing patterns

### Persona selector
Reuses `localStorage["kofy_warehouse_persona_v1"]`. **The shape must match** whatever the existing apps write. I assumed `{ name, ini, role, miembroId? }`. If the existing apps store just a string or use a different key, swap `getPersona()` in `warehouse-comms.html` accordingly. The 4 fixed members in `MIEMBROS_FIXED` match the handoff team — no need to fetch from Notion just to pick a persona.

### Cascade firma
Stage codes are `I` (ingreso), `CV` (café verde), `T` (tostado), `E` (empacado), `EN` (enviado/entregado) — I inferred from §4 and §5.2 of the handoff. **Verify the real codes** in `warehouse-arquitectura.html` and adjust the `kofy:orderStageAdvanced` handler in the loader if they differ. The handler does:
```js
if (stages.includes('CV')) → trigger order_advanced_CV
if (stages.includes('E'))  → trigger order_ready_envio
if (stages.includes('EN')) → trigger order_delivered
```

When a cascade fires (e.g. signing E while CV was unsigned, both get marked) the loader will dispatch multiple notifications correctly — that's by design.

### Smart refresh
The log viewer polls every 20s and self-suppresses if focus is on an INPUT/SELECT/TEXTAREA or if an overlay is visible. It does not respect a global "isPolling" flag from the rest of the warehouse; if you have a shared `kofyPause()` helper, plug it into the `setInterval` callback in `warehouse-comms.html`.

### Worker `/notify` always returns 200
By design — the response payload carries `status: 'failed' | 'skipped' | 'sent'`. The loader checks the body, not the HTTP code. This avoids "your customer's email bounced" being interpreted as "the worker is broken."

## 4 · What was deferred

| Item | Why | Suggested home |
|---|---|---|
| B2B cadence cron | Browsers can't poll while closed | Add `[triggers]` block to `wrangler.toml`; new worker route `/cron-check` that queries Clientes + Órdenes |
| Customer portal HTML | §9.4 deferred decision | Separate file `customer-orden.html?id=...` — Kafay confirmed wanting this, but it's a sibling project to comms, not a child |
| WhatsApp template approval | §9.6 deferred decision | Outside 24h window, Twilio requires pre-approved templates. For v1 we assume conversations are within the window (customer just placed an order). Document for Kafay so she requests template approval before automation goes hot. |
| Per-channel retry queue | Out of scope for v1 | Failed sends are logged but not auto-retried. Manual retry button exists in the log viewer (UI placeholder — add a tiny worker `/retry/:notifId` route in v2). |
| Settings sync across devices | Punt to v2 | Move `localStorage` → Notion page in DB "Settings" |
| Localization toggle | Single-language deployment | Spanish hardcoded; if you ever ship English-speaking B2B customers, templates are the only thing to fork |

## 5 · Files in this delivery

| File | Purpose |
|---|---|
| `warehouse-comms.html`            | Settings UI · recipients editor · log · test sender. ~700 lines. |
| `kofy-comms-loader.js`            | Event-bus loader. ~270 lines. |
| `kofy-comms-worker-patch.md`      | Cloudflare Worker `/notify` route + env vars + deploy steps. |
| `kofy-comms-setup-additions.md`   | Migration A (recipient fields) + Migration B (Notificaciones DB) for `warehouse-setup.html`. |
| `kofy-comms-event-hook-patch-list.md` | Exactly which 1-line dispatchEvents go where in the existing files. |
| `kofy-comms-integration-notes.md` | This file. |

## 6 · Testing path (matches §8 of the handoff)

1. Deploy worker with new `/notify` route + env vars set. Hit it with `curl` — expect `status: sent` + an actual email.
2. Run Migration A from `warehouse-setup.html`. Confirm Email/WhatsApp/SMS appear in Miembros via the Notion UI.
3. Create blank "Notificaciones" DB in Notion, share with `Kofy Forms`, paste ID, run Migration B. Confirm schema in Notion.
4. Open `warehouse-comms.html` standalone (no warehouse hooks yet). Pick persona. Trigger matrix should load with defaults.
5. Edit Kafay's email/WhatsApp on the Recipients tab. Save → confirm Notion updates.
6. Test sender → channel=email, to=your own address, template=`order_ready_customer`. Should receive the email and see one `sent` row in the log within 5s.
7. Add the `<script src="kofy-comms-loader.js"></script>` tag to one warehouse file (e.g. ordenes). Open browser console, run:
   ```js
   window.dispatchEvent(new CustomEvent('kofy:orderCreated', {
     detail: { orderId:'TEST-1', clientName:'Test', items:[], eta:'2026-05-25', createdBy:null }
   }));
   ```
   The loader should fire a WhatsApp to Leo (or log `skipped` if Leo's WhatsApp isn't on file yet).
8. Apply remaining patches per `kofy-comms-event-hook-patch-list.md`. Place a real test order, advance through CV → E → EN, confirm 3+ notifications appear in the Notion log.
9. Mobile screenshot of `warehouse-comms.html` at 375px — confirm trigger matrix and tabs are usable.

## 7 · If you find me

If something in this handoff was vague and you had to guess differently, prefer your codebase reality over my interpretation. The only contract I'm precious about is the **event names** in §6.2 of the original handoff and the **detail payload keys** in the patch list — change those and the loader misses events silently.

— A parallel Claude session, May 2026
