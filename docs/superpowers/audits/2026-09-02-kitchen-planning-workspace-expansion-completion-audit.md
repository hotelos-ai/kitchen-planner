# Kitchen Planning Workspace Expansion Completion Audit

**Specification:** `docs/superpowers/specs/2026-09-01-kitchen-planning-workspace-expansion-design.md`  
**Audit date:** 2026-09-02  
**Result:** Complete

## Requirement evidence

| Area | Acceptance evidence |
| --- | --- |
| Product identity | Package/application remain Kitchen Planner / `kitchen-planner`; Manta Raja is confined to example seed/reference content. The final tracked-content search for prohibited legacy names returned no matches. |
| 3D and Walk reliability | Total entry-first/interior spawn resolution, polygon and obstacle-height handling, shared normal/simulation Walk availability, retained overview canvases, targeted retry/exit states, native context restoration, manual restart, and repeated-loss coverage are exercised by `walk-collision.test.ts`, `scene-sync.test.tsx`, `FirstPersonController.integration.test.tsx`, and the blocked-room/context-loss Playwright scenarios. |
| Atomic workspace API | Strict variant-targeted operation schemas, isolated ordered batches, revision/document binding, expiring single-use preview tokens, full-project validation, one commit/one history entry, target-aware diagnostics, and UI/agent equality are covered by the workspace operation, batch, preview registry, facade, and project-store suites. The application routes mutations and Worker auto-layout through the same store-owned facade. |
| Fullscreen rapid editor | Persistent Plan/3D hosts fill `100dvw × 100dvh`; desktop drawers resize and narrow drawers overlay without canvas remounting. Accessible tabs cover rename, close/Undo, overflow, roving arrows, Home/End, and last-tab protection. Shortcuts include both redo conventions, rotate, duplicate, delete, snap/coarse nudge, and transient-first Escape while suppressing editing commands in controls. Plan gesture suites cover click, double-click configuration, context actions, move, resize, and explicit left/right rotation. |
| Component catalog | The parsed domain catalog has broad commercial-kitchen coverage, categories, synonyms, descriptions, dimension ranges, capabilities/capacity, clearance/approach/placement rules, footprints, constructors, skins, and explicit structured physical presets. Storage includes wall shelves, overshelves, freestanding/mobile/dunnage/ingredient/pot/dish/tray/overhead systems. Placement accounts for jagged boundaries, floor/elevated behavior, pillars, existing equipment, openings, and no-go zones; custom components remain available. |
| Wizard and essentials | Duplicate, blank-existing, rectangle, and polygon workflows support openings, pillars, windows, and storage zones; operational profile captures covers, arrival/peak, service/menu assumptions, staff, and capacity. Review uses deterministic placement previews and reports blockers, warnings, and professional-review items. Creation is one public-operation batch and one undo entry. The shared operational registry supplies UI and simulation prerequisites and never claims certification. |
| Walkthrough experience | Player pose is camera-independent. First/third switching preserves controller/pose/renderer and pointer-lock controller identity. Obstacle-aware chase camera, heading-aligned chef, two hands, reusable spatula, click/F swing semantics, bob/sway, reduced motion, WASD/arrows, turning, collision, height-aware jump, falling/landing, and guide bindings have deterministic focused coverage plus normal/simulation browser scenarios. |
| Simulation hardening | Shared prerequisites include dirty landing; invalid roles/counts/capacities and physical station capacity are rejected; dispatch supports compatible station pools; unfinished work/backlog lead ranking; navigation uses body radius and intended approach faces; generic polygon/opening geometry replaces seed IDs/coordinates. Metrics-only/full parity is covered. |
| Auto-layout | A/B/C are independent permissions with component/architecture locks and hard rules. The cancellable Worker freezes document/revision/scenarios/seeds/budget, uses deterministic seeded multi-item neighborhoods, family substitution, capacity-deficit additions, architecture/opening/storage-zone neighborhoods, canonical deduplication, feasibility filtering, weighted pruning, common/held-out seeds, caches, priority-aware lexicographic/Pareto ranking, and actionable no-feasible diagnostics. Results show baseline, named finalists, service/completion/throughput/travel/congestion/change metrics, manifests, and read-only spatial inspect/compare views. Adoption is stale-safe, single-use, atomic, parented, and one history entry. |
| Persistence and export | Schema-v0/v1 migrations and schema-v2 validation preserve stable IDs, multiple variant-owned architectures, configurations, skins, profiles, scenarios, settings, locks, active IDs, and adopted experiment manifests. Cross-document references and duplicate architecture IDs are validated. Export normalizes the top-level active-architecture compatibility mirror without mutating the source. Unit and browser round trips pass. |

