# Kitchen Planning Workspace Expansion Design

**Date:** 2026-09-01  
**Status:** Draft for written-spec approval  
**Product:** Kitchen Planner

## Purpose

Turn the current kitchen drawing and simulation prototype into a dependable, novice-friendly planning workspace. The workspace must support rapid visual editing, resilient 3D walkthroughs, broad commercial-kitchen component coverage, operational completeness checks, reproducible auto-layout experiments, and a single command boundary shared by humans and future AI agents.

The first product remains a commercial-kitchen planner, but the spatial document and command boundary must stay domain-neutral so later products are not restricted to kitchens.

## Product Principles

1. The canvas is the product surface. It fills the browser viewport and is never squeezed into a small fixed editor column.
2. Every mutation travels through the same validated command service, whether initiated by a gesture, wizard, optimizer, or future WebMCP agent.
3. Physical configuration and cosmetic appearance are separate concepts.
4. Simulation and optimization report assumptions and evidence. They do not claim regulatory certification or universal optimality.
5. Invalid walkthrough state must never crash or permanently replace the overview 3D scene.
6. Long-running work is deterministic, cancellable, and does not mutate the active project until the user adopts a result.

## Information Architecture

### Fullscreen, viewport-filling workspace

The application shell occupies `100dvw × 100dvh`. The active Plan, 3D, Split, Simulate, or Compare surface fills the available viewport. Controls are layered as compact, collapsible surfaces:

- a top layout-tab strip and view controls;
- a left catalog/layout drawer;
- a right contextual inspector;
- floating canvas controls and status;
- bottom simulation or walkthrough guidance when relevant.

Opening or closing a drawer resizes the viewport without remounting the scene, losing selection, resetting the camera, or restarting simulation. Narrow layouts collapse drawers into overlays. Keyboard focus and visible focus styling remain intact.

### Layout variants as tabs

Variants appear as Chrome-style tabs with an active state, inline rename, a close `×`, keyboard tab navigation, horizontal overflow, and a `+` button that opens the layout wizard. Closing activates the nearest surviving tab and is disabled for the last remaining layout. Destructive close offers Undo rather than a blocking confirmation.

The project JSON remains the canonical save format. **Export all layouts** downloads one JSON file containing every variant, architecture, equipment instance, configuration, skin, scenario, simulation setting, and active identifier.

## Shared Workspace Operations

### Command-first boundary

React components, keyboard shortcuts, context menus, wizards, auto-layout adoption, and future WebMCP tools call one injected workspace facade. They never mutate Zustand state, Konva nodes, or Three.js objects directly.

The facade exposes:

- `getComponentCatalog(filters)`;
- `getLayoutRequirements({ variantId, scenarioId })`;
- `suggestPlacement({ variantId, catalogId, preferredPoint? })`;
- `previewLayoutChanges({ expectedRevision, operations, intent })`;
- `applyLayoutChanges({ previewToken })`;
- `runSimulation({ variantId, scenarioId, seed, outputMode })`;
- `runAutoLayout({ variantId, experiment })`;
- `cancelRun({ runId })`.

Friendly operations include:

- `create_layout`, `activate_layout`, `rename_layout`, `remove_layout`;
- `add_component`, `add_custom_component`, `configure_component`, `skin_component`;
- `move_components`, `nudge_components`, `rotate_components`, `resize_component`;
- `duplicate_components`, `lock_components`, `remove_components`;
- `update_architecture`, `update_scenario`, and `adopt_auto_layout_result`.

Every variant-scoped operation explicitly identifies `variantId`. Controlled objects reject unknown fields. A preview executes an ordered batch against an isolated clone, returns normalized operations and diagnostics, and produces a short-lived token bound to the document identity and revision. Applying the token commits once, increments the revision once, and creates one undo checkpoint. Tokens become invalid after any competing edit, import, or project replacement.

Stable component IDs allow React and Three.js to patch affected objects without recreating the full canvas or resetting the camera.

### Undo, redo, and shortcuts

All committed human and agent mutations participate in the same history:

