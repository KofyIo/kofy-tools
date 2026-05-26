# Kofy AI System — Full Handoff Document

## What This System Does
Fully automated AI customer communication system for Kofy (kofy.io). Receives messages from Email, Instagram, WhatsApp, and (future) YouTube. Processes each through Claude, assigns a flag, auto-sends green replies, and routes yellow/red to a human approver via WhatsApp.

---

## Live Infrastructure

| Service | URL / ID |
|---|---|
| AI Brain Worker | https://kofy-ai.delicate-surf-529c.workers.dev |
| Notion Proxy Worker | https://kofy-notion-proxy.delicate-surf-529c.workers.dev |
| Email inbox | admin@kofy.io |
| Instagram Business Account ID | 17841460556952787 |
| Facebook Page ID | 61590171190270 |
| Meta App ID | 274913304604786 |
| Instagram App ID (Kofy-IG) | 1647513536533575 |

---

## Cloudflare Workers

### 1. kofy-ai (main brain)
**URL:** https://kofy-ai.delicate-surf-529c.workers.dev  
**Routes:**
- `POST /message` — process any incoming message through Claude
- `GET /check-email` — manually trigger email inbox check
- `GET /webhook` — WhatsApp/Instagram webhook verification
- `POST /webhook` — incoming WhatsApp messages + Instagram DMs/comments
- `GET /debug-notion` — test Notion connection

**Cron:** runs every 5 minutes (`*/5 * * * *`) to check email inbox

### 2. kofy-notion-proxy
**URL:** https://kofy-notion-proxy.delicate-surf-529c.workers.dev  
**Routes:** `POST /query`, `POST /pages`, `PATCH /pages/:id`, `PATCH /databases/:id`

---

## Environment Variables (kofy-ai worker)

| Variable | Type | Value / Notes |
|---|---|---|
| `ANTHROPIC_KEY` | Secret | Anthropic API key (sk-ant-...) |
| `NOTION_KEY_AI` | Secret | Notion integration token (ntn_...) for "Kofy forms" integration |
| `MS_CLIENT_ID` | Plaintext | `8dc9e52b-f55b-427d-b56c-79d0e7050798` |
| `MS_TENANT_ID` | Plaintext | `b35d81b2-266a-41ee-a931-d0bdce1c081c` |
| `MS_CLIENT_SECRET` | Secret | Azure app client secret |
| `KOFY_EMAIL` | Plaintext | `admin@kofy.io` |
| `WA_VERIFY_TOKEN` | Plaintext | Custom verify token for webhook (set during Instagram webhook setup) |
| `IG_PAGE_ID` | Plaintext | `17841460556952787` (Instagram Business Account ID) |
| `IG_TOKEN` | Secret | Instagram access token from Step 2 of Meta App setup (long-lived, 60 days) |
| `WA_PHONE_ID` | Plaintext | ⏳ PENDING — WhatsApp Phone Number ID (add after verification) |
| `WA_TOKEN` | Secret | ⏳ PENDING — WhatsApp permanent access token (add after verification) |
| `APPROVER_PHONE` | Plaintext | ⏳ PENDING — approver's phone number e.g. 584141234567 (no + sign) |

---

## Notion Databases

All three databases are connected to the **"Kofy forms"** Notion integration.

| Database | ID | Purpose |
|---|---|---|
| Knowledge Base | `3699b62600a08027aa83f396bf275daa` | Brand voice, FAQs, approved answers Claude uses |
| Pending Replies | `3699b62600a08003a7ecc79d345993f5` | Yellow & red flagged messages awaiting approval |
| Reply Log | `36a9b62600a080f19a8ffa3f2a1c7828` | Full history of every sent reply |

---

## Flag System

| Flag | Meaning | Action |
|---|---|---|
| 🟢 Green | Fully confident, safe to send | Auto-sends reply immediately |
| 🟡 Yellow | Probably right, slight uncertainty | Saves to Notion + WhatsApp notification to approver |
| 🔴 Red | Sensitive, outside knowledge, needs human | Saves to Notion + WhatsApp notification to approver |

---

## Approval Flow (via WhatsApp)

When a yellow/red message comes in, the approver receives a WhatsApp message like:
```
🟡 YELLOW FLAG
Email — Subject: "Packaging inquiry"

Customer said:
"Hi, interested in your packaging..."

Suggested reply:
"Hey! Thanks for reaching out..."

Reason: Pricing details uncertain
Reply YES to send, or type your own reply.
```

**Approver commands:**
- `YES` / `SÍ` → sends suggested reply, marks Approved in Notion
- Any other text → sends that text as the reply, marks Edited in Notion
- `STATUS` → shows how many pending items are waiting

After approving, if more items are pending the next one is shown automatically.

