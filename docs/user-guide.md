# Kitchen Planner — User Guide

## What opens by default

The app opens the approximate trace of the supplied kitchen sketch. The overall coordinate envelope is 3,900 × 6,650 mm. The origin is the upper-left of the plan, X increases to the right, and Y increases downward. One pale grid square is 100 × 100 mm; every tenth line is one metre.

Confirmed anchors are already modeled: storage is left of the 700 × 800 mm upright freezer, the 700 × 700 mm tandoor meets the shaded pillar, D2 is the staff/receiving entrance, D6 is a continuous sealed wall, and the two right-side openings are separate clean and dirty service windows. A `~` marks dimensions transcribed as approximate.

## Correcting the plan

Select any equipment footprint on the plan or its equivalent button in the Equipment list. The 100 mm grid remains visible across the complete working floor, including empty white space. Drag equipment to move it on the active snap grid; a live X/Y badge shows the snapped destination. You can also edit X and Y in the inspector. Arrow keys move by the selected snap interval; Shift + arrow moves by 10 mm.

Known dimensions start locked. Select an item and press **Resize** (or clear **Lock dimensions**) to reveal click-drag resize/rotation handles. Handle changes snap to the active interval and immediately update width and depth in the inspector. The toolbar's **Left** and **Right** buttons rotate the selected item by 90 degrees. The inspector also controls the label, category, rotation, front clearance, and simulation capabilities. Invalid lengths return to the last valid value and show the accepted range.

The **Display units** setting supports millimetres, centimetres, inches, and feet/inches. Units only affect display and parsing; internal coordinates remain millimetres. The **Snap interval** can be 10, 50, 100, or 250 mm.

The selected-item **Configuration** menu offers typical variants for that equipment family—for example upright, under-counter, prep-counter, and top-opening refrigeration. Applying a configuration updates the normal label, size, height, clearance, capabilities, and matching 3D skin as one undoable change while preserving its position and rotation. All applied values remain editable. **Typical configuration · modified** means one or more values now differ from that configuration's defaults; it does not discard the configuration choice.

The live geometry audit lists equipment outside the jagged boundary, footprint collisions, pillar overlaps, and obstructed front work zones. Amber dashed footprints need inspection; red errors identify physical overlaps or boundary failures. Warnings do not prevent experimental placement.

### Selection and item actions

- Click an item to select it; Shift-click list/canvas items for multiselect.
- **Left** and **Right** rotate selected movable equipment by 90° in the indicated direction.
- **Resize** reveals click-drag transform handles and unlocks known dimensions.
- **Duplicate** creates a separate item with the same metadata.
- **Remove** asks for a second confirmation and remains undoable.
- **Add custom item** accepts a label, width, and depth; finish its category, height, clearance, and capabilities in the inspector.
- `Cmd/Ctrl + Z` undo, `Cmd/Ctrl + Shift + Z` redo, `Cmd/Ctrl + D` duplicate, Delete remove, and Escape clear selection.

The source photograph can be toggled behind the vector trace for alignment checks. The architectural layer is locked by default; its setting makes that protection explicit.

## Layout variants

**New variant** duplicates the active layout without mutating its parent and activates the copy. Use variants for alternatives rather than overwriting the supplied baseline. The active variant selector switches between them. A variant can be deleted once another remains.

## 3D and Split views

The 3D model and plan use the same active project data. Equipment dimensions, positions, rotations, pillar, storage zone, floor, walls, D2, service-window gaps, and sealed D6 are generated procedurally.

- Drag to orbit, Shift-drag to pan, and scroll to zoom.
- **Top** and **Perspective** switch camera modes and reset the orbit target; pressing the active mode again also restores its default framing. **Fit room** recovers the complete room after orbiting, panning, or zooming.
- **Clearances** shows work/heat zones, D2 swing, and refrigerator/freezer swing arcs.
- **Transparent walls** removes wall surfaces and their shadows while retaining precise wall borders, pass frames, ledges, pillars, and openings.
- Click a mesh or its visible 3D label to select the same item used by the plan inspector. Selection is shown by the item's exact rotated cuboid bounds, without a circular marker.
- Split view places the editable plan beside the synchronized model.

The equipment models use self-contained procedural commercial-kitchen materials and details: brushed stainless worktops and shells, cast-iron burners, fryer wells, tandoor mouth, refrigeration doors and seals, sinks and faucets, dishwasher panels, mixer parts, shelving, and hood geometry. Changing a component or configuration updates the existing live scene rather than restarting the canvas or resetting its camera.

### Walking through the kitchen

Choose **Walk kitchen**, then click the kitchen to look around. W/Up and S/Down move forward and backward; A/Left move camera-relative left; D/Right move camera-relative right; Shift moves faster; Space performs an adaptive jump; and Escape releases the pointer. The control reminder remains at the lower right while walk mode is active.

Jump height adapts to jumpable equipment ahead. You can land on low counters, walk across them, and clear tall appliances when there is room. Walls and pillars remain solid at every height. Your live X, Y, and elevation are shared with the synchronized scene without remounting it.

The renderer caps high-density framebuffer use and releases its GPU resources when leaving 3D or Split view. If the browser still interrupts WebGL, the app removes the detached labels and shows **Restart 3D renderer**, which remounts the model without changing the plan. If WebGL cannot initialize at all, the Plan editor remains usable.

## Busy-service simulation

