# Canvas UX drill-down & catalog plan

Date: 2026-09-03 · Status: **awaiting approval** · Repo: kitchen-planner (CalmKitchen Designer)

Guiding principle (your words, my contract): *Adobe-style* — succinct surface, drill down on click, collapsed stack when nothing is selected, overwhelming never.

---

## 1. Hover tooltips on canvas affordances

**Problem:** the empty dashed pink circles (wall midpoint "+") and other handles are mute.

**Change**
- One shared tooltip `<div class="canvas-tooltip">` inside the plan canvas container (DOM, not Konva — cheap, GPU-free).
- Text per affordance, set on `mouseenter`, positioned above cursor, cleared on `leave`:
  - Wall midpoint dot → **"Add wall point"**
  - Vertex handle → **"Drag to move · Delete to remove"**
  - Opening dot → **"Drag along walls · click to select"**
  - Opening end handle → **"Drag to resize"**
  - Pillar / zone body → **"Drag to move · click to select"**
  - Resize handle → **"Drag to resize · Shift = square"**
  - During placement mode → **"Drag to size · Shift = straighten · Esc = cancel"**

**Files:** `RoomOutlineLayer.tsx` (hover wiring), `styles.css` (tooltip style, ink chip).
**Tests:** unit — none (visual); e2e — assert tooltip text appears on hovering a midpoint dot.

## 2. Adobe-style inspector drill-down (the big one)

**Problem:** selection semantics are split (equipment uses `selectedIds`; space items use local state inside `RoomOutlineLayer`), so the right panel can't react to space selections, and the default panel is a wall of forms.

**Change — three states for the right panel:**

| State | Trigger | Panel shows |
|---|---|---|
| **Nothing selected** | click empty canvas / Esc | **Collapsed stack**: `Room`, `Openings (4)`, `Pillars (1)`, `Zones (1)`, `Equipment (16)` — one-line headers, count badges, click to expand one |
| **Space item selected** | click vertex/opening/pillar/zone | **Single-item inspector** for that item only, with a **Remove** button |
| **Equipment selected** | click item (existing) | EquipmentInspector (already item-only) |

**Mechanism**
- Lift space selection: `PlanWorkspace` holds `spaceSelection: { kind: 'vertex'|'opening'|'pillar'|'zone'; index|id } | null`; `RoomOutlineLayer` receives `selection` + `onSelect` props instead of local state. Right panel branches on it.
- Click-outside (Stage background mousedown, already the deselect path) and Esc clear it.
- Single-item forms reuse the existing field markup from `PolygonRoomEditor`, extracted per kind into small components (`OpeningFields`, `PillarFields`, `ZoneFields`) shared by both the drill-down and the collapsed stack's expanded view.
- Collapsed stack headers: `<details>`-based, one open at a time, count from architecture arrays.

**Files:** `RoomOutlineLayer.tsx`, `PlanWorkspace.tsx`, new `SpaceItemInspectors.tsx`, refactor `PolygonRoomEditor.tsx` to consume the shared field components, `RoomEditorPanel.tsx` becomes the collapsed-stack + drill-down host.
**Tests:** unit — selection wiring (click pillar → panel shows PillarFields; click outside → stack); e2e — click an opening dot, inspector shows its offset field, edit commits live.

## 3. Space catalog: kill the tabs, keep group headers

**Problem:** three tabs for ~15 items is filter ceremony.

**Change**
- Remove the `Openings / Structure / Zones` tab strip entirely.
- One flat, searchable list with **static group headers** (small eyebrows: "Openings", "Structure", "Zones") as list separators — scannable, zero clicks.
- Search input stays (filters across all groups).

**Files:** `WorkflowCatalog.tsx` (`SpaceCatalog`), `styles.css` (group header style).
**Tests:** update `App.test` space-catalog assertions if any reference tabs (currently none do).

## 4. Expand the space catalog to a full commercial-kitchen set