- `Cmd/Ctrl+Z`: undo;
- `Cmd/Ctrl+Shift+Z`: redo;
- `Ctrl+Y`: redo;
- Delete/Backspace: remove selected unlocked components;
- `Cmd/Ctrl+D`: duplicate;
- arrows: nudge by the active snap interval;
- Shift+arrows: coarse nudge;
- Escape: close transient UI, then clear selection;
- `[` and `]`, plus visible buttons: rotate left/right by 90°.

Editing shortcuts are suppressed in inputs, textareas, editable elements, and open native controls.

## Component Catalog and Editing

### Catalog model

The component catalog is a domain module over the generic spatial core. Each entry contains:

- stable catalog and family identifiers;
- display name, category, description, and search synonyms;
- typical, minimum, and maximum dimensions;
- physical configuration presets;
- compatible cosmetic skins;
- capabilities and station capacity;
- clearances, approach face, and placement rules;
- 2D footprint metadata;
- a modular 3D visual constructor;
- tags describing wall-mounted, overhead, floor-mounted, mobile, or architectural behavior.

The first catalog provides broad coverage across cooking and hot-line equipment; ovens and holding; refrigeration and ice; preparation machines and tables; beverage/service equipment; warewashing and sanitation; waste and janitorial equipment; ventilation and utility placeholders; architectural objects; and storage.

Storage is first-class. It includes wall shelves, overshelves, freestanding shelving, mobile racks, dunnage racks, ingredient/bin storage, pot racks, dish racks, tray racks, and overhead storage. Shelf configuration supports width, depth, height/elevation, tier count, mobility, mounting style, and finish. Collision and clearance behavior distinguishes elevated wall shelves from floor obstructions.

The gallery uses categories, capability filters, full-text search, synonyms, and visual cards. One-click Add uses deterministic placement suggestion and selects the new component. Dragging from the catalog allows a preferred placement. A custom component remains available for uncommon equipment.

### Fast editing

- Single-click selects with an exact footprint outline.
- Double-click opens a compact quick-configuration popover.
- Right-click opens Configure, Skin, Rotate Left, Rotate Right, Duplicate, Lock/Unlock, Inspect in 3D, and Remove.
- Drag moves; resize handles change dimensions; dedicated left/right controls rotate in 90° increments.
- The old rotation dropdown and free-rotation handle are removed from the primary flow.

Physical configuration changes dimensions, capabilities, clearance, and physical model structure. Cosmetic skin changes finish, material, colour, wear, and optional branding without changing geometry or simulation semantics. Both are explicit, atomic, undoable commands.

## New Layout Wizard

The `+` tab action opens a command-backed wizard:

1. **Starting point:** duplicate the current layout, reuse another layout's room with empty equipment, or create a new room.
2. **Room:** simple rectangular width/depth inputs by default; an advanced polygon editor supports jagged rooms, wall segments, openings, pillars, service windows, and storage zones.
3. **Operational profile:** covers, peak duration/arrival shape, service style, staff roles/counts, and optional menu/task mix.
4. **Essentials:** add recommended operational components, choose alternatives, or start empty.
5. **Review:** show dimensions, inventory, unresolved requirements, placement warnings, and assumptions.

Create commits the full result atomically as one new layout and one undo entry. Cancel leaves the project untouched. The wizard calls the same public operations available to future agents.

## Operational Essentials Checker

A reusable requirement registry drives both pre-simulation validation and the **Check essentials** UI. Requirements are scenario-based operational prerequisites, not legal certification. Each requirement has a stable code, reason, scope, satisfaction predicate, required count/capacity, recommended catalog entries, and source.

The checker covers task-chain stations, clean and dirty landings, entry and service flows, required role coverage, configured capacities, reachability, and explicitly modeled clearance/no-go rules. It separates:

- **Blocker:** simulation or workflow cannot execute;
- **Warning:** modeled operation is possible but risky or underspecified;
- **Professional review:** gas, fire, electrical, drainage, grease, accessibility, ventilation, food-code, and local regulatory matters not certified by the application.

