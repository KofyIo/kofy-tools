# Warehouse v2 backlog · status snapshot

*Last update: 2026-05-28 · Original list dictated by Kafay 2026-05-18 · Source memory: `warehouse_v2_backlog.md`*

Status snapshot of the 14 v2 improvements dictated after warehouse v1 went live, plus items added since. Upload alongside `02-kofy-operaciones.md` when working on warehouse / Operaciones.

**System-wide principle:** Móvil-first. Todo el v2 se diseña para uso en el teléfono en el warehouse on-the-go.

---

## The 14 items

### Quick wins · foundation

| # | Item | Status |
|---|---|---|
| 1 | **Selector de persona al entrar** — Kafay / Partner / Leo / Primo, localStorage, no real login. Firma de la sesión se asume automática. Cambiar persona = un click en el header. | ✅ done |
| 2 | **Tab rename** — "Yo" → "The Game" (mantiene convención: labels en inglés para conceptos) | ✅ done |
| 3 | **Desactivar orígenes** — botón en cada origen para dar de baja. Estado desactivado: no aparece en dropdowns, no genera alertas, no se elimina (preserva historial). Toggle "Mostrar inactivos". | ✅ done |
| 4 | **Sistema refleja realidad** — discipline rule: ninguna transición de etapa se auto-avanza. Toda transición requiere acción humana explícita. Event-driven por humanos, no state-machine automático. | ✅ done (by design) |

### Order flow upgrades

| # | Item | Status |
|---|---|---|
| 5 | **Detalle de orden enriquecido** — click en card del Kanban abre vista con order ID, cliente, RIF, fechas, items completos (cant / presentación / tostado / molienda / origen), notas QC, notas tostador, historial de firmas por etapa con fechas. | ✅ done |
| 6 | **Saltar etapas con firma en cascada** — si la persona logueada marca etapa 4 directamente, el sistema firma automáticamente las etapas 1, 2, 3 anteriores con la misma persona / fecha. | ✅ done |
| 7 | **Lista (no drag & drop) para mover orden entre etapas** — al hacer click en orden, opciones de avanzar como lista de botones. Más amigable en móvil. | ✅ done (by design) |
| 8 | **Items: 4 opciones unificadas de molienda** — Molienda fina *(espresso casero · greca / Moka italiana)* · Molienda gruesa *(AeroPress · filtro · prensa francesa)* · Espresso profesional · Grano entero. Reemplaza el viejo Grano / Molido. | ✅ done |

### Schema + math

| # | Item | Status |
|---|---|---|
| 9 | **Math de merma por tostado** — AN (Aurora Nordics, claro) → 15% pérdida · CM (medio) → 15% · MT (oscuro) → 20%. Grado A y Single O heredan el % del tostado default del origen. Al crear orden de X kg tostados, sistema reserva X / (1 − merma%) de verde. Banner live en Nueva Orden + per-item en detalle. | ✅ done |
| 10 | **B2B / cuentas recurrentes** — clientes como PETIT con pedidos ~cada 10 días. Misma pestaña de Órdenes, pero al seleccionar cliente B2B el form pre-llena el "pedido estándar". Campo nuevo en Clientes: tipo "B2B" + pedido estándar guardado. Save desde detalle + use desde Nueva Orden. | ✅ done |

### Nuevas capas

| # | Item | Status |
|---|---|---|
| 11 | **Inventario de empaque** — DB + CRUD ✅. Auto-deducción al pasar a "Empaquetado": `previewPackagingFor()` calcula deducción por bind, `executePackagingDeduction()` parchea Notion. Confirmation dialog con warnings de stock insuficiente. | ✅ done |
| 12 | **Sistema de notificaciones** — `kofy-comms-loader.js` (event bus) + `kofy-worker-v4.js` (`POST /notify` route). Events wired in `warehouse-ordenes.html`, `warehouse-talent.html`, `warehouse-inventario.html`. Email live via MS Graph. WhatsApp ready, pending Meta Business registration approval. | ✅ done (WhatsApp ⏳ Meta) |

### Entregables separados · mini-proyectos

| # | Item | Status |
|---|---|---|
| 13 | **Versión imprimible warehouse** — `warehouse-print.html` · soporta `?type=order|origen&id=XXX` · botones en detalle de orden y card de origen. Log físico para usar durante el turno; al final se vuelca al sistema. | ✅ done |
| 14 | **Talent app simple** — `warehouse-talent.html`. Versión separada, sin info de management, sin alertas globales, sin dashboard. Solo: "qué tengo que hacer ahora, lo firmé, listo." Para Leo y Primo en el piso. | ✅ done |

---

## Original 14: ALL DONE ✅

The full original backlog is complete as of 2026-05-26.

---

## Items added to Operaciones AFTER the original 14

These are real pending warehouse-side deliverables, not part of the 2026-05-18 list:

| Item | Status | Notes |
|------|--------|-------|
| **`warehouse-reportes.html`** | 🔴 not started | Daily reports view — build from scratch |
| **`warehouse-cliente.html`** | 🔴 not started | Customer portal — build from scratch |
| **Dinero wiring into warehouse** | ⏳ blocked | Adds loader script tags to `warehouse-ordenes` + `warehouse-talent`. Gated on full Dinero deployment (prior 5 steps). Do at end of Dinero session. |

---

## Final files of the warehouse system (current names as of 2026-05-26)

- `warehouse-notion-schema.html` (schema reference doc — unchanged)
- `setup.html` (was `warehouse-setup.html`)
- `miembros.html` (was `warehouse-miembros.html`)
- `orders.html` (was `warehouse-ordenes.html`)
- `inventory.html` (was `warehouse-inventario.html`)
- `game.html` (was `warehouse-yo.html` / The Game)
- `print.html` (was `warehouse-print.html`)
- `comms.html` (was `warehouse-comms.html`)
- `warehouse.html` (floor app — new, was `warehouse-talent.html` concept)
- `warehouse-reset.html` (new utility)

**Pending additions:** `warehouse-reportes.html`, `warehouse-cliente.html`.

---

## How to use this file

- Lives at: `C:\Users\megao\OneDrive\Desktop\SYSTEMS 2.0\docs\warehouse-v2-backlog-status.md`
- Upload alongside `00-kofy-core.md` + `02-kofy-operaciones.md` + `05-kofy-tools.md` whenever starting a warehouse / Operaciones session.
- Update this file when an item closes or a new item is added — keep the date at the top current.
- The hard-yes / hard-no for Operaciones lives in `02-kofy-operaciones.md` sections 14–15. Don't duplicate here.