## Second-pass audit corrections (2026-09-02)

A requirement-level re-audit against the specification found and closed the following gaps after the first completion claim:

- **Single mutation boundary:** the legacy `executeCommand` executor was removed; the application service now routes every mutation and auto-layout run through the store-owned workspace facade, reads scenario/layout data from the requested variant's own architecture, and advertises only strict variant-targeted operations (`e90f5dc`).
- **Catalog preset semantics:** `createCatalogEquipmentItem` now derives dimensions, capabilities, clearance, and station capacity from the selected physical preset (not the base entry); preset dimensions are clamped to the entry's supported range. Wall/overhead presets carry explicit mounting heights (hand sink 850 mm, salamander 1200 mm, table overshelf 1 450 mm, wall storage ≥1 500 mm, overhead storage ≥2 000 mm), and floor-obstacle behavior follows the preset's walk-under clearance with entry-level fallback for presetless items.
- **Navigation semantics:** `findRoute` no longer silently relocates a blocked goal to an arbitrary nearby cell; station approach points are offset by the body-radius/aisle-aware clearance; wall openings (service windows, doors) resolve through an explicit bounded nearest-walkable relocation (`resolveNominalGoal`) because their interior markers legitimately sit inside clearance bands and station footprints.
- **Hard feasibility:** candidates are rejected for hard violations they introduce relative to the frozen baseline; pre-existing baseline violations remain diagnosable but do not disqualify the reference layout. Absolute rejection made the seeded Manta Raja kitchen infeasible and contradicted the required baseline-plus-finalists presentation.
- **Ranking:** service viability (unfinished orders, P90 wait, backlog) strictly outranks the run's priority key in every lexicographic order.
- **Atomic editor operations:** closing a layout tab and duplicating a multi-selection now commit as single workspace-operation revisions (one undo entry), with revision-guarded tab-close Undo.
- **Shortcut scoping:** editing shortcuts are enabled only in Plan/3D/Split views; all workspace chunks preload at startup so a Suspense transition can never leave stale shortcut handlers active.
- **Viewport fit:** the Plan and 3D workspace sections now use explicit `minmax(0, 1fr)` column tracks, and the 2D stage treats its size floors as zero-guards; the narrow-viewport canvas previously exceeded the phone viewport (631 px and 436 px wide at 390 px) and is now pixel-exact.
- **New coverage:** WebGL context-guard native events, rendered first-person hands behavior, real simulation Walk spawn integration, storage visual elevation model, seeded large-neighborhood determinism, and shortcut enable/disable scoping.

## Final verification

- `pnpm test`: 93 files, 465 tests passed.
- `pnpm run lint`: passed with 0 errors and the existing 5 Fast Refresh warnings.
- `pnpm run build`: TypeScript and production Vite build passed.
- `pnpm run e2e`: 11 Chromium scenarios passed.
- Visual verification: DOM-measured layout at 1440×900 and 390×844 across Plan and 3D — zero horizontal/vertical overflow, canvases exactly within viewports, non-overlapping visible drawers, narrow-viewport drawers closed by default, working toggles, and zero console errors.
- `git diff --check`: passed.
- Tracked prohibited-identity search: no matches.
