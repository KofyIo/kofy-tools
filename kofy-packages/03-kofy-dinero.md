# 03-kofy-dinero.md · Department shard · Dinero (v1 · 2026-05-25)

Load this together with `00-kofy-core.md` when working on the ledger, tasa BCV, cuentas, productos catalog, pricing, B2B terms, or the milk cost model. Do **not** load it for content / operaciones / cliente sessions unless dinero is being wired in.

---

## 1 · North star

Dinero is the source of truth for money. Every order that ships moves the ledger. Every price quoted comes from the Productos catalog. Tasa BCV is read daily — never assumed. We don't make economic claims without numbers behind them, and we don't quote price before the brand value has been earned.

## 2 · Current state · parallel-session build

The Dinero module was delivered as a baseline by a parallel Claude session on 2026-05-21. Baseline is complete but **not yet deployed**. Detailed memory exists at `dinero_parallel_session.md`.

**Pending deployment steps (7-step sequence, all gated before warehouse can wire in):**

1. Move 7 files from `uploads/` → workspace
2. Create 4 blank Notion DBs + share with the integration
3. Run 8 migrations via the setup runner
4. Seed Cuentas + today's Tasa
5. Populate Productos catalog + backfill Quintales precio
6. Add Dinero loader script tags to `warehouse-ordenes` + `warehouse-talent`
7. End-to-end verify with a test order

These steps run in order. Don't skip.

## 3 · Key economic numbers (Line 02 · milk cost model)

From `kofy-milk-cost-model.html` (v4) — the canonical cost model.

**Defaults:**
- Cow care: $150/head/month
- Labour: $300/month (fixed, **shared across Line 01 + Line 02**)
- Packaging: $0.125/sachet
- Logistics: $0.40/sachet (MRW flat baseline)
- B2B price: $3.25/sachet

**The insight that drives the model:** labour is a fixed shared cost across both lines. Additional cows generate **near-pure contribution margin** because the labour cost is already absorbed by the first cow.

**Per-cow yield math:**
- 135g powder per 1L sachet (13.5% TS)
- 1.08L raw Jersey milk per sachet
- 8.5L raw → 1kg powder
- 1 cow → ~300L/month → ~264 sachets/month (3 cycles, ~88 sachets/cycle, ~30L concentrate/cycle at 40% TS)

**Café equivalency:** 70 cafés per kg of coffee · 200ml milk per café · 14L milk per kg coffee.

**Margins by herd size:**
- 1 cow ≈ break-even vs buying milk at $0.50/L. **Ownership is a supply-security play, not a savings play at this scale.**
- 2 cows ≈ ~49% margin vs ~31% — the second cow is the inflection point.
- 3+ cows: margin advantage compounds.

## 4 · MRW rate reference (logistics)

Cross-country baseline (intrazone is cheaper):

| Weight | Price |
|---|---|
| ≤ 1 kg | $4 |
| ≤ 3 kg | $6.50 |
| ≤ 5 kg | $10 |
| ≤ 10 kg | $15 |
| ≤ 20 kg | $24 |
| ≤ 30 kg | $32 |
| ≤ 50 kg | $48 |

## 5 · Tasa BCV

USD/Bs rate from the Banco Central de Venezuela, updated daily. Every order calculation references that day's tasa. Dinero stores tasa as a first-class entity — orders pull the day's tasa at the moment of creation, not the moment of fulfillment.

## 6 · Productos catalog

The price source for everything sellable — coffee SKUs (by line, by format), milk sachets, B2B vs retail tiers. Warehouse `orders` reads from this catalog at order-creation time. **Don't change prices anywhere else.** If a price moves, it moves in Productos and the change is logged.

## 7 · Cuentas

First-class accounting entities — bank accounts, cash, pending receivables, vendor balances. Every ledger entry hits a cuenta. Reconciliation lives in Dinero, not in warehouse.

## 8 · Hard yes · Dinero

The lines we hold:

- **Tasa BCV is read fresh daily.** Yesterday's tasa is yesterday's number. Don't assume it carries.
- **Productos is the only price source.** A price quoted from anywhere else is wrong by definition.
- **Every shipped order touches the ledger.** No exceptions. A shipped order without a ledger entry is a bug.
- **Cuentas are first-class.** Every ledger entry hits a cuenta. No phantom transactions.
- **Line 01 and Line 02 economics are separate.** Don't blend them in a single calc unless you're modeling the shared-labour synthesis explicitly.
- **The second cow is the inflection.** This is real math — say it confidently when relevant.
- **Margin claims need numbers.** Don't say "high margin" — say the percentage and the inputs.

## 9 · Hard no · Dinero

The lines we won't cross:

- **No price quoted before the why has been earned.** This is in the core but it applies hardest in Dinero — pricing copy that leads with the number is a brand violation.
- **No price changes outside Productos.** Even a one-off custom quote runs through a B2B record that references Productos.
- **No ledger entries without a signer / source.** Every entry has a "who created this" and a "what triggered this."
- **No mixing tasa days.** An order created today uses today's tasa. If it fulfills tomorrow, the price stays — we don't retroactively re-tasa.
- **No "Venezuelan economy" framing in customer-facing copy.** The economic context is internal — never used as a sympathy lever or a political point.
- **No vague margin language** ("good margin", "healthy unit economics") without the underlying calc.

## 10 · Files in workspace (Dinero-relevant)

- `kofy-milk-cost-model.html` (v4) — canonical milk cost model
- Dinero baseline files (from parallel session, in `uploads/` pending the deployment sequence)
- Related memory: `dinero_parallel_session.md`

## 11 · Pending integration with other departments

- **Operaciones** · Dinero loader script tags pending on `warehouse-ordenes` + `warehouse-talent`. Step 6 of the deployment sequence.
- **Contenido** · No direct integration today. If content is ever paywalled or B2B-licensed, route through Productos.
- **Cliente** · Lead → order → Productos lookup → ledger entry. Today the lead-to-order step is manual.

## 12 · Roles in Dinero

- **Kafay** · approves price changes, signs B2B terms, owns the model
- **Partner** · pricing analysis support, B2B negotiation when applicable
- **Leo / JOSE** · don't touch Dinero; they trigger ledger entries indirectly through warehouse actions

---

*Last edit: 2026-05-25 · v1.0 · Pairs with `00-kofy-core.md`. Detailed parallel-session context in `dinero_parallel_session.md`.*
