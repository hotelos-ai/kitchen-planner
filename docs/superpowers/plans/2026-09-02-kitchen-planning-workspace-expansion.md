# Kitchen Planning Workspace Expansion Implementation Plan

**Implementation status:** Complete and verified on 2026-09-02. The requirement-by-requirement evidence is recorded in `docs/superpowers/audits/2026-09-02-kitchen-planning-workspace-expansion-completion-audit.md`.

> **Execution contract:** Implement this plan task by task with red-green-refactor discipline. Every behavioral task begins with a focused failing test, records the expected failure, implements the smallest complete behavior, reruns the focused tests, and finishes with the relevant regression suite. Commit only coherent green slices.

**Goal:** Turn Kitchen Planner into a resilient fullscreen commercial-kitchen planning workspace with one strict atomic operation boundary shared by human UI and future agents, a broad domain catalog, command-backed layout creation, trustworthy simulation preflight and metrics, deterministic cancellable auto-layout experiments, complete variant-aware persistence, and reliable first/third-person walkthroughs.

**Architecture:** Keep the serializable spatial document and operation service domain-neutral. Move room architecture into layout variants so alternatives are self-contained. A kitchen domain module supplies catalog entries, operational requirements, simulation assumptions, procedural visuals, and optimization rules. Every mutation is normalized and previewed against an isolated document, then committed through one revision/document-bound transaction. React owns transient UI only; Konva and Three.js render stable IDs from the document and never become mutation authorities. Long-running search executes behind a deterministic Worker protocol and cannot mutate the project until adoption.

**Tech stack:** React 19, TypeScript 6, Zod 4, Zustand 5, Konva/react-konva, Three.js/react-three-fiber/Drei, Web Workers, Vitest/Testing Library, Playwright, Vite.

## Global constraints

- Product and package identity remain **Kitchen Planner** / `kitchen-planner`; Manta Raja remains only the bundled example and seed layout.
- Do not add tracked references to prohibited legacy product names.
- Preserve stable component IDs, existing projects, unrelated user changes, selection, persistent canvas identity, overview camera state, and live simulation state wherever the specification requires continuity.
- Store canonical geometry in millimetres. Convert to metres only at the Three.js boundary.
- Controlled schemas use strict objects and reject unknown fields at every nested boundary.
- Every variant-scoped operation carries an explicit `variantId`; never infer the active variant inside the public operation boundary.
- All project mutations use the same workspace facade. UI helpers may wrap it but may not mutate Zustand project data directly.
- Preview is non-mutating. Apply is revision/document-bound, single-use, atomic, one revision, and one undo checkpoint.
- Physical configuration changes geometry/capabilities/clearance/model structure. Appearance skins never change geometry or simulation semantics.
- Simulation and optimization state assumptions and evidence and never claim regulatory certification or universal optimality.
- Optimization is deterministic, cancellable, constraint-first, budget-bounded, and non-mutating until adoption.
- Normal and simulation walkthroughs use the same spawn, player, camera, collision, view-model, and recovery policies.
- Keep the application usable and all completed regression suites green at every commit.

## Baseline and completion gates

Record the baseline before edits:

- `npm test` — expected current baseline: 50 files / 163 tests.
- `npm run lint` — warnings are not failures, but do not add new warnings.
- `npm run build` — must pass.
- `npm run e2e` — install the pinned Chromium runtime first when absent; expected current baseline is 6 scenarios.
- Run the required prohibited-identity search from the approved delivery instructions; it must return no tracked matches.

Final completion requires all focused suites plus the complete unit/component suite, lint, production build, full Playwright suite, representative desktop and narrow visual inspection, one requirement-by-requirement audit against the approved specification, clean tracked-content identity search, and a successful push to `origin/main`.

---

## Slice 1 — 3D and Walk reliability

### Task 1: Make walk spawn resolution total and deterministic

**Files:**

- Modify: `src/features/scene/walk/walk-collision.ts`
- Modify: `src/features/scene/walk/walk-collision.test.ts`
- Create: `src/features/scene/walk/walk-spawn.ts` if separation keeps collision focused

**Contract:** Replace throwing `findD2Spawn` with `resolveWalkSpawn`, returning a discriminated `ready | unavailable` result. Prefer an unobstructed declared staff entry, then scan deterministic interior cells with player-radius clearance. Fully obstructed or malformed rooms return a targeted reason and never throw.