Users can add one missing component or atomically add all recommended essentials. Architecture requirements route to room editing rather than pretending a door or service opening is equipment.

## Resilient 3D and Walkthrough

### Failure recovery

Walk spawn resolution is total and non-throwing. It prefers an unobstructed declared staff entry, then deterministically searches valid interior cells. If no spawn exists, overview 3D remains mounted and a targeted message explains how to add or clear an entry. The same rule is used by standalone and simulation walkthroughs.

The scene boundary distinguishes:

- unsupported/unavailable WebGL;
- lost graphics context;
- invalid walkthrough setup;
- unexpected scene failure.

Context loss offers restart. Unexpected failure offers retry and preserves the plan. Leaving Walk mode resets walk-local failure state. A transient child exception cannot permanently disable 3D for the workspace.

### Player and cameras

Player pose and movement are independent from the camera. Users switch at any time between:

- first-person camera at eye height;
- over-the-shoulder third-person chase camera.

Switching preserves position, heading, vertical motion, pointer-lock state, and nearby interaction state. The chase camera shortens its boom when walls/equipment obstruct the view and eases back when clear.

Movement supports WASD and arrow keys, standard left/right turning, Space to jump, and predictable collision. Jump clearance is derived from obstacle height within safe game-like caps: low items can be mounted and configured traversable items can be cleared, while architecture and intentionally solid tall equipment remain barriers. The guide reflects active bindings and view mode.

### Chef and first-person view model

The third-person chef has a friendly, proportionate face, expressive but restrained eyes, clear smile, modern chef uniform, apron, toque, and role accents. Visual regression views cover front and three-quarter angles.

First person renders two camera-relative hands. The dominant hand holds a reusable spatula model. Idle, walking, running, jumping, and landing apply restrained FPS-style bob and sway. Primary click plays a short spatula swing without sound; `F` is the accessible keyboard equivalent. The first canvas click still acquires pointer lock and does not accidentally swing. Reduced-motion mode removes continuous bob/sway while retaining the deliberate swing action.

## Auto-layout Experiments

### Scope and claims

Each experiment explicitly enables any combination of:

- **A — placement:** move and rotate existing unlocked components;
- **B — equipment redesign:** resize, substitute, add, or remove allowed equipment;
- **C — architecture:** change user-authorized room elements, openings, and storage zones.

Architecture, equipment, or dimensions marked locked remain immutable regardless of scope. The result is described as the **best observed feasible layout under these inputs, rules, scenarios, seeds, and search budget**, never as universally optimal or regulatory-approved.

### Precondition hardening

Before rankings are trusted, simulation and geometry are corrected to:

- include every task prerequisite, including dirty landing;
- enforce role restrictions without silently assigning arbitrary staff;
- validate component counts and concurrent capacity;
- evaluate full configured clearance envelopes against equipment, walls, pillars, doors, and service approaches;
- inflate navigation obstacles by body radius and enforce user-supplied minimum aisle rules;
- use intended station approach faces rather than arbitrary nearest cells;
- dispatch across multiple compatible stations;
- score unfinished orders and backlog before completed-order wait averages;
- model generic zones rather than hard-coded D2 or hot-line coordinates.

Unmodeled professional constraints remain unknown, not passed.

### Deterministic optimizer

The optimizer is a constraint-first, anytime hybrid search:

1. Freeze project revision, baseline, scenarios, permissions, locks, hard rules, seed set, and budget.
2. Reject candidates that violate inventory/architecture locks, boundary/overlap, required capacities, explicit no-go/clearance rules, or body-inflated reachability.
3. Use deterministic seeded large-neighborhood/local search and canonical layout hashes to generate and deduplicate candidates.
4. Apply cheap geometric and weighted-flow-distance scoring to prune candidates.
5. Run a metrics-only simulation on a shortlist using identical common seeds and task realizations.
6. Rank lexicographically by service viability and unfinished work, then robust P90/backlog, travel and congestion, and finally change cost.
7. Confirm finalists with held-out deterministic seeds.

The experiment runs in a Worker with cancellation, progress events, hard time/evaluation budgets, and route/result caches. It never mutates project history while searching.