**New catalog entries** (all flow through the existing placement/resize/delete machinery — they're just tags + default dims):

**Openings** — Single door (900), Double door (1800), Sliding door (1200), Staff entrance door (900, flow entry), Clean service window (900, clean-out), Dirty return window (900, dirty-in), Pass-through hatch (600)
**Structure** — Structural pillar (400×400), Round column (⌀500), Wall partition (2400×150), Counter-height divider (1800×900), Soffit/duct marker (1200×600)
**Zones** — Prep zone, Cooking zone, Cold prep zone, Wash & sanitation zone, Dry storage zone, Service pickup zone, Clean corridor, Dirty corridor, No-go zone

**Files:** `kitchen-catalog.ts` (new architecture entries, tags `opening|fixed|obstruction|zone`), catalog test updated with the new count.
**Notes:** round column renders as a square pillar in v1 (plan-true, no circle geometry yet — flagged as accepted debt); doors/windows map to `kind: door|service-window`; corridors are zones with `adjacent: false`.

## 5. Delete key removes any selected item (+ inspector Remove)

**Change**
- Extend the layer keydown (currently vertex-only) to the lifted `spaceSelection`: opening/pillar/zone removal with `Delete`/`Backspace` (guarded by `isTypingTarget`, min-count 0 allowed).
- New helpers: `removeOpening/removePillar/removeZone` in `room-outline.ts` (trivial array filters) + unit tests.
- Inspector drill-down gets a **Remove** button (item 2) — same actions.
- Equipment delete already exists via shortcuts; no change.

## 6–7. Validate Plan / Validate Fit-Out

**Change**
- Stage-contextual button label: `stage === 'space' ? 'Validate Plan' : 'Validate Fit-Out'` (replaces "Check essentials · N"). Same handler (opens the essentials/checker), same aria-label pattern `Validate Plan · N`.
- Right-panel StageOverview CTAs renamed to match.
**Tests:** update unit/e2e references from `/Check essentials/` to `/Validate/` (one e2e spot).

## 8. Reset to last working configuration + parking broken equipment

**Semantics (decision-complete):**
- **"Working" snapshot** per project (not per variant — the room is shared): `{ architecture, equipmentByVariant: Record<variantId, EquipmentItem[]> }` captured **whenever `analyzeLayout` returns zero issues** (debounced 1s so drags don't thrash) and on stage switches away from space/fit-out. Stored **persisted** inside the project JSON under `lastWorking` (schema v4 field, optional, migration-safe) so it survives reloads.
- **Reset button** in the Checks panel beside Auto-fix: "Reset to last working version". One undoable batch:
  1. Restore snapshot architecture + equipment.
  2. For every **current** item whose id is not in the snapshot (added since): keep it, but **park it outside** — staged in a vertical rack to the right of the room (`x = roomWidth + 600`, rows spaced by item depth + 300, y from 300), snapped. Also park snapshot items whose parked position would overlap? No — non-snapshot items only.
  3. Nothing is ever silently deleted by reset.
- **Visibility of parked items:** fit calculation (`pixelsPerMm`) currently uses architecture bounds only → change to the union of room + equipment bounding boxes so parked items are on-screen with the room.
- Snapshot never captures a state that itself has issues (only zero-issue states), so reset always lands somewhere clean.

**Files:** `project-schema.ts` (+`lastWorking`, v4→ migrate), `project-store.ts` (`captureWorkingSnapshot` debounced subscriber + `resetToWorkingSnapshot` action incl. parking), `auto-fix.ts` (`parkOutside` helper + tests), `PlanCanvas.tsx` (fit bounds incl. equipment), `LayoutDiagnostics.tsx` (Reset button), `LayoutWizard`-style one-batch semantics.
**Tests:** unit — snapshot capture on zero-issues, reset restores + parks newcomers outside polygon (assert `!itemInsideRoom` and no overlap with room bbox), persisted round-trip; e2e — break layout, add an item, reset, item visible outside, issues drop to snapshot state.

---

## Execution order (dependency-driven)

1. **Catalog expansion (4) + tab removal (3)** — pure data/UI, unblocks everything else's test fixtures.
2. **Tooltips (1)** — isolated.
3. **Selection lift + inspector drill-down + Remove buttons (2, 5)** — the structural core; touches PlanWorkspace, layer, panels.
4. **Validate renames (6–7)** — trivial, ride along.
5. **Snapshot/reset/parking (8)** — last, builds on the lifted selection + autofix foundations.

## Acceptance gates
- 100% of existing unit suite green + new tests per section above.
- Full e2e green (updated `Validate` labels).
- Manual browser pass on all three inspector states, tooltip texts, delete-on-selection, reset flow with parking.
- Deploy + push.

## Accepted debt (v1)
- Round column renders square.
- Snapshot is project-wide, not per-variant equipment history.
- Parked items get a "parked" visual treatment (muted stroke) — v2 can add a "return to plan" affordance.