The default pressure test is 50 covers over 60 minutes with one head chef, one sous chef, two CDPs, and one busser/washer. It assumes 85% cooked to order. Change covers, duration, arrival pattern, ratio, seed, staff counts, task-duration ranges, station capacities, and enabled pressure checks in **Service setup**.

Before running, validation requires D2, both service windows, staff, and all required station capabilities to be present and reachable. Missing or unreachable stations link back to their affected equipment selection.

The engine creates cold retrieval → prep → cook → finish → clean-window chains and dirty-window → landing → pre-rinse → dishwasher → clean-landing chains. Tasks are dispatched globally in service-time order so one ticket cannot reserve the whole brigade in advance. Both service windows are real routing destinations at their measured wall openings. The engine routes agents around equipment on a 100 mm navigation grid, reserves stations, applies configured capacity, and records queues and one-second playback frames. The same seed and inputs produce the same result.

After **Run service**, the Full Sim view treats service as a continuous live system:

- Play, pause, restart, scrub, or choose 1×, 5×, 25×, or 100× playback.
- Follow a role or retain the overview.
- Toggle heatmap, recent trails, queue totals, clearance footprints, and dirty/clean flows.
- Watch each ticket arrive, progress through its current station, accumulate wait, and leave through the clean service window. Live station badges show active work and the current queue at that exact playback moment.
- Inspect live backlog, served orders, average completed wait, oldest open ticket, final average/P50/P90 wait, the wait-time distribution, peak backlog, tickets per hour, station use, staff travel, congestion pressure, dirty/clean crossings, door conflicts, and unreachable tasks.
- Use the layout verdict as an evidence summary for the configured scenario. It is not a universal pass/fail judgment; changing covers, staffing, timings, capacities, or the menu can change it substantially.

Task durations are planning estimates. Tune them after menu and equipment trials; do not interpret output as a prediction of exact ticket times.

## Comparing layouts and reports

Compare uses the same scenario, staffing, timings, and seed for both variants. Choose baseline and candidate, then switch between Plan, 3D massing, and Score views. Candidate deltas are measured against baseline. Findings state their rule, evidence, and affected equipment; selecting one highlights those items in both plans.

The app never declares a universal “best” layout. “Performs better” means better under the selected scenario. Preserve positive findings as well as addressing high and medium pressure points. **Report** creates a print/PDF view with assumptions, metrics, findings, date, and safety disclaimer.

## Import, export, autosave, and recovery

The browser autosaves a versioned current project and last-known-good snapshot. **Export all layouts** downloads one human-readable schema-version-2 JSON file containing the complete editable project: every layout and its distinct room architecture, openings, pillars, storage zones, equipment with stable component IDs, physical configurations and appearance skins, operational profiles and layout constraints, scenarios and simulation settings, adopted experiment manifests, display and snap settings, and the active layout and scenario IDs.

**Import** validates the entire file before replacing current state. Version-0 and version-1 projects are migrated to version 2; valid version-2 projects are loaded directly. Malformed files, unknown fields, invalid references, and unsupported future schema versions leave the open project untouched. A successful import is an atomic document replacement: current selection and undo/redo history are cleared, and any uncommitted preview token from the previously open document becomes invalid. Draft previews, camera position, open drawers, and other transient interface state are not part of the exported project.

Older schema-valid projects that predate equipment 3D presets are enriched on load: known example-kitchen items regain their distinctive registered skins, explicit custom presets are preserved, and unknown custom items safely remain generic. This compatibility step does not alter placement, dimensions, rotations, labels, variants, scenarios, or revision history.

Keep exported checkpoints before major alternatives. JSON is the supported exchange format; this release does not import BIM, DWG, DXF, or IFC. Exported plans and simulation results are planning artifacts, not regulatory certification or approval. Qualified local professionals and authorities must review fire, ventilation, hygiene, accessibility, structure, services, and code compliance.

## Driving the planner with an AI agent (WebMCP)

In a browser that supports the experimental WebMCP API, the planner registers site tools that a compatible AI agent (browser assistant sidebar or built-in agent) can call directly on the open page. Open **AI tools** in the top bar to see availability, the registered tools, and a copyable starter prompt for your agent.

Your agent can then do everything you can: read the coordinate system and catalog, read and draw the plan (add, move, rotate, resize, relabel, duplicate, remove components; edit walls, openings, pillars, zones), manage layout variants, edit service-simulation scenarios, run simulations and read their metrics, undo/redo, and export the project JSON to save or download. All geometry travels as exact millimetre coordinates — the agent works from the structured layout, so it never has to interpret screenshots of the canvas.

Every change is revision-guarded and atomic: the agent previews a complete operation batch against the revision it read, then applies it with a single-use token. If you edited the plan in the meantime, the apply fails with a stale-revision error and the agent must re-read and recompute. Each applied batch is one undo step for you, and tool-driven edits update the live 2D, 3D, walk, and simulation views without a reload.

You stay in control of reference material: attached images and instructions go to your chosen agent, never to this page. The agent marks uncertain dimensions as approximate and should ask you when scale cannot be inferred. Browsers without WebMCP keep the full human interface; the panel simply shows setup guidance.

## Planning limitations

The model compares circulation and simplified station queues. It does not simulate heat, smoke, exhaust capture, make-up air, fire, gas, electrical load, drainage, grease, structural capacity, acoustics, accessibility, or regulatory compliance. Confirm hood coverage and exhaust, tandoor/fire separation, food-safety zoning, worker clearances, accessibility, building constraints, and all equipment services with qualified local professionals before ordering equipment or constructing the kitchen.
