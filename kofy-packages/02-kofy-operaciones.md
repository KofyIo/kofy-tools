# 02-kofy-operaciones.md · Department shard · Operaciones (v1 · 2026-05-25)

Load this together with `00-kofy-core.md` when working on the warehouse system, green-bean inventory, roasting, orders, talent app, or mermas accountability. Do **not** load it for content / dinero / cliente sessions.

---

## 1 · North star

Operaciones is the physical-flow chain: green bean comes in → gets roasted → becomes inventory → goes out as orders. Every kilogram of bean has an origin, every roast has a profile, every merma has a signer. The system is accountable by default — JOSE (Primo) is the canonical signer of warehouse logs.

## 2 · Architecture (built 2026-05-18)

**Backend:** 7 Notion databases.
**Frontend:** 3 HTML front-ends in the workspace.
**Sync:** Cloudflare Worker proxy at `https://kofy-notion-proxy.delicate-surf-529c.workers.dev`.

The 7 DBs are the canonical source of truth. The HTML apps are tools that read/write to them. State of the business lives in Notion.

## 3 · Stage vocabulary (operational, NOT KPS)

Warehouse uses its own stage names — **CV / E / etc.** for green-bean lifecycle, distinct from KPS content stages. Never conflate the two. If a tool surfaces both content and operational stages, route each through its own vocabulary.

## 4 · v2 backlog (14 items, dictated by Kafay 2026-05-18 after v1 went live)

These were captured the day v1 launched. They reflect real production feedback. Listed in original capture order — not priority order; re-prioritize at the start of any v2 work session.

1. Persona selector (who is operating right now)
2. Cascading firma (one signature flows down to dependent records)
3. Deactivate origins (origin records that are no longer in rotation)
4. Merma math (calculations for loss tracking)
5. B2B (separate flow for B2B orders)
6. Notifications
7. Print version
8. Talent app
9. (plus 6 more — full list lives in `warehouse_v2_backlog.md` memory file)

## 5 · Talent app

Standalone HTML for the team to log activity from their phones. Should integrate with the warehouse DBs but be designed for one-tap mobile interactions. Designed but not yet built.

## 6 · Accountability principle

Every warehouse action that touches inventory must have a signer. **JOSE** (Primo) is the canonical operational signer. Where Kafay or Leonardo sign, it's because they performed the action directly. Signatures are non-revocable — if a value is wrong, the correction is a new signed entry, not an edit.

## 7 · Mermas (loss tracking)

Mermas are tracked as a first-class concept — green bean → roasted bean conversion has a known loss percentage that gets validated against actuals per batch. Merma math (item #4 in v2 backlog) formalizes this.

## 8 · Origenes (green-bean origins)

Origins are persistent records — farm, producer, varietal, process, lot. They feed every inbound green-bean event. "Deactivate origins" (v2 item #3) lets us hide origins no longer in rotation without deleting history.

## 9 · Orders flow

Orders are the outbound chain. Order entry → reserve roasted inventory → fulfillment → handoff to logistics (MRW). B2B (v2 item #5) is a separate flow with its own pricing tier — Productos catalog in Dinero owns the price points.

## 10 · Integration with other departments

- **Contenido** · operational stages are NOT KPS stages. If a roasting day becomes a video subject, the video has its own KPS lifecycle on the calendar — the roast log doesn't move with it.
- **Dinero** · every order touches the ledger when it ships. Productos catalog in Dinero is the price source. Dinero is in parallel build — 4 new DBs + 8 migrations are pending before warehouse-ordenes + warehouse-talent can wire in the loader script tags.
- **Cliente** · landing-page leads land in a separate Notion DB (Kofy Clientes), then handoff to WhatsApp. Order creation from a lead is manual today; future connector lives in Cliente.

## 11 · Files in workspace (Operaciones-relevant)

- `warehouse-ordenes.html` — orders front-end
- `warehouse-talent.html` — talent app front-end
- Other warehouse HTML files (specific names in workspace)
- Related memory files (full warehouse architecture detail in `warehouse_system.md` memory)

## 12 · Pending work

- v2 backlog (14 items above) — none started yet
- `warehouse-reportes.html` — daily reports view (task #11 from prior session)
- `warehouse-cliente.html` — customer portal (task #12 from prior session)
- Dinero loader script tags into `warehouse-ordenes` + `warehouse-talent` (task #19 from prior session) — gated on Dinero deployment

## 13 · Roles in Operaciones

- **JOSE (Primo)** · canonical operational signer for warehouse activity
- **Leonardo** · roasting + green-bean handling (when applicable)
- **Kafay** · approves price points, B2B terms, deactivations of origins, system architecture changes

## 14 · Hard yes · Operaciones

The lines we hold:

- **Every inventory action has a signer.** No anonymous changes. The signer field is non-negotiable.
- **JOSE is the canonical operational signer.** "Primo" is the label, "JOSE" is the signature on the log.
- **Notion is the source of truth.** HTML apps are tools — they read and write to Notion. If they disagree, Notion wins for data; HTML wins for design rules (per core).
- **Origins are persistent.** Once an origin record exists, it's a history-keeping entity. We deactivate; we don't delete.
- **Mermas are tracked first-class.** Roasting loss is not an afterthought — every batch validates actual vs expected merma.
- **Operational stages (CV / E / etc.) are a separate vocabulary from KPS.** Don't reuse either set in the wrong context.
- **Corrections are new entries, not edits.** If a signed value is wrong, we add a correction record. The original stays.
- **B2B and retail flows are separated.** Different prices, different fulfillment SLAs, different paperwork.

## 15 · Hard no · Operaciones

The lines we won't cross:

- **No editing signed entries.** A signature is permanent; corrections are additive.
- **No hard-deleting origins.** Deactivate, never erase.
- **No skipping firma to save time.** A faster log without a signer is a slower problem later.
- **No mixing KPS slugs with warehouse slugs.** If a tool surfaces both, route each through its own map.
- **No phantom inventory.** Stock not in Notion does not exist. If it's physically present but not logged, it's a logging bug, not "off-book" stock.
- **No off-system prices.** Quotes pull from Productos (Dinero). No "I'll just type it in this once."
- **No reusing the talent app for non-talent flows.** It's a focused mobile-first tool — don't let it accrete responsibilities.
- **No relying on memory for order state.** If Notion says it's not shipped, it's not shipped — regardless of what someone remembers doing.

---

*Last edit: 2026-05-25 · v1.0 · Pairs with `00-kofy-core.md`. Detailed warehouse-system memory exists separately in `warehouse_system.md` — load if doing architecture-level work.*
