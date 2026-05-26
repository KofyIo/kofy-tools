# 04-kofy-cliente.md · Department shard · Cliente (v1 · 2026-05-25)

Load this together with `00-kofy-core.md` when working on landing pages, WhatsApp handoff, customer DB, comms / notifications module, or any customer-facing surface. Do **not** load it for content / operaciones / dinero sessions unless customer-facing copy is being produced.

---

## 1 · North star

Cliente is the surface where Kofy meets the world. Every word here is a brand decision — voice, restraint, and conexión. The customer should feel that talking to Kofy is a different experience from talking to any other specialty brand. We sound warm, confident, and quiet. Never loud.

## 2 · Current state

### Landing page
- `kofy-landing.html` — deployed for Instagram-driven traffic
- Captures leads to the **Kofy Clientes** Notion DB
- Hands off to WhatsApp Business as the next step
- Single-purpose: capture intent + name + phone, then move to a real conversation

### Comms / notifications module (outbound, internal-events driven)
- Built in a parallel Claude session (separate from this one)
- **#14 in the warehouse v2 backlog** — notifications
- Plug-and-play via an event-bus contract
- Handoff doc: `kofy-handoff-comms-v1.html`
- Detailed memory: `comms_parallel_session.md`
- Not yet integrated into the main toolset

### Kofy AI module (inbound, customer-message AI handling) — ⭐ NEW 2026-05-25
Auto-handles inbound customer messages across **Email + Instagram + WhatsApp + (future) YouTube**. Each message goes through Claude → assigned a flag (🟢🟡🔴) → green auto-sends, yellow/red routes to a human approver via WhatsApp. The full handoff doc lives in the workspace as `KOFY-AI-HANDOFF.md` — load it when working on this module.

**Live infrastructure:**
- AI Brain Worker: `https://kofy-ai.delicate-surf-529c.workers.dev` (file: `kofy-ai-worker.js`)
- Notion Proxy Worker: `https://kofy-notion-proxy.delicate-surf-529c.workers.dev` (file: `kofy-worker.js`)
- Test console: `kofy-ai-test.html`
- Email inbox: `admin@kofy.io`
- Cron: every 5 min checks the inbox

**3 Notion DBs (separate from the warehouse/calendar DBs, connected to "Kofy forms" integration):**
- Knowledge Base — `3699b62600a08027aa83f396bf275daa` — brand voice, FAQs, approved answers Claude pulls from
- Pending Replies — `3699b62600a08003a7ecc79d345993f5` — yellow/red flags awaiting human approval
- Reply Log — `36a9b62600a080f19a8ffa3f2a1c7828` — full history of sent replies

**Flag system:**
- 🟢 Green — fully confident → auto-sends immediately
- 🟡 Yellow — slight uncertainty → Notion + WhatsApp notification to approver
- 🔴 Red — sensitive / outside knowledge → Notion + WhatsApp notification to approver

**Approval commands via WhatsApp:** `YES` / `SÍ` sends the suggested reply · any other text overrides as the reply · `STATUS` shows pending count.

**Status per channel (2026-05-25):**
- ✅ **Email** — fully working. 3-layer filter (pattern → AI pre-screen → full Claude pipeline). Cron-driven. Green emails auto-reply via Microsoft Graph.
- ✅ **Instagram** — webhook receiving DMs + comments, Claude processing, saving to Notion. Reply-send built but **not yet confirmed working in production**. `IG_TOKEN` needs refresh every 60 days.
- ⏳ **WhatsApp** — pending Meta verification (48h). Code ready. Needs 3 env vars on clearance: `WA_PHONE_ID`, `WA_TOKEN`, `APPROVER_PHONE`.
- ⏸️ **YouTube** — not started.

**Architecture note:** both workers are on `delicate-surf-529c` subdomain. Cross-worker calls cause CF error 1042, so kofy-ai calls Notion + Anthropic APIs **directly**, not through the proxy. Proxy is only used by `kofy-db-setup.html` and external HTML tools.

**Claude model in use:** `claude-haiku-4-5-20251001` (cheap + fast for high-volume customer screening).

