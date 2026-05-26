# kofy-core.md · Universal core (v1 · 2026-05-25)

This is the only Kofy document that should be loaded into **every** Claude conversation, no matter what we're working on. It is intentionally short. Everything else lives in a department shard and is loaded on demand.

---

## 1 · The anchor — conexión

Everything Kofy ships — a caption, a roast spec, a B2B sell sheet, a hiring decision, a product roadmap — must be traceable, in one short sentence, back to **conexión**. If it can't, question whether it belongs under kofy.io.

## 2 · The 3-layer framework (Golden Circle + Patagonia)

- **WHY** — lifestyle, vision, feeling. Pillars: *Historia · Ritual a la taza · Comunidad.*
- **HOW** — craft, method, principle. Pillars: *Craft · Conocimiento · Origen.*
- **WHAT** — product, tangible, evidence. Pillars: *Craft · Origen* (+ *Ritual a la taza* when product meets moment).

When producing anything: pick the layer → pick the pillar → name the value → choose Track A or B → write the one-line brief → audit against conexión.

## 3 · KPS · Kofy Production System (canonical, 2026-05-21)

The 5 fases sagradas. Every video passes through these phases in order — sin atajos, sin excepciones.

| # | Slug | Icon | Phase | Owner / firma |
|---|---|---|---|---|
| 01 | `briefing` | 📋 | Briefing grupal | Director Creativo facilita · **Kafay firma** |
| 02 | `guion` | 🎨 | Guion + Storyboard + Props | Guionista escribe · Leonardo arma storyboard |
| 03 | `grabacion` | 🎬 | Grabación | Leonardo |
| 04 | `edicion` | ✂️ | Edición | Leonardo (bloque sagrado, no se interrumpe) |
| 05 | `publicacion` | ✅ | Revisión + Publicación | Kafay revisa UNA ronda · Leo publica |

**Regla de oro:** ningún video pasa a la siguiente fase si la anterior no está 100% cerrada y firmada. Briefings se hacen en bloque (varios proyectos a la vez). Guion también. Solo grabación → edición → publicación se tratan como tareas individuales por proyecto en el calendario.

## 4 · Production tracks

- **Track A** — Blackmagic 6K, Leo operates, documentary tone, low frequency. 120 pts internal.
- **Track B** — phone-grade, faster cadence, educational generosity. 100 pts internal.
- Never mix Track A and Track B in the same day.

## 5 · Team (4 people)

- **Kafay** (Mega Onish, brain owner) · Director Creativo, signs all briefings + final revision, approves scripts, talent, external comms. Founder.
- **Partner** (co-founder) · script creation, carousel design, ops/design support. Sometimes referred to as "Computer" in production roles.
- **Leonardo (Leo)** · head barista + roaster + art director + camera (Blackmagic 6K + phone) + editor. Aesthetic standards live with him.
- **Primo (José)** · part-time support. Signs warehouse logs as **JOSE**. (`Primo` = label; `JOSE` = signature.)

Gabriela appears in the KPS doc as a possible guionista — she is part of the extended circle, not core.

## 6 · Operating environment

- Based in Caracas, Venezuela.
- Logistics via **MRW** branch-to-branch for cross-country. Rate baseline: ≤1kg $4 · ≤3kg $6.50 · ≤5kg $10 · ≤10kg $15 · ≤20kg $24 · ≤30kg $32 · ≤50kg $48 (intrazone cheaper).
- Two product lines: **Line 01 coffee** (specialty roasted) and **Line 02 milk** (Jersey-cow sachets, in development).
- Tasa BCV (USD/Bs) updated daily, lives in Dinero.

## 7 · Never

- Lean on Venezuelan nationalism or political framing.
- Use a voice interchangeable with any other specialty brand.
- Put price or specs before the *why* has been earned.
- Ship anything that doesn't ladder back to conexión.
- Conflate operational stages (warehouse green-bean CV/E/etc.) with content stages (KPS).

## 8 · Working style

- Prose first, lists sparingly. Real numbers over vague adjectives. Spanish primary for internal + customer-facing; English for export.
- Warm, confident, not loud. Luxury in restraint.
- Action over hedging. Kafay drives technical decisions directly and will correct mid-build — that's the rhythm.
- Aesthetic for internal tools: dark, gamified (coffee plant lifecycle — semilla → brote → planta → flor → cereza → grano verde → grano tostado → bolsa).

## 9 · The 4 departments

The Kofy operation runs across four departments. Each has its own shard (`kofy-XX-name.md`). Load only the shard(s) relevant to the conversation.

| Dept | Shard | What it covers |
|---|---|---|
| 01 · Contenido | `01-kofy-contenido.md` | Calendar, KPS production, briefings, guiones, video bank, publication rhythm |
| 02 · Operaciones | `02-kofy-operaciones.md` | Warehouse, green-bean inventory, roasting, orders, talent app, mermas |
| 03 · Dinero | `03-kofy-dinero.md` | Ledger, tasa BCV, cuentas, productos catalog, pricing, B2B, milk cost model |
| 04 · Cliente | `04-kofy-cliente.md` | Landing pages, WhatsApp handoff, customer DB, comms/notifications, brand-facing surfaces |

Marca (brand voice + framework) is not a department — it lives in this core file (sections 1, 2, 7, 8) and gates everything across all four.

## 10 · Single source of truth — where things live

- **State of the business** (the data that changes daily) → **Notion**. Calendar entries, orders, inventory, ledger, customers, comms log. Queried via Cloudflare Worker proxy: `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`.
- **Artifacts and tools** (versioned files, manuals, HTML front-ends) → **OneDrive workspace** at `C:\Users\megao\OneDrive\Documents\Claude\Projects\Kafay shared co work space`.
- **Canonical operating rules** (this file + shards) → uploaded into each conversation as needed.

**Canonical rule:** if a markdown file and an HTML file ever disagree, **the HTML wins**.

## 11 · How to open a new session

1. Upload `00-kofy-core.md` (this file).
2. Upload the relevant department shard(s).
3. Tell Claude in one line which department + what you're working on today.
4. Claude confirms it has internalized core + shard, asks one clarifying question if needed, then works.

If a session bleeds across departments mid-conversation, upload the additional shard then — don't pre-load everything.

## 12 · Brain-edit hygiene

Only Kafay should issue edits to this core file or to the brain HTMLs (`kofy-brain.html`, `kofy-the-way.html`, `kofy-el-camino.html`). If another team member proposes a change, route it through Kafay first. The shards (department docs) can be updated by anyone in that department's session, but the core stays clean.

---

*Last edit: 2026-05-25 · v1.0 · Replaces the heavy Project-Knowledge load model.*
