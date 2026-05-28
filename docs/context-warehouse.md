# Kofy · Warehouse (Floor) — Conversation Context

## Company
Kofy — specialty roasted coffee, Caracas, Venezuela.
Team: Kafay (founder), Partner (builder), Leo (head barista, roaster, art director — primary user of this tool), Primo (warehouse support — also uses this tool).

## This conversation
Owns **`warehouse.html`** (was `warehouse-talent.html`) and **`game.html`** (was `warehouse-yo.html`).

- `warehouse.html` — the floor app. Mobile-first. Leo and Primo use this on their phones while working. Shows their task queue, lets them sign/advance order stages, view green coffee stock read-only.
- `game.html` — The Game. Gamification layer for the warehouse team. Coffee plant lifecycle levels, points per stage signed. Lives here because it's Leo/Primo's tool.

## File locations
```
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\warehouse.html
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\game.html
```
Open directly in browser (no server needed). Backend: Notion via Cloudflare Worker proxy.

## Deploy rule
Always commit AND push in the same step. `app.kofy.io` deploys from GitHub — a local commit without `git push origin main` is invisible to the team and does not go live.

## Tech stack (v1 — do NOT change)
- Plain HTML/CSS/JS, single file, no framework
- Notion as database (source of truth)
- Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`
- `kofy-comms-loader.js` loaded at bottom — event bus for notifications

## Design rules (hard)
- **Mobile-first, always.** ≥44px touch targets, bottom-sheet panels, thumb-friendly layout. Leo and Primo use phones on the warehouse floor.
- Notion is source of truth
- Soft-delete / archive over hard delete
- No client-side secrets
- Dark aesthetic. Spanish primary.
- Explicit save, never autosave
- 350ms delay between sequential Notion PATCHes

## Notion DB IDs
```
DB_ORDENES:   3649b62600a0800ea228d8d8dcf2ada4
DB_ITEMS:     3649b62600a0806db145c919a7927ac2
DB_CLIENTES:  3649b62600a08020ae9ed625e57044bb
DB_ORIGENES:  3649b62600a080b5a056c4a03d3fbc2b
DB_QUINTALES: 3649b62600a080df9a7ac6c932fa9d5b
DB_USOS:      3649b62600a080108754c2eaadac2455
DB_MIEMBROS:  3649b62600a080308dc6cf556b0d8c4b
```

## Roast loss constants (same as orders.html — keep in sync)
- AN (claro): 15%
- CM (medio): 15%
- MT (oscuro): 20%

## Workflow stages
Recibida → CV → T (Tostado) → E → L → EN

## What's built in warehouse.html (as of 2026-05-26)
- Persona selector (Leo / Primo pick who they are at session start)
- Task queue: list of orders that need action from the floor team
- Cascade firma (sign stages) — same logic as orders.html
- Green coffee stock read-only view (they can see what's available, cannot edit)
- Inventory read-only (no CRUD — that's inventory.html's job)
- Mobile-optimized layout throughout

## What's built in game.html (as of 2026-05-26)
- Per-member points and levels
- Coffee plant lifecycle: Semilla → Plántula → Arbusto → Cosecha → Bolsa
- Points awarded per stage signed
- Leaderboard view

## Pending work (priority order)
1. **🔥 Cola de Tostado — build here** — This roasting queue view currently lives in orders.html but belongs here. Leo is the one roasting, he needs to see what to roast on his phone. Logic: aggregate all non-cancelled orders where T ✓ = false, group by (tostado profile × origin), show kg verde in / kg tostado out per group + grand totals. The full implementation already exists in orders.html — copy and adapt it for mobile. Key constants (ROAST_LOSS, PRESENTACION_KG, greenKgFor, etc.) are also in orders.html for reference.
2. **Remove Cola de Tostado from orders.html** — once it's live here, remove the 🔥 tab from orders.html. (Coordinate with Orders conversation.)
3. **game.html review** — assess current state, what's working, what Leo/Primo actually use. May need UX refresh.
4. **Push notifications / refresh prompt** — floor team needs to know when a new order arrives. Currently relies on manual refresh or 15s auto-refresh. Could add a more prominent "new order" alert.

## Key design note for Cola de Tostado on mobile
- Should be accessible in 1-2 taps from the main screen
- Show origin + profile clearly (Leo knows his coffees by origin code)
- No need for filters — show ALL pending roasts, Leo handles it holistically
- Print button is less important here (they're at the roaster, not a computer)
- Grand total prominently displayed at top, not bottom

## Related files (do not own, but interact with)
- `orders.html` — management view of same orders. Cola de Tostado logic lives here temporarily.
- `inventory.html` — stock data that warehouse.html reads
- `comms.html` + `kofy-comms-loader.js` — Leo receives WhatsApp notifications when orders are created or advance to CV
- `miembros.html` — team member records (Leo + Primo personas come from here)
