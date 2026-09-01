# Manta Raja Kitchen Lab — Immersive 3D Service Design

Date: 2026-09-01
Status: Approved direction

## Purpose

Extend the existing kitchen planner so its 3D view communicates working clearances and architectural openings clearly, while Full Sim becomes an immersive representation of a live dinner service. The same deterministic simulation must drive the operational dashboards, top-down view, moving 3D staff, and first-person walk-through.

This remains a comparative planning tool, not a substitute for local architectural, fire, ventilation, food-safety, accessibility, or occupational-safety review.

## Product Outcomes

The extension must make four questions easier to answer:

1. Where are the operational and safety clearances around each station?
2. Can the user visually understand the kitchen shell and both service-window routes?
3. What does the five-person service look and feel like at peak load?
4. Can a person stand inside the proposed kitchen and judge sightlines, aisle widths, congestion, and station access?

## Chosen Approach

Use one shared React Three Fiber scene for normal 3D viewing, live 3D simulation, and first-person exploration. The existing simulation remains the authoritative source for orders, tasks, agent positions, queues, backlog, wait times, and outcomes.

The existing 2D Operations view remains available because it is the clearest analytical view. Full Sim adds two complementary views:

- **2D Operations:** current plan view with heatmap, trails, live queues, orders, and flow lines.
- **3D Overview:** orbitable kitchen model with animated worker avatars driven by the current playback time.
- **Walk Kitchen:** first-person camera placed inside the same live scene while other workers continue moving.

This approach avoids separate simulation logic, prevents metric drift between views, and keeps the 3D implementation lightweight enough to preserve WebGL stability.

## Phase-Two Extensibility Boundary

Phase one presents a kitchen-planning product, but the foundations must support other spatial layouts and future WebMCP tools. WebMCP exposure itself is explicitly deferred to phase two. Phase one creates the stable, validated application interfaces that a later WebMCP adapter will call.

The application is organized into three layers:

1. **Spatial core:** domain-neutral documents, geometry, transforms, commands, validation primitives, units, history, and serialization.
2. **Domain modules:** kitchen catalog, commercial-equipment visuals, kitchen workflow capabilities, kitchen simulation rules, and Manta Raja seed data.
3. **Presentation adapters:** React editor, Three.js scene, Full Sim dashboards, persistence, and the future WebMCP adapter.

React components and Three.js meshes must not become the source of truth. They render and dispatch against the spatial core.

## Component and Tool-Call Architecture

### Generic spatial core

The reusable core describes concepts such as:

- project and layout variants;
- bounded spaces and polygons;
- placed items with stable identifiers, dimensions, transforms, tags, and metadata;
- openings, structural obstacles, zones, and clearance regions;
- display units and canonical millimetre storage;
- agent positions, routes, tasks, resources, and playback frames.

Kitchen-specific categories and capabilities remain domain-module data rather than assumptions embedded in generic geometry or editor code. Existing public project data must retain migration compatibility while the internals are separated.

### Validated command surface

Every material layout mutation goes through a serializable command with a discriminated type and a Zod-validated payload. Initial commands include:

- create or reset a project;
- add, update, duplicate, and remove a placed item;
- move, resize, and rotate one or more items;
- update project settings and units;
- create, rename, activate, duplicate, and remove variants;
- update architecture only when explicitly unlocked;
- update a scenario and start a deterministic simulation.

Commands return structured success or failure results with stable error codes, affected IDs, and optional warnings. They do not depend on DOM events, React components, Konva nodes, Three.js objects, browser globals, or pointer coordinates.

The UI translates gestures into these commands. A future WebMCP adapter translates tool inputs into the same commands. Neither path may bypass validation, history, locking rules, or collision/boundary analysis.

### Read-only query surface

Deterministic, JSON-safe queries expose the state an agent or UI needs without leaking store internals:

- project and active-layout snapshot;
- list/filter placed items and catalog entries;
- selected item geometry and properties;
- room bounds, openings, obstacles, and available zones;
- collision, clearance, reachability, and validation findings;
- simulation assumptions, progress, queues, metrics, and recommendations;
- supported commands, item presets, units, and domain capabilities.

