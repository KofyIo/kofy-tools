# 01-kofy-contenido.md · Department shard · Contenido (v2 · 2026-06-03)

Load this together with `00-kofy-core.md` when working on the calendar, KPS production system, briefings, guiones, video bank, or anything content-side. Do **not** load it for warehouse / dinero / cliente sessions.

---

## 1 · North star

Contenido exists to keep Kofy producing video at a sustainable rhythm without losing the conexión anchor or burning Leonardo out. Every output passes through KPS. Every output ladders back to one pillar, one layer, one track.

## 2 · Publication rhythm

Lunes · Miércoles · Viernes · Domingo. Four publications per week.

- **Lun** · publicación + briefing grupal (los 4, 10–11h) + pre-producción
- **Mar** · día sagrado grabación (2 videos seguidos)
- **Mié** · bloque edición protegido 8–12h + publicación
- **Jue** · segundo día sagrado grabación
- **Vie** · bloque edición + publicación
- **Sáb** · edición video domingo
- **Dom** · publicación + descanso

Bloques de edición de Leo son **sagrados** — no se interrumpen. Leonardo NUNCA edita un video que se publica al día siguiente. Mínimo 2 videos editados y aprobados en el banco antes de cualquier semana con evento confirmado.

## 3 · Banco de videos · buffer estratégico

Phase 05 approved-but-unpublished pieces sit in the banco. Semanas pre-evento producen 5–6 videos (4 publican + 1–2 al banco). The banco is what protects the rhythm when something goes wrong upstream.

## 4 · The calendar tool · current state

**File:** `calendar.html` · live at `app.kofy.io` · last updated 2026-06-03 (v9).

**Tech:** plain HTML/CSS/JS · no framework · Notion sync via Cloudflare Worker proxy (`https://kofy-notion-proxy.delicate-surf-529c.workers.dev`) · Notion DB ID `3509b62600a080468cbedcaa3b6e4bc6`.

**Data shape per entry (v9):**
```
{id, iso, name, sub, layer, pillar, track, fmt, stage, warn, warnText,
 temas[], vis[], nar[], groups[], notionId,
 type ('produccion'|'otra'), pubIso, archived, description}
```
`vis`, `nar`, `sub`, `temas`, `warn`, `warnText`, `archived`, `type`, `pubIso`, `description` are persisted via `FileLinks.__meta` JSON blob in Notion. `syncFromNotion()` restores all fields from `__meta` on load. New Notion entries not in POSTS are created dynamically on sync (rolling year).

**Tabs:**
1. **Checklist** — dynamic monthly list view, groups by YYYY-MM, all months in POSTS
2. **Calendario** — month grid, navigate any month, KPS overview bar at top
3. **Dias de Rodaje** — jornada cards (still May 2026 — update when June jornadas are defined)
4. **Links y Docs** — file links per category
5. **Puntos** — gamification / leaderboard

**v9 features shipped (2026-06-03):**
- ✅ Click-away data loss fix — unsaved-changes confirm before backdrop/Escape close
- ✅ vis/nar persistence — `FileLinks.__meta` survives page reloads across all devices
- ✅ Soft-delete / archive — "Archivar" per entry, collapsible 🗃 section, "Recuperar"
- ✅ Activity type toggle — 🎬 Producción (full KPS form) vs 📅 Otra (slim: name + date + description + owner)
- ✅ Decouple recording from publish day — optional pubIso field; gold ghost 📅 pill on publish date in grid
- ✅ Rolling year / multi-month — renderCal groups by month dynamically; syncFromNotion creates new entries; _wkFromIso works for any date; header is dynamic
- ✅ June + July seed data (p17–p34) — 3 Producción + 12 Otra entries through 2026-07-05

## 5 · Calendar backlog · v9 COMPLETE (2026-06-03)

All features shipped. No open backlog for this conversation.

### Shipped in second build pass
- ✅ **Briefing template** — fase 01 detail panel shows Objetivo · Concepto · Logística · Sesión grupal + 🔒 Firma KL. Fields editable via edit form, locked once signed.
- ✅ **Plantilla 01 — Briefing Grupal** — "+ Briefing" button in Checklist sync bar. Builds piece list Monday-style, fires all to Notion with 350ms spacing.
- ✅ **Plantilla 02-B — Props gate** — advance to fase 02 auto-populates 6-item Props & Storyboard checklist; advance to fase 03 warns if checklist incomplete (soft confirm, Kafay can override).
- ✅ **Métricas tab** — 6th tab. Summary cards + Registro de Videos table with phase/days-in-production per entry. CSV export → Google Sheets.
- ✅ **Sacred blocks overlay** — Wed/Fri/Sat cells get a purple dot in the month grid. Legend updated.

## 6 · KPS migration map (old → new)

For any module that displays content stages, route through this map. Operational stages (warehouse green-bean CV / E / etc.) are a separate vocabulary — don't conflate.

