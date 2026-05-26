# Kofy packages · how to use these files

This folder contains the canonical operating documents for the Kofy team, designed to be uploaded into new Claude conversations as a lightweight context package — replacing the heavy auto-load model that was making every session expensive.

---

## The files

| File | Purpose | When to load |
|---|---|---|
| `00-kofy-core.md` | Universal core — anchor, framework, KPS, team, working style, departments index | **Every** conversation |
| `01-kofy-contenido.md` | Calendar, KPS production, briefings, video bank | Content / calendar work |
| `02-kofy-operaciones.md` | Warehouse, inventory, orders, talent app, mermas | Warehouse / operations work |
| `03-kofy-dinero.md` | Ledger, tasa BCV, Productos catalog, milk cost model | Money / pricing work |
| `04-kofy-cliente.md` | Landing, WhatsApp, customer DB, AI inbound comms, brand voice in customer surfaces | Customer-facing work |
| `05-kofy-tools.md` | HTML interface conventions — sync patterns, save/input rules, aesthetic, mobile, testing | Any session building/editing an HTML tool |

---

## Two paths for the core file

You have a choice on `00-kofy-core.md` — pick the one that fits your control preference:

**Path A — set and forget.** Upload `00-kofy-core.md` into the **Claude Project's Knowledge section** (the existing Project's settings page). From then on, every conversation in this Project auto-loads the core. You only upload the relevant shard per session. Fewer uploads, less friction, less control.

**Path B — fully manual.** Don't put anything in Project Knowledge. Upload `00-kofy-core.md` + the relevant shard(s) at the start of every conversation. Maximum control, maximum portability, every session is fully self-contained. Slightly more friction per session.

**Recommendation:** Path A. The core is small, immutable, load-bearing, and needed every time. The shards are the part that should stay user-controlled.

Either way, **the shards (01–04) should never go into Project Knowledge.** That defeats the purpose of departmentalizing.

---

## Recommended session ritual

When you open a new conversation:

1. **State the department** — "Working on Contenido today" (or Operaciones / Dinero / Cliente, or two if cross-cutting).
2. **Upload the relevant shard(s).** If you're on Path B, also upload `00-kofy-core.md` first.
3. **Give the one-line goal** — "Fix the unsaved-changes bug on the calendar tool" / "Run dinero deployment step 4" / "Draft launch carousel copy".
4. **Let Claude confirm** it has internalized core + shard, then answer one clarifying question if any.

The shards are designed to give Claude enough context to make judgment calls instead of asking exhaustive setup questions. If a session keeps asking "what's the framework?" — the wrong file was loaded.

---

## When something changes

The shards are living documents. If a real decision is made in a session — a new hard yes / hard no, a new pending-work item, a renamed file, a structural change — update the relevant shard in this folder. Versioning is just the date in the header (`v1 · 2026-05-25` → bump on real change).

The core file changes rarely. Brain edits go through Kafay only.

If a shard and an HTML tool ever disagree — **the HTML wins** (canonical rule from the core).

---

## Cross-department sessions

When work spans two departments (e.g., wiring Dinero into Warehouse), upload both shards. Don't try to fold everything into a single mega-doc — the cost of that is exactly why we're splitting in the first place.

---

## Why this exists

The previous setup loaded the entire Kofy brain plus every active module's context into every conversation, even when we were deep in a single thing. That cost token budget on the first message of every session and made the model harder to keep on-track.

The new model: **universal core stays small + always loaded**; **departments load on demand**; **state lives in Notion**; **artifacts live in the workspace**; **conversations bring forward only what's load-bearing.**

You keep developing per-department without sessions drifting onto unrelated tangents.

---

## What's NOT in this folder (intentionally)

These live elsewhere and you reference them from inside a session if needed — you don't pre-load them:

- The full brain HTMLs (`kofy-brain.html`, `kofy-the-way.html`, `kofy-el-camino.html`)
- KPS Manual (`KPS_Manual.docx` / `KPS_Manual.pdf`)
- HTML tools (`calendar.html`, warehouse apps, landing page, comms handoff)
- Detailed memory files (`warehouse_system.md`, `dinero_parallel_session.md`, `comms_parallel_session.md`, `kps_production_system.md`)
- Mental maps (`kofy_mapa_mental.html`, `kofy_mapa_accion.html`)
- Meeting summaries (`kofy_resumen_reunion_1.html`)

All of those remain in the workspace. A session opens them with the Read tool when it actually needs them.

---

*Folder created: 2026-05-25 · v1.0*