- [ ] Add failing tests for missing entry with valid interior fallback, blocked entry with valid fallback, fully occupied room, polygon containment, player-radius clearance, and deterministic repeatability.
- [ ] Run `npm test -- src/features/scene/walk/walk-collision.test.ts` and confirm failures describe current throws/limited search.
- [ ] Implement entry-first resolution plus deterministic whole-interior search without exceptions.
- [ ] Retain a compatibility wrapper only if existing callers require it; migrate all callers in Task 2.
- [ ] Rerun walk geometry/motion/input tests.

### Task 2: Preserve overview 3D when Walk is unavailable

**Files:**

- Modify: `src/features/scene/walk/FirstPersonController.tsx`
- Modify: `src/features/scene/walk/WalkScene.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`
- Modify: `src/features/simulation/simulation-workspace.test.tsx`
- Create: `src/features/scene/walk/walk-availability.test.tsx`

**Contract:** Walk setup failure is local state, not a render exception. The Canvas, kitchen overview, camera, selection, simulation result, and playback remain mounted. Normal and simulation walkthroughs show identical targeted guidance and retry after geometry changes or explicit retry. Leaving Walk clears walk-local failure state.

- [ ] Write failing normal/simulation component tests for missing and fully blocked entries, overview renderer identity, targeted guidance, exit/reset, and retry.
- [ ] Add a shared `onAvailabilityChange`/status result between controller, `WalkScene`, and hosts.
- [ ] Do not mount the controller or hands when spawn is unavailable; keep overview content and Canvas alive.
- [ ] Ensure changing from simulation Walk to overview preserves elapsed time/result.
- [ ] Run scene and simulation focused suites.

### Task 3: Unify scene failure classification and retry

**Files:**

- Create: `src/features/scene/ResilientSceneBoundary.tsx`
- Create: `src/features/scene/scene-recovery.test.tsx`
- Modify: `src/features/scene/SceneCanvas.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`
- Modify: `src/app/styles.css`
- Modify: `e2e/kitchen-lab.spec.ts`

**Contract:** Distinguish unsupported/unavailable WebGL, graphics-context loss, invalid walkthrough setup, and unexpected child failure. Context loss offers renderer restart; unexpected failure offers retry; neither changes the project. Both 3D hosts use the same behavior.

- [ ] Add failing tests for unsupported WebGL, context loss/restoration, repeated loss, unexpected child error/retry, and retained project/simulation state.
- [ ] Extract a reusable recovery boundary with reset key and accessible messages/actions.
- [ ] Keep Walk-unavailable status outside the unexpected-error boundary.
- [ ] Extend Playwright to prove invalid Walk never removes overview and both hosts recover.
- [ ] Run all scene/simulation tests, lint, and build.
- [ ] Commit slice: `fix: keep 3d available when walk setup fails`.

---

## Slice 2 — Shared atomic workspace API

### Task 4: Introduce the variant-complete schema-v2 document

**Files:**

- Modify: `src/domain/project.ts`
- Modify: `src/domain/project-schema.ts`
- Modify: `src/domain/project-schema.test.ts`
- Modify: `src/domain/seed-project.ts`
- Modify: `src/domain/seed-project.test.ts`
- Modify: `src/domain/spatial-adapter.ts`
- Modify: `src/core/spatial/types.ts`
- Modify: `src/state/persistence.ts`
- Modify: `src/state/persistence.test.ts`

**Contract:** Each layout variant owns complete architecture and equipment, plus optional operational profile, layout constraints/locks, and adopted experiment manifest. Components carry explicit physical configuration and optional appearance skin. Migrate schema-v0 and current schema-v1 projects deterministically to schema v2 without losing IDs, equipment, scenarios, active IDs, or the seed layout.

- [ ] Add failing v1 migration and two-variant round-trip fixtures with distinct architecture, configurations, skins, scenarios, constraints, manifests, and active IDs.
- [ ] Export strict reusable component, architecture, appearance, scenario, operational-profile, constraint, and manifest schemas.
- [ ] Move/copy global v1 architecture into every migrated variant; update active-variant architecture reads throughout tests and adapters.
- [ ] Adopt `kitchen-planner:*` persistence keys while reading legacy Manta Raja keys as migration fallback.
- [ ] Reject unknown new fields and unsupported future versions.
- [ ] Run schema, seed, persistence, geometry, scene, and simulation regression suites.