Large visual artifacts are not returned by default. Tool callers receive concise structured state and can request more detail explicitly.

### Stable identifiers and tool safety

- IDs are stable across 2D, 3D, simulation, persistence, undo/redo, and eventual tool calls.
- Commands are atomic and deterministic where practical.
- Destructive commands identify exact targets and return enough state for confirmation or undo.
- Tool-facing operations support dry-run validation before mutation.
- Imported or tool-supplied data passes through the same schema and migration boundary as browser-saved data.
- Command results include the resulting document revision so automated callers can detect stale writes.
- No command accepts executable code, selectors, arbitrary property paths, or unvalidated free-form mutations.

### Rendering registry

Placed items select their 2D and 3D representation through registered visual presets rather than hard-coded conditionals spread throughout the scene. A visual preset can provide:

- plan symbol;
- procedural 3D component;
- materials and detail level;
- footprint and fixed collision bounds;
- optional interaction anchors and state visualization.

The kitchen module registers ranges, tandoors, refrigeration, tables, sinks, dishwashing, mixers, hoods, and generic fallbacks. Later domains can register furniture, retail fixtures, warehouse equipment, office assets, or other objects without changing the core renderer.

### Simulation module boundary

The generic agent/playback layer owns positions, routes, interpolation, occupancy, queues, time, and visualization. The kitchen module supplies roles, task chains, station capabilities, service windows, durations, and operational metrics.

This separation allows a future domain to provide its own agents, resources, workflows, and KPIs while reusing the scene, walk mode, path playback, and live visualization infrastructure.

### Component contracts

- Components receive explicit typed props and emit semantic callbacks or commands.
- Stateful orchestration lives at workspace boundaries; leaf renderers remain focused and reusable.
- Shared scene components work in normal 3D, simulation overview, and first person without copying geometry.
- Editor, scene, simulation, and persistence consume selectors and public services rather than reaching into mutable store internals.
- Cross-feature imports flow through documented public module entry points.
- Browser-only input and pointer-lock logic is isolated behind adapters and can be replaced in tests.

### Incremental scene synchronization

The 3D renderer is a persistent presentation surface, not a disposable preview. Editing the plan must update the corresponding scene components without resetting the surrounding 3D experience.

- The React Three Fiber `Canvas`, WebGL renderer, camera rig, orbit controls, lighting, architecture group, and unchanged equipment meshes retain stable component identities during ordinary layout edits.
- Moving or rotating an item updates only that item's transform.
- Resizing an item updates only that item's dimension-driven geometry and collision bounds.
- Adding or removing an item mounts or unmounts only that item's registered visual component.
- Editing labels, metadata, selection, clearances, or materials updates only the affected presentation properties.
- Split-view plan gestures must not remount the Canvas, increment its recovery key, refit the room, reset the camera target, reset orbit/pan/zoom, or interrupt pointer interaction.
- Renderer remounting is reserved for explicit WebGL context recovery or another unrecoverable graphics failure.
- Active simulation playback and first-person position remain intact when a compatible item edit is made. If an edit invalidates current navigation, the application pauses playback and reports the exact reason rather than silently resetting the scene.
- Scene component keys use stable item IDs, never collection indices or document revisions.
- Derived scene data is memoized at the smallest useful boundary so one item's change does not rebuild unrelated procedural geometry.

The split view should feel like editing a live model: the changed item moves immediately on the right while the user's camera and the rest of the scene remain visually stationary.

### Planned phase-two adapter

The future WebMCP layer will be a thin adapter that:

1. publishes command and query schemas as tools;
2. validates an agent request;
3. optionally performs a dry run;
4. executes through the same application service as the UI;
5. returns structured results, findings, and the new revision.

No WebMCP-specific protocol code, tool discovery, or remote-agent authorization is required in this phase.

## 3D Workspace Controls

The regular 3D toolbar will contain:

- Perspective
- Top
- Fit room
- Clearances
- Transparent walls

`Transparent walls` affects wall surfaces only. Wall edges, opening edges, the floor boundary, structural pillar, and equipment remain legible. The state is independent from the camera mode and does not modify saved project geometry.

