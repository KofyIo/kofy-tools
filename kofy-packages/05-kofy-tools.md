# 05-kofy-tools.md · HTML interface conventions (v1 · 2026-05-25)

Load this together with `00-kofy-core.md` and the relevant department shard whenever you're **building, editing, or designing an HTML tool** for Kofy — calendar, warehouse apps, landing page, AI test console, dashboards, future tools. These conventions are the same across departments. If you're only producing content / copy / strategy and not touching tool code, you don't need this shard.

---

## 1 · The philosophy

Kofy's internal tools are part of the brand. They are not "just admin software." A team member opens these every day; how they feel matters as much as what they do. The aesthetic is **dark, gamified, and quietly luxurious** — think specialty coffee bar lighting, not enterprise SaaS. Leonardo sets the aesthetic standard.

Stack rule: **plain HTML/CSS/JS, no framework**, single-file artifacts where possible. Hosting is GitHub Pages under the `kofyio` org; DNS via Wix. The backend is Notion via a Cloudflare Worker proxy. State of the business lives in Notion; the HTML is the tool.

---

## 2 · Backend pattern — Notion via Cloudflare Worker proxy

**Proxy URL (main, warehouse + calendar + landing leads):** `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`

**Proxy routes:**
- `POST /query` — query a database (paginated, filterable)
- `POST /pages` — create a new page in a database
- `PATCH /pages/:id` — update an existing page
- `PATCH /databases/:id` — schema changes (rare)

**Why a proxy:** Notion API requires `Authorization: Bearer <secret>`. The secret can't ship in client-side HTML. The Worker holds the secret and forwards calls. It also handles CORS.

**App-state pattern:** Long-lived UI state (filters, last-active tab, persona) lives on a dedicated Notion page (`_KOFY_APP_STATE_`) as a JSON blob. Apps read it on load, write it on change. This is how state survives across devices and across browser refreshes.

**Notion DB ID conventions:**
- Calendar DB: `3509b62600a080468cbedcaa3b6e4bc6`
- Warehouse DBs: 7 of them, listed in `warehouse_system.md` memory
- Kofy AI DBs: 3 of them (Knowledge Base, Pending Replies, Reply Log) — listed in `04-kofy-cliente.md`
- Dinero DBs: 4 new ones, pending deployment

**Architecture note:** Workers on the same `delicate-surf-529c` subdomain **cannot call each other** (Cloudflare error 1042). If a worker needs Notion + Anthropic, it calls them **directly**, not through the proxy.

---

## 3 · Sync pattern — soft DOM refresh + change detection

This is the single most load-bearing pattern in Kofy tools. Get it wrong and users lose work.

**The rules:**
- **Never replace the entire DOM on refresh.** Update only the elements whose data actually changed.
- **Detect change before re-render.** Compare incoming data against the in-memory snapshot. If unchanged, do nothing.
- **Pause refresh on hidden tabs.** No background polling against Notion when no one's looking.
- **Resume + force-refresh on focus.** When the user comes back, do one immediate refresh.
- **Cooldown after a user action.** If the user just saved something, suppress the next 30s of refresh to avoid stomping on their state.
- **Default interval:** 15 seconds between polls. Adjust per tool only if the data velocity demands it.

**Why this matters:** an earlier version of the calendar replaced the DOM on refresh while users were typing in input fields. Inputs lost focus, scroll position jumped, typed text disappeared mid-sentence. Soft refresh fixed it. Same pattern now applies to every tool that polls Notion.

Reference memory: `calendar_footage_patterns.md`.

---

## 4 · Save & input patterns

The user already lost a full session of work because input fields weren't persisting. These are non-negotiable now.

- **Explicit save, never autosave.** Save and Cancel buttons are always visible. The user decides when to commit.
- **Unsaved-changes warning.** If the user clicks away from a form with unsaved changes, intercept and show a "tienes cambios sin guardar — ¿descartar?" confirm. Apply to: panel close, tab switch, navigating away from the page.
- **Every form field must verifiably persist.** When adding a field to a form, write a quick sanity check: save → refresh → confirm the value came back from Notion. Two fields silently failed to persist in the calendar (`vis`, `nar`) and 4 days of work was lost. **Every new field gets this check before shipping.**
- **Debounce inputs that drive search / filter** — 200–300ms typical. Don't debounce the save action.
- **Tap-to-assign, not drag-and-drop on mobile.** Dropdowns and chip selectors beat drag-drop for assignments. Mobile-first interaction patterns.

---

## 5 · Delete & retrieve

Hard delete is almost never the right call. Use **archive / soft-delete** so the team can pull something back if it was a mistake.

- Add an `archived` boolean (or `status = "archived"`) to the schema instead of removing rows.
- UI surfaces archived items in a dedicated "archived" view, not in the main list.
- Restore is a single tap from the archived view.
- Hard-delete is reserved for genuine garbage (spam, accidental dupes within 60s of creation) and still requires a confirm.

This applies across calendar entries, orders, customer leads, content briefs — anything the team might want back.

---

## 6 · Aesthetic — dark, gamified, quietly luxurious

**Theme variables** (use CSS custom properties, never hardcoded colors):
- `--bg` — base background
- `--surface` — card / panel background
- `--accent` — primary action color
- `--gold` — Kofy gold accent (rare, used for moments of weight)
- `--text` — primary text
- `--border` — subtle borders

**Tone:**
- Dark base by default. Light theme exists as a toggle for daytime use but dark is the default.
- Borders are subtle (1px, low-contrast). Shadows are soft, not dramatic.
- Hover states: lift, not glow. A 2px translate-Y beats a neon outline.
- Typography: clean sans-serif. System fonts are fine (`-apple-system, BlinkMacSystemFont, "Segoe UI"`). No Google Fonts dependency.
- Spacing is generous. Cards breathe. Don't pack 12 controls into a 200px-tall card.

