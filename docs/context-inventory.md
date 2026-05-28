# Kofy · Inventory — Conversation Context

## Company
Kofy — specialty roasted coffee, Caracas, Venezuela.
Team: Kafay (founder, approves everything), Partner (builder, Claude Code user), Leo (barista/roaster), Primo (warehouse support).

## This conversation
Owns **`inventory.html`** (was `warehouse-inventario.html`). This is the stock management tool for green coffee (origenes → quintales) and packaging materials (bolsas, cajas, sachets, etiquetas). Used by Kafay and Partner to track what's in stock, add new bags, audit discrepancies, and manage packaging inventory.

## File location
`C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\inventory.html`
Open directly in browser (no server needed). Backend: Notion via Cloudflare Worker proxy.

## Tech stack (v1 — do NOT change)
- Plain HTML/CSS/JS, single file, no framework
- Notion as database (source of truth)
- Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`
- `kofy-comms-loader.js` loaded at bottom of file — fires `kofy:stockLowOrigen` and `kofy:stockLowEmpaque` events when stock drops below threshold

## Design rules (hard)
- Notion is source of truth
- Soft DOM refresh — never replace entire DOM during user activity
- Soft-delete / archive over hard delete
- Mobile-first (≥44px touch targets)
- No client-side secrets
- Dark aesthetic. Spanish primary.
- 350ms delay between sequential Notion PATCHes

## Notion DB IDs
```
DB_ORIGENES:  3649b62600a080b5a056c4a03d3fbc2b
DB_QUINTALES: 3649b62600a080df9a7ac6c932fa9d5b
DB_USOS:      3649b62600a080108754c2eaadac2455
DB_ORDENES:   3649b62600a0800ea228d8d8dcf2ada4  (read-only, for context)
DB_MIEMBROS:  3649b62600a080308dc6cf556b0d8c4b
DB_EMPAQUE:   3659b62600a08053a953e4a457d44626  (hardcoded in inventory.html + orders.html)
```

## Stock thresholds (config in file)
- `UMBRAL_BAJO`: 10 kg → red alert
- `UMBRAL_MEDIO`: 25 kg → yellow warning

## Green coffee model
- **Origen** → one coffee source (caficultor + hacienda + varietal + proceso)
- **Quintal** → a physical bag purchased from that origen (KG iniciales)
- **Uso** → a deduction event (linked to a Quintal + an Orden). Created automatically on CV stage sign in orders.html.
- **Remanente** = KG iniciales − sum(Usos)
- FIFO deduction: oldest quintal consumed first

## What's built and working (as of 2026-05-26)
- Origen list with expandable quintal rows
- Stock summary tiles (activos, quintales, kg totales, alertas)
- Status filters: 🔴 Bajo / 🟡 Medio / 🟢 OK
- Show/hide inactive orígenes toggle
- Create / deactivate / reactivate orígenes
- Create quintales (per origen, with fecha + letra → generates ID)
- 📋 Auditar stock — manual physical count reconciliation. Creates an "Ajuste audit" Uso with delta + reason + firma.
- 🖨 Print origen sheet (opens print.html?type=origen&id=…)
- Empaque section (if DB_EMPAQUE configured):
  - Add / edit / deactivate / reactivate empaque records
  - Each empaque has a bind (e.g., "MT · 500g"), stock actual, umbral bajo
  - Stock deducted automatically when E stage signed in orders.html
  - 🗑 **Limpiar todo** — archives ALL empaque records (clean slate). Double-confirmed. Does NOT touch orders or green coffee.
- Stock alert events fire to kofy-comms-loader.js (triggers WhatsApp notification to Kafay)
- Auto-refresh every 15s (smart — skips if modal open or user typing)

## Current known issues
- **Packaging DB had 3 dirty records** — user requested wipe. "Limpiar todo" button now exists in the Empaque section header. Run it to clear.
- After wiping, re-enter packaging stock from scratch using + Nuevo empaque.

## Pending work
1. **Empaque clean slate** — use the "🗑 Limpiar todo" button, then re-enter real packaging stock.
2. **Stock low thresholds** — currently hardcoded (10 / 25 kg). Could make these configurable per-origen.
3. **Quintal edit** — currently you can only create quintales, not edit them. If KG iniciales was entered wrong, there's no way to fix it short of a Notion direct edit. Could add an edit flow.

*Note: the original 14-item Warehouse v2 backlog (2026-05-18) is fully complete as of 2026-05-26. See `docs/warehouse-v2-backlog-status.md` for the closed list.*

## Related files (do not own, but interact with)
- `orders.html` — writes Usos on CV stage (green deduction) and E stage (packaging deduction)
- `comms.html` + `kofy-comms-loader.js` — receives stock low events from this file
- `setup.html` — configures DB_EMPAQUE (run once)
- `print.html` — printable origen sheets