## Clearances

Clearance zones must remain readable against the grid, equipment, transparent walls, and both light and dark surfaces.

### Visual treatment

- Use stronger translucent fills than the current low-opacity planes.
- Add opaque perimeter outlines slightly above the floor to avoid z-fighting.
- Use distinct colors for heat, work, service, and door-swing clearances.
- Add directional hatching or repeated floor marks so the zone remains visible from a low perspective.
- Add compact in-scene labels containing clearance type and depth, using the project's selected display unit.
- Preserve door and cold-equipment swing arcs, but give them a complete radial boundary and hinge marker.
- Keep clearance geometry non-occluding and non-shadow-casting.

### Interaction

- The existing Clearances button remains a single global toggle.
- Clearance labels must not intercept equipment selection or first-person movement.
- Clearance visualization is informational. It does not become solid collision geometry.

## Transparent Walls

Walls support two display modes:

- **Solid:** current opaque wall surface with visible edges.
- **Transparent:** lightly tinted wall surface at approximately 12–20% opacity with depth writing disabled, plus fully opaque charcoal edge lines.

The transparent state must still communicate wall height, corners, sealed D6, door jambs, and service-window boundaries. Pillars remain opaque because they are physical obstructions and an important hot-line reference.

The rendering implementation must avoid duplicating canvases or allocating new materials every animation frame.

## Service Windows and Pass

The clean and dirty service windows are actual openings in the right-side wall, not floor-to-ceiling gaps.

For each service window, wall geometry is split into:

- a wall panel below the configured sill;
- a wall panel above the configured opening height;
- side jambs formed by adjacent wall segments;
- a visible opening outline that remains legible in transparent-wall mode.

The clean service window is treated as the outgoing pass:

- stainless ledge/counter at the sill;
- clear `Clean pass · orders out` label;
- outward direction indicator extending just beyond the room;
- completed-order animation visibly crossing the opening rather than disappearing inside the kitchen.

The dirty service window receives a distinct return ledge and inward-flow indicator. It must never be visually confused with the clean pass.

The pass ledge and wall below it are solid collision geometry in Walk Kitchen mode. The player cannot walk through a service window.

## Equipment Visual Fidelity

Equipment must read as commercial-kitchen equipment from both overview and first-person eye level. Generic colored cuboids are not sufficient. Models remain procedural, dimension-driven, and lightweight, but use recognizable silhouettes, construction, and details.

### Shared visual language

- Stainless-steel work surfaces with a small raised edge and believable thickness.
- Dark inset cavities, door seams, hinges, handles, feet, casters, vents, and control panels where appropriate.
- Open-base tables use legs, bracing, and undershelves rather than solid boxes.
- Under-counter storage follows the item's notes: shelves, doors, or refrigerated cabinets.
- Details scale from each item's configured width, depth, and height instead of assuming fixed dimensions.
- Category color becomes a restrained accent or selection cue, not the entire equipment material.
- Labels remain available but can be subdued in Walk mode so geometry does the explanatory work.

### Required recognizable models

- **Six-burner range:** six burner rings, grate field, front control knobs, stainless body, and raised rear guard.
- **Flat-top and fryer stand:** distinct griddle plate and fryer well/baskets, front controls, raised rear guard, and visible storage below.
- **Tandoor:** rounded or faceted oven body, dark circular mouth, protective top rim, and heat-worn interior accent.
- **Upright freezer:** tall insulated cabinet, full-height door, substantial handle, hinges, top/bottom venting, and floor feet.
- **Two-door fridge:** divided doors, separate handles, hinges, ventilation grille, and raised feet/casters.
- **Prep fridge and counter:** refrigerated base doors/drawers, worktop, and prep rail or shallow ingredient-pan line where appropriate.
- **Working and landing tables:** thin stainless top, four legs, bracing or undershelf, and open space below.
- **Double sink:** two deep inset bowls, drainboards where space allows, backsplash, faucet, and drain plumbing impression.
- **Handwash and pre-rinse sinks:** basin, backsplash, faucet; the pre-rinse station also has a tall spray riser and hose/nozzle silhouette.
- **Dishwasher:** commercial under-counter or pass-through machine form matching its configured height, with front door/hood seam, handle, control panel, and visible dish rack.
- **Mixer:** pedestal/body, stainless bowl, head, and guard or beater silhouette.
- **Hood:** stainless canopy with filters/baffles and underside lighting, visually aligned over the hot line.