---

## Email Pipeline (FULLY WORKING ✅)

**Flow:**
1. Cron runs every 5 min → fetches up to 20 unread emails from admin@kofy.io
2. **Layer 1** — Pattern filter: instantly skips known junk (TikTok, Gumroad, Instagram notifications, PayPal, Wix, etc.)
3. **Layer 2** — AI pre-screen: cheap Claude call asks "real customer or automated junk?" — catches new junk automatically
4. **Layer 3** — Full Claude pipeline: processes real emails, assigns flag, sends or routes

**Green emails** → auto-replied via Microsoft Graph API  
**Yellow/Red emails** → saved to Notion Pending Replies + WhatsApp notification (once WA is live)

**Note:** `@facebookmail.com` is NOT in the filter — Meta verification emails pass through.  
**Note:** `@wixforms.com` is NOT in the filter — these are real customer form submissions from the website.

---

## Instagram (PARTIALLY WORKING ✅)

**What works:**
- Webhook receiving DMs and comments ✅
- Claude processing messages ✅
- Saving to Notion Pending Replies ✅
- Webhook fields subscribed: `messages`, `comments`, `live_comments`, `message_edit`, `message_reactions`, `messaging_postbacks`, `messaging_referral`, `messaging_seen`

**What's NOT yet confirmed:**
- Actual reply sending back to Instagram (built but untested)
- IG_TOKEN needs to be refreshed every 60 days (from Meta App → Step 2 → Generate token)

**Meta App:** "Kofy" (app ID 274913304604786) — status: **Live**  
**Instagram account:** kofy.io (ID 17841460556952787) connected to Facebook Page (ID 61590171190270)

---

## WhatsApp (PENDING ⏳)

**Status:** WhatsApp Business Account locked/under 48-hour verification by Meta.

**What's built:** Full webhook handler, approval notification, approval reply parsing — all code is ready.

**To complete when verification clears:**
1. Go to Meta App → WhatsApp → API Setup
2. Get the permanent Phone Number ID and access token
3. Add to kofy-ai worker:
   - `WA_PHONE_ID` — the phone number ID
   - `WA_TOKEN` — permanent system user access token
   - `APPROVER_PHONE` — your WhatsApp number (digits only, no +, e.g. `584141234567`)
4. Deploy worker
5. Set up webhook in Meta App pointing to: `https://kofy-ai.delicate-surf-529c.workers.dev/webhook`
6. Use `WA_VERIFY_TOKEN` value for webhook verification

**Test number:** +1 555 649-3624 (Phone Number ID: 1131451803393499)  
**Note:** Recipient must first send a message TO the test number to open the conversation window.

---

## What Still Needs Building

1. **Confirm reply sending works** — test a green-flag email/Instagram message and verify the reply actually reaches the customer
2. **WhatsApp completion** — add 3 env variables once verification clears (see above)
3. **Knowledge Base population** — add Kofy brand voice, FAQs, product info, pricing to Notion Knowledge Base so Claude has context
4. **IG_TOKEN refresh system** — token expires in 60 days, need a reminder or auto-refresh
5. **YouTube** — not started, needs YouTube Data API setup
6. **Long-lived WhatsApp token** — generate a System User token in Meta Business Suite for production (doesn't expire)

---

## Key Files

All files saved to Cloudflare Workers via the dashboard editor:

- **kofy-ai-worker.js** — main AI brain (deploy to kofy-ai worker)
- **kofy-worker.js** — Notion proxy (deploy to kofy-notion-proxy worker)
- **kofy-db-setup.html** — one-click Notion database schema setup tool
- **kofy-ai-test.html** — test console for sending messages and seeing Claude's response

---

## Architecture Notes

- Both workers are on the same Cloudflare subdomain (`delicate-surf-529c`). Cross-worker calls cause error 1042, so the AI worker calls Notion API and Anthropic API **directly** — NOT through the proxy.
- The proxy is only used by the db-setup tool and any external HTML tools.
- Claude model used: `claude-haiku-4-5-20251001` (fast and cheap)
- Notion integration token format: `ntn_...` (new format) stored as `NOTION_KEY_AI`

---

## Testing

**Manual email check:** https://kofy-ai.delicate-surf-529c.workers.dev/check-email  
**Test console:** open `kofy-ai-test.html` in browser — sends test messages and shows flag + reply

---

## Azure App (for email)

- **App name:** registered in Azure Active Directory
- **Client ID:** `8dc9e52b-f55b-427d-b56c-79d0e7050798`
- **Tenant ID:** `b35d81b2-266a-41ee-a931-d0bdce1c081c`
- **Permissions granted:** `Mail.Read`, `Mail.ReadWrite`, `Mail.Send` (application permissions, admin consent given)