### Task 5: Define strict, friendly, variant-targeted operations

**Files:**

- Replace/extend: `src/core/commands/layout-command.ts`
- Modify: `src/core/commands/layout-command.test.ts`
- Create: `src/core/workspace/workspace-operation.ts`
- Create: `src/core/workspace/workspace-operation.test.ts`
- Modify: `src/core/index.ts`

**Contract:** Define strict schemas for `create_layout`, `activate_layout`, `rename_layout`, `remove_layout`, `add_component`, `add_custom_component`, `configure_component`, `skin_component`, `move_components`, `nudge_components`, `rotate_components`, `resize_component`, `duplicate_components`, `lock_components`, `remove_components`, `update_architecture`, `update_scenario`, and `adopt_auto_layout_result`. All controlled nested objects reject unknown fields. Every layout-scoped operation includes `variantId`.

- [ ] Add schema tests for every accepted operation and malformed/unknown-field variants.
- [ ] Prove an item ID that exists only in the active variant cannot satisfy an operation targeting another variant.
- [ ] Whitelist mutable component/scenario/architecture fields; remove arbitrary record merge patches from the public boundary.
- [ ] Normalize units, rotations, duplicate IDs, catalog adds, timestamps, and defaults deterministically.

### Task 6: Execute ordered batches against isolated candidates

**Files:**

- Modify: `src/core/commands/execute-layout-command.ts`
- Modify: `src/core/commands/execute-layout-command.test.ts`
- Create: `src/core/workspace/execute-workspace-batch.ts`
- Create: `src/core/workspace/execute-workspace-batch.test.ts`
- Modify: `src/domain/spatial-adapter.ts`

**Contract:** Resolve the explicit target variant per operation. Fail locked/non-movable/non-removable targets instead of silently skipping. A batch applies ordered normalized operations to one isolated clone, returns failing index/cause on error, validates the complete candidate, preserves the input, and reports base revision + 1 only once.

- [ ] Add failing tests for second-operation rollback, cross-variant targeting, locks, duplicate stable IDs, malformed candidates, and changed-ID deduplication.
- [ ] Use full strict domain validation rather than the current partial item guard.
- [ ] Preserve unaffected IDs and deterministic normalized add IDs between preview and apply.
- [ ] Run command/core/domain tests.

### Task 7: Add document-bound atomic store transactions

**Files:**

- Modify: `src/state/project-store.ts`
- Modify: `src/state/project-store.test.ts`
- Modify: `src/state/history.ts`

**Contract:** Store state owns an in-memory document incarnation ID that changes on import/replacement. `commitProjectCandidate(candidate, expectedRevision, expectedDocumentId)` fully validates and commits once, adds one history checkpoint, increments revision once, clears redo, and preserves selection only for surviving IDs. Competing edits, undo, redo, and replacement invalidate older preview bindings.

- [ ] Add failing tests for one batch/one undo entry, stale revision, wrong document ID, invalid candidate, undo/redo revision movement, replacement identity rotation, and selection cleanup.
- [ ] Ensure raw replacement validates or is kept private behind a validated service.
- [ ] Keep transient preview/camera/drawer state out of persistence.

### Task 8: Implement expiring single-use preview tokens and the workspace facade

**Files:**

- Create: `src/core/workspace/preview-registry.ts`
- Create: `src/core/workspace/preview-registry.test.ts`
- Create: `src/core/workspace/workspace-facade.ts`
- Create: `src/core/workspace/workspace-facade.test.ts`
- Modify: `src/core/application/types.ts`
- Modify: `src/core/application/application-service.ts`
- Modify: `src/core/index.ts`

**Contract:** Expose `getComponentCatalog`, `getLayoutRequirements`, `suggestPlacement`, `previewLayoutChanges`, `applyLayoutChanges`, `runSimulation`, `runAutoLayout`, and `cancelRun`. Successful preview returns normalized operations, changed IDs, diagnostics delta, and an opaque cryptographic ten-minute token bound to document incarnation, revision, candidate, and operation kind. Apply is single-use on success and one atomic store commit.