| Old slug | KPS slug |
|---|---|
| `idea`, `brief` | `briefing` |
| `planning` | `guion` |
| `produccion` | `grabacion` |
| `edicion` | `edicion` |
| `aprobado`, `publicado` | `publicacion` |

## 7 · Files in workspace (Contenido-relevant)

- `calendar.html` — **live tool · v9 · 2026-06-03** (calendar-v8.html promoted, v9 features built in-session)
- `calendar-v8.html` — development file (always mirrors calendar.html after promotion)
- `KPS_Manual.docx` / `KPS_Manual.pdf` — master KPS manual v1.0
- `KPS_Dashboard.html` — visual one-pager of the 5 fases, 5 fugas, semana tipo
- `kofy-brain-complete.md` — consolidated master brain
- `kofy-brain.html` — canonical Master Context Document (HTML wins on disagreement)
- `kofy-the-way.html` / `kofy-el-camino.html` — Golden Circle + Patagonia framework (EN / ES)
- `kofy_mapa_mental.html` — live content mental map (pillars + leaves)
- `kofy_mapa_accion.html` — action-based mental map (status, owner, layer, priority)
- `kofy_resumen_reunion_1.html` — April 2026 meeting summary
- `kofy-calendario-mayo.html` — May 2026 organizational calendar

## 8 · The 5 fugas (why KPS exists)

For context when designing tools — KPS is built to fix specific time leaks:

1. **Fuga 01** · Briefing verbal sin dueño claro → fix: Kafay is the only signer.
2. **Fuga 02** · Storyboard opcional → fix: storyboard for every video, no exceptions.
3. **Fuga 03** · Revisiones con cambios de opinión → fix: one round, critical errors only; preferences go to "Lecciones para próximos videos".
4. **Fuga 04** · Edición en paralelo (future rule, not active with one editor).
5. **Fuga 05** · 50/50 sin bloques protegidos → fix: Leo's edit blocks are sagrados.

Goal: 10–12h/video → 6–8h/video. 1 revision round average. Minimum 2 videos in the banco at all times.

## 9 · Roles in Contenido

- **Director Creativo** (Kafay) · facilita briefing, propone idea base, dirige concepto.
- **Guionista** (Partner / Computer / Gabriela) · escribe guion con indicaciones visuales.
- **Productor / Editor** (Leonardo) · storyboard, props checklist, grabación, edición, entrega.
- **Revisor + Firma** (Kafay) · firma briefing + 1 ronda revisión final + firma publicación.

## 10 · Hard yes · Contenido

The lines we hold:

- **Every video passes through KPS, in order.** Sin atajos, sin excepciones. Skipping a phase is not a shortcut, it's a debt.
- **Kafay signs the briefing + the final revision.** No other signer.
- **Storyboard for every video.** Even short, phone-grade pieces. Storyboard is not the size — it's the discipline.
- **One revision round.** Critical errors only. Preference changes go to "Lecciones para próximos videos" and inform the *next* piece.
- **Leo's edit blocks (Mié / Vie / Sáb) are sagrados.** No interruptions, no "quick favors" during these blocks.
- **Minimum 2 videos in the banco at all times.** No exceptions during event weeks.
- **Lun / Mié / Vie / Dom publication rhythm.** The rhythm is the product. Don't break it for a one-off.
- **Track A and Track B never mix in the same day.** They're different headspaces and different gear flows.
- **One pillar, one layer, one track per piece.** If a piece tries to be everything, it's a brief, not a video.
- **The calendar is canonical.** If it's not in the calendar, it doesn't exist. (Same energy as Notion-as-source-of-truth, applied to content.)

## 11 · Hard no · Contenido

The lines we won't cross:

- **No publishing what was edited the day before.** Leo never edits a video that publishes tomorrow. The banco protects this.
- **No briefings without Kafay's firma.** A "tentative" briefing is not a briefing.
- **No autosave on the calendar tool.** Explicit save, explicit cancel-with-warning. Inputs are the user's decisions — never ours.
- **No data loss tolerated.** If a field doesn't persist to Notion, that's a critical bug, not a polish item. (This shipped as a bug — explicit fix on the v9 list.)
- **No conflating content stages with operational stages.** KPS slugs ≠ warehouse CV/E slugs. Don't reuse either set.
- **No leveraging Venezuelan nationalism or political framing in content.** Origin is craft, never flag.
- **No voice interchangeable with another specialty brand.** If a caption could come from any specialty roaster on Instagram, rewrite.
- **No price or specs before the *why* has been earned.** Applies to every layer of content.
- **No revising opinions during revision.** Kafay's one round is for errors only; opinion shifts wait for the next piece.
- **No "we'll figure out the briefing while shooting."** Phase 02 closes before phase 03 begins.

---

*Last edit: 2026-05-25 · v1.0 · Pairs with `00-kofy-core.md`.*