**Gamification:**
- Coffee plant lifecycle for achievement levels: `semilla → brote → planta → flor → cereza → grano verde → grano tostado → bolsa`
- Track A = 120 pts internal, Track B = 100 pts, 50 pt completion bonus
- Use sparingly — gamification is a motivation layer, not a decoration. If it doesn't drive a behavior, leave it out.

**Iconography:**
- Phase icons (📋🎨🎬✂️✅ for KPS) are functional, not decorative. Use them where they help readability.
- Avoid generic flat-icon sets. If an icon doesn't carry meaning, don't add it.

---

## 7 · Language conventions

- **Spanish primary** for all UI labels, buttons, modal copy, empty states.
- **English for single-word concept labels** that are canonical across the system: `WHY` / `HOW` / `WHAT`, `Track A` / `Track B`, `Briefing` / `Guion` / etc. when displaying KPS phase labels.
- **No translated technical labels.** "Email" stays "Email", not "Correo electrónico". "Worker" stays "Worker". The cognitive cost of inventing translations isn't worth it.
- **Microcopy carries brand voice.** Empty states are an opportunity, not filler. "Aún no hay videos en el banco — ese silencio es una oportunidad" beats "No items to display".

---

## 8 · Mobile-first interaction

Most tools are opened from phones on the warehouse floor, during shoots, or on the move.

- **Touch targets ≥ 44px.** No tiny taps.
- **Bottom-sheet panels on mobile**, side panels on desktop. Same panel content, different presentation.
- **Tap-to-assign over drag-drop** (see section 4).
- **Sticky action buttons** at the bottom of long forms so Save is always reachable.
- **No hover-dependent affordances.** Anything reachable on hover must also be reachable on tap.

---

## 9 · File & versioning conventions

- **Live tool name** is the canonical filename: `calendar.html`, `warehouse-ordenes.html`, `kofy-landing.html`.
- **Versioned builds** during development: `calendar-v8.html` next to `calendar.html`. Test the versioned file, then swap by rename. Keep the previous version as `calendar.html.bak3` (incremented) in case rollback is needed.
- **Patch scripts** go in `outputs/` (Python scripts that produce a new versioned HTML from the previous one). Pattern: `patch_calendar_v8.py` reads `calendar-v7.html`, writes `calendar-v8.html`. Surgical string replacements, no full re-templating.
- **Why versioning matters:** OneDrive mount sometimes blocks in-place rewrites. Versioned new-file outputs always work, and the user does the rename in Windows Explorer.

---

## 10 · Cross-tool event bus

Modules talk to each other through events, not direct function calls. This keeps each tool independently deployable.

**Event naming:** `kofy:<noun><Verb>` e.g. `kofy:orderStageAdvanced`, `kofy:contentPhaseAdvanced`, `kofy:newLead`.

**Pattern:**
- Tool A fires the event (window.dispatchEvent)
- Tool B subscribes (window.addEventListener)
- The Comms module subscribes to relevant events and dispatches notifications
- No tool knows who's listening — they just fire

Reference: `kofy-handoff-comms-v1.html`.

---

## 11 · Testing rituals before swap

Before swapping `calendar-vN.html` → `calendar.html` (or any tool swap), test these:

1. **Load** — does it open? Are there any console errors?
2. **Read** — does data come in from Notion? Are values populated correctly?
3. **Write — new entry** — create, save, refresh, confirm it persisted
4. **Write — edit existing** — open, change a field, save, refresh, confirm
5. **Click away with unsaved changes** — does the warning fire?
6. **Mobile view** — does the layout hold on a phone-sized viewport?
7. **Every newly-added form field** — confirm it persists end-to-end (this is the rule that would have saved 4 days of work)
8. **Tab switch / focus loss** — does state survive?

Only swap when all 8 pass.

---

## 12 · Hard yes · Tools

- **Notion is source of truth for state.** HTML reads/writes to Notion, never holds canonical data.
- **HTML wins over markdown** (core rule) — if a tool's behavior contradicts a doc, the tool is right and the doc is wrong (or out of date).
- **Soft DOM refresh, always.** Never full-replace the DOM during user activity.
- **Explicit save, unsaved-changes warning, every form field verified to persist.** Non-negotiable.
- **Dark, restrained, gamified-only-where-it-drives-behavior** aesthetic.
- **Spanish primary, English for canonical concept labels.**
- **Soft-delete / archive over hard-delete.**
- **Mobile-first interactions** for anything used on the warehouse floor or on shoots.

## 13 · Hard no · Tools

- **No autosave.** The user owns the save decision.
- **No DOM-replace refresh** during user activity.
- **No silent field failure.** If a field can fail to persist, that's a P0 bug, not polish.
- **No hover-only affordances.**
- **No hardcoded colors.** CSS variables only.
- **No framework dependency** (React/Vue/Svelte) for the core tools. Plain HTML/CSS/JS.
- **No Google Fonts / external font CDN.** System fonts only.
- **No cross-worker calls on the same subdomain** (Cloudflare error 1042). Call APIs directly from each worker.
- **No client-side secrets.** Tokens live in the Worker, never in the HTML.
- **No "minor polish" merges that skip the 8 testing rituals.** The cost of a missed test is full sessions of lost work.

---

*Last edit: 2026-05-25 · v1.0 · Cross-cutting. Pairs with `00-kofy-core.md` + relevant department shard when working on any tool.*