- [ ] Add injectable clock/token generator tests for expiry, replay, competing edit, undo, import/replacement, wrong document, wrong kind, stale revision, and failed-apply non-consumption policy.
- [ ] Add non-mutation assertions covering project reference, revision, history, selection, and rendered subscribers.
- [ ] Add UI-style caller vs simulated-agent caller equality tests proving identical final JSON and history.
- [ ] Keep facade/core free of React, DOM, Konva, Three.js, and Worker globals.

### Task 9: Route existing human mutations through the facade

**Files:**

- Create: `src/core/workspace/WorkspaceProvider.tsx`
- Modify: `src/state/project-store.ts`
- Modify: `src/features/editor/PlanCanvas.tsx`
- Modify: `src/features/editor/EquipmentInspector.tsx`
- Modify: `src/features/editor/EquipmentConfigurationField.tsx`
- Modify: `src/features/editor/LayoutVariants.tsx`
- Modify: `src/features/editor/ProjectSettings.tsx`
- Modify: `src/features/simulation/ScenarioEditor.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`

**Contract:** UI invokes convenience methods that internally perform the same preview/apply operations as future agents. Selection remains transient. Stable keys and persistent hosts ensure affected geometry patches without canvas or camera resets.

- [ ] Add failing integration tests for drag, resize, configure, scenario update, and variant action equality through the facade.
- [ ] Preserve gesture responsiveness with a synchronous local preview/apply convenience path over the same public operations.
- [ ] Assert Canvas/renderer identity, camera state, stable component keys, and unaffected IDs after a multi-operation apply.
- [ ] Run full unit/component suite, lint, and build.
- [ ] Commit slice: `feat: add atomic variant-targeted workspace operations`.

---

## Slice 3 — Fullscreen editor and rapid editing

