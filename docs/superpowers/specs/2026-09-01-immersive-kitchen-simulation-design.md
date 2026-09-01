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

### Browser tests

- Toggle clearances and confirm visible labeled boundaries.
- Toggle transparent walls and confirm wall outlines remain visible.
- Confirm both service-window cutouts, clean outgoing pass, and dirty return are visible.
- Start Full Sim, switch between all three views, and confirm playback and backlog continue.
- Confirm chef avatars change position during playback.
- Enter Walk Kitchen, use keyboard controls, jump, release pointer lock, and exit.
- Trigger WebGL context loss and verify the renderer can restart in normal and simulation 3D views.
- Run without uncaught page errors or WebGL warnings under repeated view changes.

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
11. All automated tests, production build, browser checks, and WebGL recovery checks pass.