### Auto-layout UX

The wizard collects demand and staffing, A/B/C permissions, locks and critical inventory, explicit clearances/no-go rules, priority/SLA, and search budget. Progress shows feasibility, pruning, simulation, candidate counts, elapsed budget, and current best observed.

Results present baseline plus named Pareto finalists such as **Fastest service**, **Least travel**, and **Minimal change**. Cards show hard-feasibility status; completion/SLA, P90 wait, peak backlog, throughput, travel, congestion, and change-cost deltas; seed ranges; moved/rotated/substituted diff; and exact experiment manifest. Inspect and Compare are non-mutating. **Save as new layout** adopts one finalist as a parented variant through the shared atomic command facade.

## State, Migration, and Compatibility

Existing projects continue to load. New optional appearance and shelving metadata receive deterministic defaults. Existing configuration presets remain physical presets. Export remains a versioned JSON project rather than introducing a second save format.

Transient UI state—open popovers, context menus, drawer state, camera mode, optimizer progress, and preview tokens—is not persisted in the project. Auto-layout result manifests may be persisted on adopted variants for reproducible comparison.

## Testing and Acceptance

### Contracts and state

- Strict schemas reject malformed catalog, component, architecture, scenario, and batch operations.
- Preview is non-mutating; apply is single-use, atomic, revision-safe, and one undo entry.
- UI and simulated-agent calls through the facade produce identical projects.
- Import invalidates outstanding previews.
- Undo/redo shortcuts work across Plan and 3D without firing in form controls.
- Export/import preserves multiple named variants, skins, scenarios, architecture, and active identifiers.

### Editor and wizard

- Viewport and drawer resize tests prove the canvas fills the browser window.
- Accessible variant tabs cover rename, close, overflow, keyboard navigation, and last-tab protection.
- Catalog search, synonyms, categories, shelving, one-click placement, custom components, and empty states are covered.
- Single-, double-, and right-click behaviors work without gesture conflicts.
- Wizard variants and advanced room geometry commit atomically and cancel cleanly.
- Requirements UI and simulation validation share the same registry results.

### 3D and walkthrough

- Missing and fully obstructed entries never unmount overview 3D.
- WebGL/context loss and unexpected-error recovery paths are independently tested.
- First/third switching preserves pose and does not recreate the renderer.
- Chase-camera obstruction, movement, turning, jumping, collision, pointer lock, reduced motion, and spatula swing are deterministic tests.
- Visual snapshots cover the chef face, hands/spatula, major equipment families, storage systems, physical configurations, and skins.

### Simulation and auto-layout

- Validators cover every task prerequisite, role restriction, count/capacity, clearance, approach, and body-inflated route rule.
- Metrics-only output matches full simulation metrics.
- Identical experiment snapshots and seeds produce identical traces and finalists.
- Infeasible candidates never receive a soft score.
- Known toy layouts prove improvement, Pareto dominance, no-feasible diagnosis, stale-revision handling, cancellation, and candidate-budget termination.
- A saved finalist creates exactly one child variant and does not alter the baseline.

### End-to-end acceptance

A novice can create a jagged or rectangular room, add recommended essentials and shelving, search/add/configure/skin/rotate equipment, use undo/redo, create and close variant tabs, enter resilient first- and third-person walkthroughs, run an operational simulation, run and compare auto-layout finalists, adopt one finalist, and export/import the complete project as one JSON file.

## Delivery Slices

1. 3D/walk crash fix and recovery tests.
2. Atomic workspace facade, strict commands, revision-safe batching, and history.
3. Viewport shell, variant tabs, shortcuts, catalog/gallery, quick configuration/skin editing, and context menus.
4. Layout wizard and operational requirements registry/checker.
5. Player/camera separation, third-person chase view, chef revision, and first-person hands/spatula.
6. Simulation correctness hardening and metrics-only mode.
7. Worker-based deterministic auto-layout, finalist comparison/adoption, and complete JSON verification.

Each slice must leave existing projects usable and includes automated tests proportionate to its risk.
