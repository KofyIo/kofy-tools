# Kofy · Orders — Conversation Context

## Company
Kofy — specialty roasted coffee, Caracas, Venezuela.
Team: Kafay (founder, approves everything), Partner (builder, Claude Code user), Leo (barista/roaster), Primo (warehouse support).

## This conversation
Owns **`orders.html`** (was `warehouse-ordenes.html`). This is the main order management tool — a workflow board for creating, tracking, and advancing customer orders through production stages. Used daily by Kafay and Partner.

## File location
`C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\orders.html`
Open directly in browser (no server needed). Backend: Notion via Cloudflare Worker proxy.

## Tech stack (v1 — do NOT change)
- Plain HTML/CSS/JS, single file, no framework
- Notion as database (source of truth)
- Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`
- `kofy-comms-loader.js` loaded at bottom of file — event bus for notifications (do not remove)

## Design rules (hard)
- Notion is source of truth. HTML reads/writes Notion. If they disagree, Notion wins.
- Soft DOM refresh — never replace entire DOM during user activity
- Explicit save, never autosave. Unsaved-changes warning required.
- Soft-delete / archive over hard delete
- Mobile-first (≥44px touch targets)
- No client-side secrets — tokens live in the Worker
- Dark, gamified aesthetic. Spanish primary language.
- 350ms delay between sequential Notion PATCHes (rate limit)

## Notion DB IDs
```
DB_ORDENES:   3649b62600a0800ea228d8d8dcf2ada4
DB_ITEMS:     3649b62600a0806db145c919a7927ac2
DB_CLIENTES:  3649b62600a08020ae9ed625e57044bb
DB_ORIGENES:  3649b62600a080b5a056c4a03d3fbc2b
DB_QUINTALES: 3649b62600a080df9a7ac6c932fa9d5b
DB_USOS:      3649b62600a080108754c2eaadac2455
DB_MIEMBROS:  3649b62600a080308dc6cf556b0d8c4b
DB_EMPAQUE:   loaded from localStorage "kofy_warehouse_db_ids" → DB_ID_EMPAQUE
```

## Roast loss constants (correct, do not change)
- AN (claro / Aurora Nordics): 15%
- CM (medio): 15%
- MT (oscuro): 20%

## Workflow stages
Recibida → CV (Café Verde) → T (Tostado) → E (Empaquetado) → L (Listo p/ envío) → EN (Entregado)

On CV: FIFO green coffee deduction from quintales
On E: packaging stock deduction

## What's built and working (as of 2026-05-26)
- Board with 6 stages (main tab has no label — it's the default view)
- Create orders with items (presentación, tostado, cantidad, grano, origen)
- Cascade firma (sign multiple stages at once, all stamped to persona)
- Cancel / archive orders (with optional green coffee return if CV but not T)
- Reactivate cancelled orders
- B2B prefill (load standard order from client profile)
- Gratis / cortesía flag
- Advanced filters: date range, etapa, tostado, origen, tipo (B2B / Retail / Cortesía)
- ~~🔥 Cola de Tostado tab~~ — removed 2026-05-28. Migrated to warehouse.html.
- ✏ Edit items — button in order detail modal. Edit OR add new items OR delete/archive existing items post-order. Each existing item has × (soft-delete with ↩ undo). "+ Agregar item" button adds new rows. Save handles all three operations in one pass.
- Green coffee total estimate in new order modal (live calculation)
- Auto-refresh every 15s (skips if modal open or user is typing)
- Change detection (sig-based, skips re-render if nothing changed)
- Printable order sheets (opens print.html?type=order&id=…)

## Pending work (priority order)
1. **Orders filters** — user said filters need more improvement. Explore what other filter dimensions would be useful (e.g., filter by persona who signed, filter by ETA window).

*Note: the original 14-item Warehouse v2 backlog (2026-05-18) is fully complete as of 2026-05-26. See `docs/warehouse-v2-backlog-status.md`.*

## Related files (do not own, but interact with)
- `inventory.html` — green coffee stock that gets deducted on CV stage
- `print.html` — printable order + origen sheets
- `comms.html` + `kofy-comms-loader.js` — notification system fired on order events
- `miembros.html` — team members (used for persona selector + firma)
- `setup.html` — DB schema installer (run once, not regularly)