Selection outlines and category accents must continue working across these richer meshes. Model detail must not change the item's exact editable footprint or collision bounds.

## Live 3D Workers

### Source of truth

Worker transforms derive from the existing one-second simulation frames. Rendering interpolates between adjacent frames so movement is smooth without changing simulation outcomes.

### Avatars

Use procedural low-poly chef figures rather than external character files:

- chef toque;
- tailored white double-breasted jacket;
- colored neckerchief or trim based on role;
- dark trousers and kitchen shoes;
- simple head, torso, arms, and legs with a polished but restrained style.

The head chef, sous chef, CDPs, and busser/washer remain identifiable by the existing role color system. The overview scene may show a compact name/task label above each worker.

### Motion and state

- Walking uses a lightweight procedural arm/leg cycle tied to movement speed.
- Working faces the assigned station and uses a small repeated work gesture.
- Waiting settles into an idle pose and remains visually distinct from working.
- Agent heading follows the direction of travel with eased rotation.
- Trail and role-visibility settings remain optional overlays.
- Workers remain visible in both 3D Overview and Walk Kitchen.

Avatars do not use dynamic rigid-body physics. Their routes remain governed by the deterministic navigation system so visual playback stays synchronized with metrics.

## Walk Kitchen Mode

### Entry and exit

- A `Walk kitchen` action is available from the normal 3D view and the live 3D simulation view.
- Entering places the player at a safe spawn point inside D2, oriented toward the kitchen.
- The user clicks the scene to capture mouse-look.
- Escape releases mouse-look without discarding the camera position.
- Exiting Walk mode returns to the previous overview camera.

### Controls

- `WASD` and arrow keys: move
- Mouse: look
- `Space`: jump
- `Shift`: move faster
- `Esc`: release mouse / pause navigation

A compact guideline appears at the bottom-right whenever Walk mode is active. It remains readable but does not block the order rail or critical simulation metrics.

### Player representation

In 3D Overview, the player is represented as the same swanky chef style with a distinctive copper-accented jacket and toque. In first person, subtle jacket sleeves/hands appear at the bottom of the view so the user still feels embodied without obstructing sightlines.

### Movement model

- Eye height is approximately 1.65–1.72 m.
- Walking and boosted speeds are comfortable architectural-walkthrough speeds.
- Gravity and a restrained jump are supported.
- A capsule-style player collider prevents movement through walls, the pillar, equipment, counters, pass ledges, and other fixed geometry.
- Floors support standing and jumping; the player cannot fall through the scene.
- Service windows remain viewable but not traversable.
- D2 remains the architectural opening, although the walkthrough keeps the player within a bounded inspection area rather than allowing an indefinite walk outside the model.
- Moving simulated workers do not hard-block the player. A soft proximity response and visual overlap warning avoid deadlocks in narrow aisles.

Keyboard controls must not activate while the user is typing in an input, select, or text area.

## Full Sim Presentation

The Full Sim view selector sits near playback controls and does not reset the run when switching between 2D Operations, 3D Overview, and Walk Kitchen.

All views share:

- elapsed service time and playback speed;
- play, pause, scrub, and restart state;
- live backlog;
- completed covers/orders;
- average and percentile wait times;
- station queues;
- active ticket rail;
- current layout verdict and findings.

The 3D views add spatial worker motion without hiding the analytical information. Desktop layouts retain the order rail and key performance HUD. Smaller screens may collapse detailed panels, but playback and exit controls must remain accessible.

## Rendering and Reliability