### Task 10: Build a persistent viewport-filling workspace shell

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Modify: `src/features/editor/PlanWorkspace.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Create: `src/app/workspace-layout.test.tsx`
- Modify: `e2e/kitchen-lab.spec.ts`

**Contract:** The shell is `100dvw × 100dvh`. Active Plan/3D/Split/Simulate/Compare surface fills remaining viewport. Left/right drawers are collapsible overlays on narrow screens and resize the stage on desktop without remounting the active canvas, losing selection, resetting camera, or restarting simulation.

- [ ] Add failing DOM/Playwright bounding-box and renderer identity tests at desktop and narrow widths.
- [ ] Introduce persistent surface hosts or state-preserving visibility instead of destructive conditional remounts where continuity is required.
- [ ] Implement accessible drawer toggles, focus management, visible focus rings, and Escape-close ordering.

### Task 11: Replace variant select with accessible layout tabs

**Files:**

- Rewrite: `src/features/editor/LayoutVariants.tsx`
- Create: `src/features/editor/layout-variants.test.tsx`
- Modify: `src/app/styles.css`

**Contract:** Chrome-style tablist with active state, inline rename, close, nearest-survivor activation, last-tab protection, horizontal overflow, roving keyboard focus, Home/End and arrow navigation, and `+` wizard action. Closing is undoable and non-blocking.

- [ ] Add failing accessibility/keyboard/rename/close/overflow/last-tab tests.
- [ ] Use facade layout operations for all mutations.
- [ ] Surface an Undo toast/action after close.

### Task 12: Centralize shortcuts and editing gestures

**Files:**

- Create: `src/features/editor/useWorkspaceShortcuts.ts`
- Create: `src/features/editor/workspace-shortcuts.test.tsx`
- Modify: `src/features/editor/PlanWorkspace.tsx`
- Modify: `src/features/editor/EquipmentNode.tsx`
- Modify: `src/features/editor/PlanCanvas.tsx`
- Modify: `src/features/editor/EquipmentInspector.tsx`
- Create: `src/features/editor/ComponentContextMenu.tsx`
- Create: `src/features/editor/QuickConfigurationPopover.tsx`

**Contract:** Support Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y, delete/backspace, Cmd/Ctrl+D, snap arrows, coarse Shift+arrows, Escape, and `[`/`]` across Plan and 3D. Suppress inside input, textarea, select/native controls, and contenteditable. Single click selects, double click configures, right click exposes specified actions without gesture conflicts. Remove rotation dropdown and Konva free-rotation handle; retain explicit left/right buttons.

- [ ] Add failing shortcut suppression and gesture arbitration tests.
- [ ] Centralize dispatch through facade operations.
- [ ] Add accessible menus/popovers with keyboard dismissal and focus return.
- [ ] Run editor/scene tests and Playwright editing flow.
- [ ] Commit slice: `feat: add fullscreen rapid layout editing`.

---

## Slice 4 — Component catalog

### Task 13: Create the domain-owned commercial kitchen catalog

**Files:**

- Create: `src/domain/catalog/types.ts`
- Create: `src/domain/catalog/kitchen-catalog.ts`
- Create: `src/domain/catalog/kitchen-catalog.test.ts`
- Create: `src/domain/catalog/storage-catalog.ts`
- Modify: `src/domain/equipment-configurations.ts`
- Modify: `src/features/scene/equipment/equipment-visual-registry.tsx`

**Contract:** Every entry has stable catalog/family IDs, category, description, synonyms, typical/min/max dimensions, capabilities/capacity, clearance, intended approach face, placement rules, physical configurations, compatible appearance skins, footprint metadata, tags, and modular 3D constructor key. Cover cooking/hot-line; ovens/holding; refrigeration/ice; prep machines/tables; beverage/service; warewashing/sanitation; waste/janitorial; ventilation/utilities; architecture; and storage.

- [ ] Add catalog integrity tests for uniqueness, strict schemas, reference validity, dimensions, capabilities, placement metadata, and renderer coverage.
- [ ] Add first-class wall shelves, overshelves, freestanding/mobile shelves, dunnage racks, ingredient/bin storage, pot/dish/tray racks, and overhead storage.
- [ ] Keep `custom` as an explicit escape hatch.

### Task 14: Separate physical configurations from appearance skins

**Files:**

- Create: `src/domain/catalog/appearance-skins.ts`
- Create: `src/domain/catalog/appearance-skins.test.ts`
- Modify: `src/domain/equipment-configurations.ts`
- Modify: `src/features/scene/equipment/materials.ts`
- Modify: equipment visual components under `src/features/scene/equipment/`
- Modify: `src/features/scene/walk/walk-collision.ts`

**Contract:** Physical configuration may change dimensions, structure, mobility, mounting, tiers, elevation, capabilities, clearance, footprint, and collision. Appearance skin changes finish/material/colour/wear/branding only. Elevated storage does not become a floor obstruction; floor/mobile storage does.

- [ ] Add geometry/capability invariance tests for skins and structure-change tests for physical configurations.
- [ ] Add storage collision tests distinguishing wall/overhead from floor-mounted obstruction.
- [ ] Add renderer descriptor/snapshot coverage for families, storage, configs, and skins.

### Task 15: Build searchable gallery and deterministic placement

**Files:**

- Rewrite: `src/features/editor/EquipmentLibrary.tsx`
- Create: `src/features/editor/equipment-catalog.test.tsx`
- Create: `src/domain/catalog/suggest-placement.ts`
- Create: `src/domain/catalog/suggest-placement.test.ts`
- Modify: `src/features/editor/PlanCanvas.tsx`
- Modify: `src/features/editor/EquipmentInspector.tsx`

**Contract:** Gallery supports full-text/synonym search, categories, capability filters, visual cards, empty state, one-click deterministic placement/select, preferred-point drop, configuration/skin controls, and custom component flow.

- [ ] Add failing search/synonym/category/filter/empty/custom tests.
- [ ] Implement facade-backed `getComponentCatalog` and `suggestPlacement` using the same catalog.
- [ ] Normalize catalog add during preview so stable generated ID is reused by apply.
- [ ] Run catalog/editor/scene tests, lint, and build.
- [ ] Commit slice: `feat: add commercial kitchen component catalog`.

---

## Slice 5 — Layout wizard and essentials checker

### Task 16: Create one operational-requirement registry

**Files:**

- Create: `src/domain/requirements/operational-requirements.ts`
- Create: `src/domain/requirements/operational-requirements.test.ts`
- Modify: `src/simulation/validation.ts`
- Modify: `src/simulation/validation.test.ts`
- Create: `src/features/editor/EssentialsChecker.tsx`
- Create: `src/features/editor/essentials-checker.test.tsx`

**Contract:** Stable requirements cover task-chain stations, clean/dirty landings, entry/service flows, roles, count/capacity, reachability, modeled clearance/no-go rules, and professional-review topics. Results separate blocker, warning, and professional-review, cite reason/source, recommend catalog alternatives, and never claim certification. UI and simulation validation consume identical registry results.

- [ ] Add failing parity tests including dirty landing, roles, station capacity, routes, architecture flow, and professional topics.
- [ ] Remove hard-coded D2/hot-line assumptions from requirement messages.
- [ ] Add one/add-all essentials through one atomic facade batch; route architecture needs to room editing.

### Task 17: Implement command-backed layout wizard

**Files:**

- Create: `src/features/editor/LayoutWizard.tsx`
- Create: `src/features/editor/layout-wizard.test.tsx`
- Create: `src/features/editor/PolygonRoomEditor.tsx`
- Create: `src/features/editor/polygon-room-editor.test.tsx`
- Modify: `src/features/editor/LayoutVariants.tsx`
- Modify: `src/core/workspace/workspace-facade.ts`

**Contract:** Draft-only wizard supports duplicate current/other layout, existing room with blank equipment, rectangular room, and advanced polygon/jagged room with wall segments, openings, pillars, service windows, and zones. Collect covers, peak shape/duration, service/menu assumptions, roles/counts, capacity, and essentials. Review shows inventory, dimensions, assumptions, blockers/warnings/review items. Create is one facade preview/apply, one new variant, one revision, one undo entry; cancel is non-mutating.

- [ ] Add failing tests for every starting point, geometry mode, profile field, review result, cancel, and atomic create.
- [ ] Extend opening representation for arbitrary polygon wall segments with v2-safe validation.
- [ ] Ensure blank-equipment mode preserves chosen architecture only.
- [ ] Add Playwright novice room/essentials flow.
- [ ] Run domain/editor/simulation tests, lint, and build.
- [ ] Commit slice: `feat: add atomic layout wizard and essentials checks`.

---

## Slice 6 — Walkthrough experience

### Task 18: Decouple player pose from cameras and add live view switching

**Files:**

- Create: `src/features/scene/walk/player-motion.ts`
- Create: `src/features/scene/walk/player-motion.test.ts`
- Create: `src/features/scene/walk/walk-camera.ts`
- Create: `src/features/scene/walk/walk-camera.test.ts`
- Modify: `src/features/scene/walk/types.ts`
- Rewrite: `src/features/scene/walk/FirstPersonController.tsx`
- Modify: `src/features/scene/walk/WalkScene.tsx`
- Modify: `src/features/scene/SceneCanvas.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`

**Contract:** `WalkPlayerPose` owns position, heading, pitch, elevation, velocities, grounded/locomotion state, and nearby interactions independent of the camera. First-person and over-shoulder cameras derive transforms from the same pose. Switching preserves pose, vertical motion, pointer lock, Canvas, and interactions. Chase boom shortens around walls/equipment and eases back.

- [ ] Add pure failing pose/camera/chase-obstruction tests.
- [ ] Add normal/simulation component tests for renderer/pointer-lock/pose preservation.
- [ ] Implement conventional WASD/arrow movement and turning with reliable collision/jump caps; walls/pillars/tall solid equipment remain barriers.

### Task 19: Complete chef and first-person view model

**Files:**

- Modify: `src/features/scene/agents/ChefAvatar.tsx`
- Modify: `src/features/scene/agents/chef-avatar.test.ts`
- Create: `src/features/scene/walk/SpatulaModel.tsx`
- Rewrite: `src/features/scene/walk/FirstPersonHands.tsx`
- Create: `src/features/scene/walk/first-person-view-model.ts`
- Create: `src/features/scene/walk/first-person-view-model.test.ts`
- Modify: `src/features/scene/walk/walk-input.ts`
- Modify: `src/features/scene/walk/WalkControlsGuide.tsx`
- Modify: `e2e/kitchen-lab.spec.ts`

**Contract:** Friendly proportionate chef face/uniform plus deterministic front/three-quarter visual coverage. First person has two camera-relative hands and reusable spatula. Idle/walk/run/jump/land bob/sway is restrained; click or F swings once, first pointer-lock click does not swing, and reduced motion removes continuous bob/sway but keeps deliberate swing.

- [ ] Add failing input/view-model/reduced-motion/swing tests and visual snapshot descriptors.
- [ ] Reuse one spatula model and deterministic animation state.
- [ ] Extend Playwright for first/third switching, chase obstruction, movement/jump, swing, and reduced motion in normal and simulation Walk.
- [ ] Run walk/scene/simulation tests, lint, and build.
- [ ] Commit slice: `feat: add first and third person walkthrough modes`.

---

## Slice 7 — Simulation hardening and auto-layout

### Task 20: Correct simulation preconditions and dispatch

**Files:**

- Modify: `src/simulation/validation.ts`
- Modify: `src/simulation/validation.test.ts`
- Modify: `src/simulation/tasks.ts`
- Modify: `src/simulation/tasks.test.ts`
- Modify: `src/simulation/engine.ts`
- Modify: `src/simulation/engine.test.ts`
- Modify: `src/domain/project-schema.ts`

**Contract:** Validate dirty landing, role coverage, counts, physical station capacity, configured capacities, duration ranges, approaches, clearances, and routes before execution. Never fall back to ineligible roles. Separate deterministic task demand from candidate station choice and dynamically dispatch across multiple compatible stations.

- [ ] Add one failing regression per listed correctness issue.
- [ ] Reject `minSeconds > maxSeconds`, unknown capacity IDs, and impossible concurrency.
- [ ] Preserve common task realizations across candidate layouts/seeds.

### Task 21: Harden navigation, generic geometry, and metrics

**Files:**

- Modify: `src/simulation/nav-grid.ts`
- Modify: `src/simulation/nav-grid.test.ts`
- Modify: `src/domain/layout-diagnostics.ts`
- Modify: `src/domain/layout-diagnostics.test.ts`
- Modify: `src/simulation/metrics.ts`
- Modify: `src/simulation/metrics.test.ts`
- Modify: `src/simulation/engine.ts`
- Modify: `src/simulation/types.ts`

**Contract:** Inflate navigation obstacles by body radius/minimum aisle, use intended approach faces, check complete clearances against equipment/walls/pillars/doors/no-go zones, remove hard-coded coordinates/IDs, evaluate dirty-clean checks independently, and rank unfinished work/backlog before served-order wait averages.

- [ ] Add failing body-radius bottleneck, approach-face, generic-zone, clearance-envelope, incomplete-order, and non-Manta geometry tests.
- [ ] Keep unknown professional constraints explicitly unknown.

### Task 22: Add metrics-only simulation output

**Files:**

- Modify: `src/simulation/engine.ts`
- Modify: `src/simulation/types.ts`
- Create: `src/simulation/metrics-only.test.ts`
- Modify: `src/core/workspace/workspace-facade.ts`

**Contract:** `outputMode: full | metrics-only` shares one evaluator. For identical snapshot/seed, aggregate metrics and warnings are identical; metrics-only omits per-frame and presentation-heavy traces.

- [ ] Add exact equality tests across representative scenarios/seeds.
- [ ] Ensure the full UI session still receives full output and optimizer uses metrics-only.

### Task 23: Implement pure deterministic constraint-first anytime search

**Files:**

- Create: `src/optimizer/types.ts`
- Create: `src/optimizer/experiment-schema.ts`
- Create: `src/optimizer/feasibility.ts`
- Create: `src/optimizer/canonical-layout.ts`
- Create: `src/optimizer/search.ts`
- Create: `src/optimizer/ranking.ts`
- Create tests beside each module

**Contract:** Freeze revision, baseline, scenarios, A/B/C permissions, locks, explicit rules, seed sets, and budgets. Reject hard infeasibility before scoring. Deterministically generate/deduplicate/cache candidates, prune by geometric/weighted flow cost, run metrics-only common seeds, rank lexicographically, confirm with held-out seeds, and retain Pareto finalists. Locks always win.

- [ ] Add toy-layout tests for deterministic improvement, infeasible diagnosis, A/B/C boundaries, locks, canonical dedup, common seeds, held-out confirmation, budget termination, lexicographic order, and Pareto dominance.
- [ ] Describe results as best observed under the frozen manifest, never universally optimal.

### Task 24: Add Worker execution, cancellation, finalists, and adoption

**Files:**

- Create: `src/optimizer/optimizer.worker.ts`
- Create: `src/optimizer/worker-protocol.ts`
- Create: `src/optimizer/worker-client.ts`
- Create: `src/optimizer/worker-client.test.ts`
- Create: `src/features/optimizer/AutoLayoutWorkspace.tsx`
- Create: `src/features/optimizer/auto-layout-workspace.test.tsx`
- Modify: `src/features/compare/CompareWorkspace.tsx`
- Modify: `src/core/workspace/workspace-facade.ts`
- Modify: `src/app/App.tsx`

**Contract:** Worker emits progress and respects cancellation/time/evaluation budgets. Search never mutates history. UI collects demand/staffing/permissions/locks/rules/SLA/budget and presents baseline plus Fastest service, Least travel, and Minimal change finalists with feasibility, deltas, seeds, diffs, and exact manifest. Inspect/Compare are read-only. Adoption creates exactly one parented variant through the facade and one undo entry.

- [ ] Add Worker protocol tests for deterministic traces, progress, cancel, stale revision, and budget termination.
- [ ] Add UI tests for permissions, progress, finalist cards, non-mutating inspect, and exact one-child adoption.
- [ ] Add Playwright run/compare/adopt flow.
- [ ] Run all simulation/optimizer/component tests, lint, and build.
- [ ] Commit slice: `feat: add deterministic auto layout experiments`.

---

## Slice 8 — Persistence and export

### Task 25: Prove complete editable project exchange

**Files:**

- Modify: `src/state/persistence.ts`
- Modify: `src/state/persistence.test.ts`
- Modify: `src/app/ProjectExchange.tsx`
- Modify: `src/app/project-exchange.test.tsx`
- Modify: `e2e/kitchen-lab.spec.ts`
- Modify: `docs/user-guide.md`

**Contract:** One versioned JSON file preserves all named variants with distinct architecture, stable components, physical configurations, appearance skins, operational profiles, constraints, scenarios/settings, adopted manifests, and active IDs. Import validates/migrates, replaces atomically, rotates document identity, and invalidates previews.

- [ ] Add failing comprehensive multi-variant round-trip tests plus v0/v1 migration fixtures.
- [ ] Add live-preview invalidation-on-import integration test.
- [ ] Add Playwright export/import equality across adopted and baseline variants.
- [ ] Document complete project exchange and non-certification language.
- [ ] Commit slice: `feat: export complete multi variant kitchen projects`.

---

## Final requirement audit and release

### Task 26: Audit every approved requirement and close all gaps

- [ ] Build a checklist mapping every paragraph/bullet in `docs/superpowers/specs/2026-09-01-kitchen-planning-workspace-expansion-design.md` to implementation files and automated proof.
- [ ] Re-run every focused regression added by this plan.
- [ ] Run `npm test` and fix every failure.
- [ ] Run `npm run lint` and fix every error/new warning.
- [ ] Run `npm run build` and fix every type/bundle failure.
- [ ] Run `npm run e2e` with the pinned Chromium runtime and fix every scenario.
- [ ] Launch the built application and inspect Plan, 3D, Split, Simulate, Compare, wizard, catalog, Walk, auto-layout, and exchange at representative desktop and narrow viewports.
- [ ] Exercise missing/blocked Walk, unsupported/lost WebGL, unexpected retry, undo/redo suppression, multi-layout wizard, essentials, skins/configs, metrics-only parity, optimizer cancel/adopt, and complete round trip manually where browser automation cannot prove visual quality.
- [ ] Run `git diff --check` and inspect `git status --short` for unrelated or generated files.
- [ ] Run the tracked prohibited-identity scan and confirm no matches.
- [ ] Confirm Product/package identity is Kitchen Planner / `kitchen-planner` and Manta Raja appears only as example/seed/reference content.
- [ ] Commit final audit/docs fixes with a meaningful message.
- [ ] Fetch `origin/main`, reconcile any authoritative remote changes without discarding work, rerun the complete gate if the merge changes code, and push all verified commits to `origin/main`.

## Planned commit sequence

1. `docs: approve and plan workspace expansion`
2. `fix: keep 3d available when walk setup fails`
3. `feat: add atomic variant-targeted workspace operations`
4. `feat: add fullscreen rapid layout editing`
5. `feat: add commercial kitchen component catalog`
6. `feat: add atomic layout wizard and essentials checks`
7. `feat: add first and third person walkthrough modes`
8. `feat: add deterministic auto layout experiments`
9. `feat: export complete multi variant kitchen projects`
10. Final audit/documentation commit only if the completion audit requires changes.