**Critical pending work:**
1. Confirm reply-send actually reaches the customer on Email + Instagram (test green flag end-to-end)
2. Add WhatsApp env vars when Meta verification clears
3. **Populate Knowledge Base** with Kofy brand voice, FAQs, product info, pricing — Claude has no context until this happens, so right now it's guessing
4. IG_TOKEN refresh reminder / auto-refresh system (60-day expiry)
5. Generate long-lived WhatsApp System User token for production (non-expiring)

**Why this matters for Cliente specifically:** every 🟢 green reply this system sends is a customer-facing Kofy surface. The Knowledge Base IS the brand voice in production — what gets written there becomes how Kofy sounds to people. The hard yes / hard no of section 7/8 below apply to Knowledge Base content with extra force.

### Event bus (shared infrastructure)
- Events like `kofy:orderStageAdvanced`, `kofy:contentPhaseAdvanced`, `kofy:newLead` flow through a shared bus
- Comms subscribes to relevant events and dispatches notifications
- Allows other modules to fire events without knowing who's listening

## 3 · Voice (the most important asset in this department)

Pull from the core, but applied to Cliente:

- **Spanish primary** for all customer-facing surfaces. English for export contexts only.
- **Prose over lists.** A landing page that reads like a paragraph beats one that reads like a feature matrix.
- **Real numbers over vague adjectives.** "12 horas en tostado lento" beats "tostado artesanal". "1.08L de leche cruda por sachet" beats "premium milk".
- **Warm, not loud.** No exclamation marks unless someone is shouting in joy. No emoji-stuffed CTAs. No urgency manufactured by us.
- **Restraint as luxury.** What we *don't* say is part of what makes us premium.

## 4 · Channels

- **Instagram** · primary discovery surface. Posts ladder to landing page.
- **Landing page (`kofy.io`)** · capture surface. Single CTA: start a conversation.
- **WhatsApp Business** · the real conversation. Human-handled, not bot-handled, today.
- **Email** · not used yet for customer flows. If introduced, voice rules apply.

## 5 · Lead lifecycle

1. **Discovery** · Instagram → landing page click
2. **Capture** · landing page form → Kofy Clientes DB → automatic WhatsApp message ("Hola — soy [name] de Kofy. ¿Cómo te ayudo?")
3. **Conversation** · WhatsApp · human-operated · brand voice applies
4. **Order** · manual today — agent creates an order in warehouse-ordenes referencing the Cliente record. Productos catalog (Dinero) provides price. Tasa BCV (Dinero) is applied.
5. **Fulfillment** · warehouse ships. Comms module fires `orderShipped` event → customer notified.
6. **Follow-up** · today this is ad hoc. Future: nurture sequence designed and approved by Kafay before sending.

## 6 · Hard yes · Cliente

The lines we hold:

- **Conexión as the test.** Every customer-facing line answers the question "does this connect, or does this sell?" If it sells without connecting, rewrite.
- **One CTA per surface.** The landing page asks for one thing. The WhatsApp message moves one decision forward. We don't stack.
- **Spanish primary.** Customer-facing English is the exception, not the default.
- **Real numbers when they exist.** Roast times, origin, lot codes, milk yield per sachet — they belong in customer copy when they earn their place.
- **Human in the loop on WhatsApp.** A real person answers, in brand voice. No bot replies that pretend to be a person.
- **Names matter.** We call customers by their names from the first message.
- **Slow is part of the brand.** A 4-hour reply window with a thoughtful response beats a 2-minute auto-reply.

**Kofy AI specifics:**
- **Knowledge Base is gated by Kafay.** What goes in there becomes how Kofy sounds at scale. Every entry is brand-voice reviewed.
- **Green-flag threshold stays conservative.** When in doubt, the system routes to a human. We'd rather over-route than under-route.
- **Every channel is tested end-to-end before relying on it.** A working webhook + a built reply-send + a logged Notion entry does not mean the customer received the reply. Verify with a real test send.
- **Every sent reply hits the Reply Log.** No silent sends.
- **Inbound IS a real human.** Every reply — green, yellow, or red — should sound like a real Kofy person, not "the AI".

## 7 · Hard no · Cliente

The lines we won't cross:

- **No nationalism / political framing.** "Hecho en Venezuela con orgullo nacional" is not the voice. Origin is craft, not flag.
- **No copy that could come from any other specialty brand.** "Premium beans, expertly roasted" — if it reads like a stock listing, it's wrong.
- **No price-led messaging.** Price appears after value has been earned in the read.
- **No urgency we manufactured.** No "última oportunidad", no fake countdowns, no "solo quedan 3".
- **No loud tone.** No SHOUTING, no triple exclamation, no "🔥🔥🔥" — even when it would technically work for engagement.
- **No bot voice.** Auto-replies that read as auto-replies break the brand promise the first time. Use them only for "received, real person responding within X hours" — never to pretend a conversation is happening.
- **No customer name typos.** If we got the name from the form, we use it correctly. If we don't have it, we ask.
- **No leveraging customer hardship.** Venezuelan economic context is internal — never used as a sympathy lever or a marketing point.

**Kofy AI specifics:**
- **Never let the AI tell a customer it is an AI.** No "I'm the Kofy assistant", no "as an AI", no disclaimers. If a question requires that level of transparency, it's not green-flag material — it's a human question.
- **Never lower the yellow/red bar to save the approver time.** The friction is the safety mechanism. If approver fatigue is a problem, fix the Knowledge Base — don't loosen the threshold.
- **Never expand to a new channel without testing reply-send end-to-end first.** A "we built it" without "we verified it" is a bug waiting to embarrass.
- **Never let Knowledge Base accrete without brand-voice review.** Every new entry is reviewed before it goes live.
- **Never store customer PII outside the official Notion DBs.** No worker-side logs of message contents, no debug dumps with personal data.
- **Never auto-escalate confidence over time.** Green flags don't get easier to assign because we've sent a lot of them. The model resets per message.

## 8 · Comms module integration (in flight)

The comms module is plug-and-play via the event bus. When it ships:

- Define which events trigger which notifications (e.g., `orderShipped` → customer WhatsApp + internal Slack/email)
- All customer-facing notification copy gates through brand voice review
- Internal notifications can be looser but should still be coherent — we sound like Kofy even when talking to ourselves

Reference `kofy-handoff-comms-v1.html` for the contract.

## 9 · Files in workspace (Cliente-relevant)

- `kofy-landing.html` — live landing page
- `kofy-handoff-comms-v1.html` — comms module contract (outbound notifications)
- `KOFY-AI-HANDOFF.md` — full Kofy AI system handoff doc (read first when touching the AI module)
- `kofy-ai-test.html` — test console for the AI brain
- `kofy-ai-worker.js` — Cloudflare worker source for the AI brain (deploy to `kofy-ai`)
- `kofy-worker.js` — Cloudflare worker source for the Notion proxy (deploy to `kofy-notion-proxy`)
- Related memory: `comms_parallel_session.md`, plus future `kofy_ai_system.md`

## 10 · Pending work

- **Confirm AI reply-send reaches customers** on Email + Instagram (test green flag end-to-end)
- **Populate Kofy AI Knowledge Base** with brand voice, FAQs, product info, pricing — critical for confident green-flag answers
- Add WhatsApp env vars to `kofy-ai` worker when Meta verification clears (`WA_PHONE_ID`, `WA_TOKEN`, `APPROVER_PHONE`)
- IG_TOKEN refresh system (60-day expiry — auto-refresh or scheduled reminder)
- Long-lived WhatsApp System User token for production
- YouTube integration (not started — needs YouTube Data API setup)
- Comms (notifications) module deployment + event-bus wiring across warehouse + calendar
- Customer portal (`warehouse-cliente.html` — task #12 from prior session)
- Nurture sequence design (Spanish, brand voice, approved by Kafay before any send)
- Order-from-lead automation (today fully manual)

## 11 · Roles in Cliente

- **Kafay** · approves every customer-facing surface, voice, and sequence before it ships
- **Partner** · drafts customer copy, designs landing pages, carousels
- **Leo** · not customer-facing day-to-day, but his aesthetic informs design decisions
- **JOSE** · operationally executes order shipping that triggers customer-facing events

---

*Last edit: 2026-05-25 · v1.0 · Pairs with `00-kofy-core.md`. Comms module detail in `comms_parallel_session.md`.*
