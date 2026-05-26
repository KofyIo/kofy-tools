# Event-hook patch list

This file names every additive line that must be inserted into the existing warehouse HTML files for the comms module to receive events. **Nothing else changes** — no business logic is modified.

Two kinds of insertions per file:

- **L** = the loader `<script>` tag (one per file, just before `</body>`).
- **D** = a `window.dispatchEvent` call at a specific point in the existing JS.

Line numbers are approximate — search by the surrounding code fragment.

---

## A · `<script>` tag — paste in ALL warehouse-*.html files

Add just before the closing `</body>`:

```html
<script src="kofy-comms-loader.js"></script>
```

**Files to patch:**

| # | File | Why |
|---|---|---|
| L1 | `warehouse-ordenes.html`    | Emits 4 events |
| L2 | `warehouse-talent.html`     | Emits stageAdvanced |
| L3 | `warehouse-inventario.html` | Emits stockLow |
| L4 | `warehouse-comms.html`      | (already inline — no change) |
| L5 | `warehouse-miembros.html`   | Reads loader settings; harmless to include |
| L6 | `warehouse-setup.html`      | For test dispatches from setup |
| L7 | `warehouse-yo.html`         | Optional — no events but useful for log access |
| L8 | `warehouse-print.html`      | **Skip** — print views don't need comms |

---

## B · `dispatchEvent` insertions

### B1 · `warehouse-ordenes.html`

#### B1.1 — Inside `createOrder()` after successful Notion `POST /pages`

Find the block where the new order page is created (look for a `notionCreatePage` or `fetch(... '/pages', {method:'POST'...})` followed by `success` / `toast('Orden creada')` / `closeModal()`).

Insert immediately after the success branch, before refreshing the kanban:

```js
window.dispatchEvent(new CustomEvent('kofy:orderCreated', {
  detail: {
    orderId:     createdPage.properties['Order ID']?.title?.[0]?.plain_text || '(sin id)',
    orderPageId: createdPage.id,
    clientId:    formState.clienteId || null,
    clientName:  formState.clienteName || '',
    clientEmail: formState.clienteEmail || null,
    clientPhone: formState.clienteTelefono || null,
    items:       formState.items || [],
    eta:         formState.eta || null,
    createdBy:   getPersona()?.miembroId || null
  }
}));
```

> **Naming note.** Variable names like `createdPage` and `formState` are placeholders — match whatever the existing `createOrder` actually uses. The keys in `detail` are what matters (the loader reads them).

#### B1.2 — Inside `markStageCascade()` after the PATCH success

Find `markStageCascade` (or whatever names the cascade-firma function). After the Notion `PATCH /pages/:id` resolves, before the kanban refresh:

```js
window.dispatchEvent(new CustomEvent('kofy:orderStageAdvanced', {
  detail: {
    orderId:     order.properties['Order ID']?.title?.[0]?.plain_text || '',
    orderPageId: order.id,
    stages:      stagesJustSigned,     // array of codes: ['I'], ['I','CV'], ['E'], ['EN'], etc.
    persona:     getPersona()?.name || '',
    isCascade:   stagesJustSigned.length > 1,
    clientName:  order.properties['Cliente']?.relation?.[0]?.id ? clientLookup[order.properties['Cliente'].relation[0].id]?.name : '',
    clientEmail: clientLookup[order.properties['Cliente']?.relation?.[0]?.id]?.email || null,
    clientPhone: clientLookup[order.properties['Cliente']?.relation?.[0]?.id]?.phone || null
  }
}));
```

> The loader checks `stages` for `'CV'`, `'E'`, `'EN'` and dispatches three sub-triggers from this single event. No extra hooks needed.

#### B1.3 — Inside `cancelOrArchiveOrder()` cancel branch

Find the cancel branch (where the cancellation reason + firma are written). After PATCH success:

```js
window.dispatchEvent(new CustomEvent('kofy:orderCancelled', {
  detail: {
    orderId:     order.orderId,
    orderPageId: order.id,
    clientName:  order.clientName,
    clientEmail: order.clientEmail || null,
    clientPhone: order.clientPhone || null,
    razon:       cancellationReason,
    persona:     getPersona()?.name || ''
  }
}));
```

#### B1.4 — Same function, archive branch

After archive PATCH success:

```js
window.dispatchEvent(new CustomEvent('kofy:orderArchived', {
  detail: {
    orderId:     order.orderId,
    orderPageId: order.id,
    persona:     getPersona()?.name || ''
  }
}));
```

