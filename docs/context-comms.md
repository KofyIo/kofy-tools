# Kofy · Comms — Conversation Context

## Company
Kofy — specialty roasted coffee, Caracas, Venezuela.
Team: Kafay (founder), Partner (builder), Leo (roaster), Primo (warehouse support).

## This conversation
Owns the entire comms module:
- `comms.html` — settings UI (triggers, recipients, log, test, templates)
- `kofy-comms-loader.js` — event bus listener, drop-in script for all warehouse tools
- `kofy-worker-v4.js` — Cloudflare Worker with `/notify` endpoint (email via MS Graph, WhatsApp via Meta Cloud API, Notion logging)
- `kofy-comms-setup-runner.html` — one-click Notion schema setup (migrations A + B)
- `kofy-comms-tester.html` — standalone health check + test sender

## File locations
```
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\comms.html
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\kofy-comms-loader.js
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\workers\kofy-worker-v4.js
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\kofy-comms-setup-runner.html
C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\tools\kofy-comms-tester.html
```

## Tech stack (v1 — do NOT change)
- Plain HTML/CSS/JS, single file, no framework
- Notion as database (comms log in DB_NOTIFICACIONES)
- Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`
  - This is the SAME worker that handles all Notion proxy calls
  - v4 adds the `/notify` route on top of existing proxy routes

## How the comms module works
```
orders.html / inventory.html
    │ fires kofy:orderCreated, kofy:orderStageAdvanced,
    │       kofy:stockLowOrigen, kofy:stockLowEmpaque, etc.
    ▼
kofy-comms-loader.js  (event bus listener, loaded via <script> tag in each tool)
    │ reads settings from localStorage "kofy_comms_settings_v1"
    │ resolves recipients from DB_MIEMBROS
    │ 6h dedup window per trigger+ref
    ▼
POST /notify  →  kofy-notion-proxy Cloudflare Worker (v4)
    │
    ├── email   →  Microsoft Graph API (sendMail as admin@kofy.io)
    ├── whatsapp →  Meta WhatsApp Cloud API (WA_PHONE_ID + WA_TOKEN)
    └── logs every send to DB_NOTIFICACIONES (success, failed, OR skipped)
```

## Notification triggers (7 active + 1 v2)
| Trigger | Default channels | Default recipients |
|---|---|---|
| order_created | WhatsApp | Leo |
| order_advanced_CV | WhatsApp | Leo |
| order_ready_envio | Email + WhatsApp | Customer + Partner |
| order_delivered | Email | Customer |
| order_cancelled | Email + WhatsApp | Customer + Kafay |
| stock_low_origen | WhatsApp | Kafay |
| stock_low_empaque | WhatsApp | Kafay |
| b2b_cadence_reached | WhatsApp | Kafay + Partner (disabled — needs cron) |

## Current state: code complete, NOT deployed

Everything is built and tested in isolation. **The only thing blocking full activation is deploying kofy-worker-v4.js to Cloudflare.**

### What's already done
- Miembros DB has Email, WhatsApp, SMS columns filled for all 4 team members
- DB_NOTIFICACIONES exists (ID: `3669b62600a0804289b4cd429406882a`)
- `WA_PHONE_ID` + `WA_TOKEN` already set on kofy-notion-proxy worker (env vars)
- Migration A already run (Miembros + Clientes got email/WA/SMS columns)
- `kofy-comms-loader.js` is loaded in orders.html and inventory.html already

### What's NOT done yet
- kofy-worker-v4.js not yet deployed (still on old version)
- MS Graph env vars not yet added to the worker
- comms.html UI not yet tested end-to-end

## Deploy checklist (do this to go live)

### Step 1: Deploy kofy-worker-v4.js
1. Go to Cloudflare dashboard → Workers → `kofy-notion-proxy`
2. Edit code → paste entire contents of `kofy-worker-v4.js` → Save and Deploy

### Step 2: Update environment variables on kofy-notion-proxy
**ADD these vars** (copy values from `kofy-ai` worker):
- `MS_CLIENT_ID` — Azure app client ID
- `MS_TENANT_ID` — Azure directory tenant ID
- `MS_CLIENT_SECRET` — Azure app client secret
- `KOFY_EMAIL` = `admin@kofy.io`

**DELETE these vars** (no longer used):
- `FROM_EMAIL`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WA_FROM`, `ANTHROPIC_KEY`, `NOTION_KEY_AI`

**KEEP these vars** (already set, working):
- `NOTION_KEY`, `NOTIFICACIONES_DB_ID`, `WA_PHONE_ID`, `WA_TOKEN`

### Step 3: Run Migration B
Open `kofy-comms-setup-runner.html` → run Migration B only (creates Notificaciones DB schema).
Migration A is already done — DO NOT run it again.

### Step 4: Test
Open `comms.html` → Test tab → send test notifications on each channel.
Or open `kofy-comms-tester.html` for a standalone health check.

## WhatsApp status
WA_PHONE_ID + WA_TOKEN are set and ready. Meta Business verification is PENDING approval.
Until it clears, the worker logs all WhatsApp sends as "skipped" with reason — graceful, no errors.
When Meta verification clears: add `WA_PHONE_ID`, `WA_TOKEN`, `APPROVER_PHONE` to the worker (they may already be there).

## Email status
Microsoft Graph (admin@kofy.io) goes live as soon as Step 2 above is done. No other dependencies.

## Notion DB IDs
```
DB_MIEMBROS:       3649b62600a080308dc6cf556b0d8c4b
DB_CLIENTES:       3649b62600a08020ae9ed625e57044bb
DB_NOTIFICACIONES: 3669b62600a0804289b4cd429406882a
```

## comms.html settings storage
Settings live in `localStorage "kofy_comms_settings_v1"` — per-device. This is a known limitation of v1. If you configure on one device, another device won't see it. SYSTEMS 2.0 will fix this by moving settings to Notion. For now it's acceptable.

## Pending work
1. **Deploy v4** (see checklist above) — this is the only blocking item
2. **Test end-to-end** after deploy
3. **comms.html UI** — 5 tabs are built but untested. May have bugs to fix once live.
4. **b2b_cadence trigger** — currently disabled. Needs a scheduled check (cron-style) to fire it. Not possible in v1 without an external scheduler. Deferred to SYSTEMS 2.0.
5. **Multi-device settings** — settings are localStorage, so device-specific. Acceptable for now. SYSTEMS 2.0 fixes this.
6. **IG_TOKEN refresh** — for Kofy AI (separate conversation), not strictly comms, but related. Token expires every 60 days.

## Cloudflare Workers
- Notion proxy (comms lives here): `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`
- AI brain (separate, do not touch from this conversation): `https://kofy-ai.delicate-surf-529c.workers.dev`
- Workers on the same subdomain CANNOT call each other (CF error 1042). Each calls Notion/external APIs directly.
