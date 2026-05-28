# Kofy · Claude Code Instructions

## Project
Kofy — specialty coffee, Caracas, Venezuela.
Tools live at `app.kofy.io` (Cloudflare Pages, auto-deploys on push to `main`).
Backend: Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`.
Database: Notion.

## Commit & deploy rule — ALWAYS do this at the end of every session

When a session ends or a meaningful chunk of work is complete, **commit and push to main**. No exceptions.

```
git add <changed files>
git commit -m "..."
git push origin main
```

Cloudflare Pages picks up the push automatically and deploys within ~1 minute.

**Why this matters:** the tools run at `app.kofy.io`, not from the local machine. Anything not pushed is invisible to the team. Changes that exist only locally might as well not exist.

**Why Claude Code doesn't do this automatically by default:** Claude is conservative — it won't commit without being told, because it doesn't know if work is finished, if there are secrets in the diff, or if a half-built feature should go live. For this project, the rule overrides that: if the work is done enough to show to Kafay or the team, push it.

## Tech stack (do not change)
- Plain HTML/CSS/JS single-file tools — no framework, no build step
- Notion as database (source of truth)
- Cloudflare Worker as API proxy (no client-side secrets)
- `kofy-comms-loader.js` — event bus for WhatsApp/email notifications

## File locations
All tools are in `tools/`. Current files:
- `inventory.html` — green coffee + packaging stock
- `orders.html` — order kanban + roast queue
- `warehouse.html` — floor app (Leo/Primo)
- `miembros.html` — team members
- `comms.html` — comms settings UI
- `setup.html` — Notion schema installer (run once)
- `print.html` — printable order/origen sheets
- `game.html` — The Game (KPIs)
- `warehouse-reset.html` — utility

Context docs for each tool are in `docs/`.

## Design rules (hard)
- Notion is source of truth
- Soft-delete / archive over hard delete
- Mobile-first (≥44px touch targets)
- No client-side secrets
- Dark aesthetic. Spanish primary.
- 350ms delay between sequential Notion PATCHes
- Soft DOM refresh — never replace entire DOM during user activity

## DB IDs (hardcoded — do not load from localStorage)
```
DB_ORIGENES:  3649b62600a080b5a056c4a03d3fbc2b
DB_QUINTALES: 3649b62600a080df9a7ac6c932fa9d5b
DB_USOS:      3649b62600a080108754c2eaadac2455
DB_ORDENES:   3649b62600a0800ea228d8d8dcf2ada4
DB_MIEMBROS:  3649b62600a080308dc6cf556b0d8c4b
DB_EMPAQUE:   3659b62600a08053a953e4a457d44626
DB_CLIENTES:  3649b62600a08020ae9ed625e57044bb
DB_ITEMS:     3649b62600a0806db145c919a7927ac2
```