- Reuse the existing context-loss guard and restart flow.
- Keep one WebGL canvas mounted per active workspace.
- Cap device pixel ratio using the current conservative range.
- Reuse geometries and materials across chef instances where practical.
- Reuse stainless, dark-metal, glass, and accent materials across equipment families, and keep model polygon counts intentionally modest.
- Avoid HDR environments, high-resolution dynamic shadows, post-processing, or external animated models.
- Update avatar transforms within the render loop without causing full React rerenders every frame.
- Dispose scene resources when changing workspaces.
- Transparent wall materials must not obscure labels or cause severe depth-sorting artifacts.

## Accessibility and Input Safety

- Every visual toggle has a text label and `aria-pressed` state.
- View selectors and Walk-mode exit remain keyboard reachable before pointer capture begins.
- The controls guideline is also exposed as accessible text.
- Reduced-motion preference disables walk-cycle exaggeration and smooth camera bob.
- First-person mode displays a visible center reticle and an explicit `Exit walk mode` control.
- Loss of pointer lock pauses player motion immediately.

## Test Strategy

Implementation follows test-first development.

### Unit and component tests

- Wall splitting preserves door gaps and builds correct below/above service-window panels.
- Transparent-wall state reaches wall materials while edge opacity remains unchanged.
- Clearance render data includes fill, outline, label, and the correct converted dimension.
- Simulation-frame interpolation returns stable positions, headings, and state transitions.
- View switching preserves playback time and live metrics.
- Walk input maps WASD, arrows, Space, Shift, and Escape correctly.
- Keyboard movement is ignored while form controls are focused.
- Collision resolution prevents traversal through walls, pillar, equipment, and pass ledges.
- D2 spawn is valid and inside the navigable room.
- Equipment presets expose identifying geometry for every seeded equipment family while retaining their exact configured bounds.
- UI gestures and direct application-service calls produce the same validated command result.
- Commands and queries accept and return JSON-safe data without React, DOM, Konva, or Three.js objects.
- Kitchen visual and simulation presets are resolved through registries with a safe generic fallback.
- Dry-run commands report mutations and validation findings without changing the document revision.
- Moving, rotating, resizing, adding, and removing an item through the plan updates only the affected 3D component while preserving the Canvas instance and camera/control state.

### Browser tests

- Toggle clearances and confirm visible labeled boundaries.
- Toggle transparent walls and confirm wall outlines remain visible.
- Confirm both service-window cutouts, clean outgoing pass, and dirty return are visible.
- Start Full Sim, switch between all three views, and confirm playback and backlog continue.
- Confirm chef avatars change position during playback.
- Enter Walk Kitchen, use keyboard controls, jump, release pointer lock, and exit.
- Trigger WebGL context loss and verify the renderer can restart in normal and simulation 3D views.
- Run without uncaught page errors or WebGL warnings under repeated view changes.
- In Split view, orbit to a non-default camera, edit several items in the plan, and confirm the same WebGL canvas, camera transform, orbit target, and unaffected mesh instances remain active.

## Acceptance Criteria

The feature is complete when:

1. Clearances are immediately readable from top and perspective cameras without selecting equipment.
2. Transparent walls retain strong structural edges and unmistakable door/window boundaries.
3. Clean and dirty service windows are modeled at their configured sill and opening heights.
4. Completed orders visibly travel through the clean pass to outside the kitchen.
5. The live five-person simulation shows recognizable chef avatars moving smoothly among real stations.
6. 2D Operations, 3D Overview, and Walk Kitchen share one uninterrupted playback timeline and metrics state.
7. Walk Kitchen supports WASD, arrows, mouse-look, Space, Shift, and Escape with an on-screen bottom-right guide.
8. The player cannot walk through solid architecture or equipment and does not fall through the floor.
9. Other simulated staff remain visible while the user walks the kitchen.
10. Every seeded appliance, counter, sink, and wash-up item is recognizable without relying solely on its floating label.
11. Layout mutations are available through validated, serializable application commands used by the UI and suitable for a future WebMCP adapter.
12. Core geometry, editing, rendering orchestration, and agent playback do not assume a kitchen domain; kitchen-specific presets and workflow rules are registered modules.
13. Plan edits incrementally update the live 3D scene without remounting the renderer or resetting the camera and controls.
14. All automated tests, production build, browser checks, and WebGL recovery checks pass.