---

### B2 · `warehouse-talent.html`

This is the "Piso" phone app where Leo/Primo sign stages. Same cascade firma logic as ordenes; one event after each cascade.

#### B2.1 — Inside the cascade-firma handler, after PATCH success

```js
window.dispatchEvent(new CustomEvent('kofy:orderStageAdvanced', {
  detail: {
    orderId:     task.orderId,
    orderPageId: task.orderPageId,
    stages:      stagesJustSigned,
    persona:     getPersona()?.name || '',
    isCascade:   stagesJustSigned.length > 1,
    clientName:  task.clientName || '',
    clientEmail: task.clientEmail || null,
    clientPhone: task.clientPhone || null
  }
}));
```

---

### B3 · `warehouse-inventario.html`

The polling loop already reads stock; we need a single event the first time each origen/empaque crosses below threshold (don't spam on every refresh).

#### B3.1 — Inside the stock-status render function (or polling tick)

Wrap the threshold check in a debounce-by-id (the loader also dedupes, but doubling up is cheap):

```js
// At the top of the file or inside the inventario module:
const _stockAlerted = new Set();

// Inside the loop that iterates orígenes after polling:
for (const o of origenes) {
  const kg = computeKgRemanente(o);   // existing function
  const umbral = (window.KofyComms?.loadSettings()?.stockUmbralOrigenKg) ?? 10;
  if (kg < umbral && !_stockAlerted.has('o:' + o.id)) {
    _stockAlerted.add('o:' + o.id);
    window.dispatchEvent(new CustomEvent('kofy:stockLowOrigen', {
      detail: {
        origenId:    o.properties['ID Origen']?.title?.[0]?.plain_text || '',
        origenName:  o.properties['Hacienda']?.rich_text?.[0]?.plain_text || '',
        kgRemanente: kg,
        umbral
      }
    }));
  }
  if (kg >= umbral * 1.2) _stockAlerted.delete('o:' + o.id); // clear when restocked w/ buffer
}
```

#### B3.2 — Same pattern for empaques

```js
for (const e of empaques) {
  if (e.stock <= e.umbral && !_stockAlerted.has('e:' + e.id)) {
    _stockAlerted.add('e:' + e.id);
    window.dispatchEvent(new CustomEvent('kofy:stockLowEmpaque', {
      detail: {
        empaqueId: e.id,
        bind:      e.bind || e.nombre,
        stock:     e.stock,
        umbral:    e.umbral
      }
    }));
  }
  if (e.stock > e.umbral * 1.2) _stockAlerted.delete('e:' + e.id);
}
```

---

## C · Notes for the warehouse Claude doing the integration

1. **Don't refactor any function** to make these hooks fit. If the existing code already has a refresh callback after the success branch, the dispatchEvent goes right next to it — that's the whole pattern.
2. **The detail payload keys are the contract.** Renaming them silently breaks the loader. Use the exact keys above.
3. **If a value isn't readily available**, pass `null` rather than skipping the key. The loader handles missing fields gracefully (logs `skipped` if it can't resolve a recipient).
4. **For `clientEmail` / `clientPhone`**, the simplest implementation is to add `Email`/`WhatsApp` lookups to whatever client-fetch helper already exists. Migration A in `kofy-comms-setup-additions.md` adds those Notion fields; the existing client-fetch in ordenes already needs them.
5. **No "comms is broken" rollback story is needed.** If the loader fails to load (CDN issue, console error), the warehouse keeps working — events fire into the void and nothing else happens.

---

## D · One-liner per file · final tally

| File | Lines added |
|---|---|
| `warehouse-ordenes.html`    | 1 script tag + 4 dispatchEvent blocks |
| `warehouse-talent.html`     | 1 script tag + 1 dispatchEvent block |
| `warehouse-inventario.html` | 1 script tag + 2 dispatchEvent blocks (≈10 lines each w/ dedupe) |
| `warehouse-miembros.html`   | 1 script tag |
| `warehouse-setup.html`      | 1 script tag + migrations (see setup-additions) |
| `warehouse-yo.html`         | 1 script tag (optional) |
| `warehouse-comms.html`      | (no change — loader is already referenced) |
| `warehouse-print.html`      | none |

Net: ~40 lines of additions across 6 files. Zero modifications to existing logic.
