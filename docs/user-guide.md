# Manta Raja Kitchen Lab — User Guide

## What opens by default

The app opens the approximate trace of the supplied kitchen sketch. The overall coordinate envelope is 3,900 × 6,650 mm. The origin is the upper-left of the plan, X increases to the right, and Y increases downward. One pale grid square is 100 × 100 mm; every tenth line is one metre.

Confirmed anchors are already modeled: storage is left of the 700 × 800 mm upright freezer, the 700 × 700 mm tandoor meets the shaded pillar, D2 is the staff/receiving entrance, D6 is a continuous sealed wall, and the two right-side openings are separate clean and dirty service windows. A `~` marks dimensions transcribed as approximate.

## Correcting the plan

Select any equipment footprint on the plan or its equivalent button in the Equipment list. Drag it to move on the active snap grid; a live X/Y badge shows the snapped destination. You can also edit X and Y in the inspector. Arrow keys move by the selected snap interval; Shift + arrow moves by 10 mm.

Known dimensions start locked. Clear **Lock dimensions** to reveal resize/rotation handles on the selected footprint and to edit width, depth, and height in the inspector. Handle changes snap to the active interval. The inspector also controls the label, category, rotation, front clearance, and simulation capabilities. Invalid lengths return to the last valid value and show the accepted range.

The **Display units** setting supports millimetres, centimetres, inches, and feet/inches. Units only affect display and parsing; internal coordinates remain millimetres. The **Snap interval** can be 10, 50, 100, or 250 mm.

The live geometry audit lists equipment outside the jagged boundary, footprint collisions, pillar overlaps, and obstructed front work zones. Amber dashed footprints need inspection; red errors identify physical overlaps or boundary failures. Warnings do not prevent experimental placement.

### Selection and item actions

- Click an item to select it; Shift-click list/canvas items for multiselect.
- **Rotate 90°** rotates selected movable equipment.
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
- **Top**, **Perspective**, and **Fit room** change the camera.
- **Clearances** shows work/heat zones, D2 swing, and refrigerator/freezer swing arcs.
- Click a mesh or its visible 3D label to select the same item used by the plan inspector.
- Split view places the editable plan beside the synchronized model.

If WebGL cannot initialize, the app shows a diagnostic while leaving the Plan editor usable.

## Busy-service simulation

The default pressure test is 50 covers over 60 minutes with one head chef, one sous chef, two CDPs, and one busser/washer. It assumes 85% cooked to order. Change covers, duration, arrival pattern, ratio, seed, staff counts, task-duration ranges, station capacities, and enabled pressure checks in **Service setup**.

Before running, validation requires D2, both service windows, staff, and all required station capabilities to be present and reachable. Missing or unreachable stations link back to their affected equipment selection.

The engine creates cold retrieval → prep → cook → finish → clean-window chains and dirty-window → landing → pre-rinse → dishwasher → clean-landing chains. It routes agents around equipment on a 100 mm navigation grid, reserves stations, applies configured capacity, and records queues and one-second playback frames. The same seed and inputs produce the same result.

After **Run service**:

- Play, pause, restart, scrub, or choose 0.5×, 1×, 2×, or 4× playback.
- Follow a role or retain the overview.
- Toggle heatmap, recent trails, queue totals, clearance footprints, and dirty/clean flows.
- Inspect total/per-role travel, order throughput, P90 completion, station use, congestion pressure over time, dirty/clean crossings, door conflicts, and unreachable tasks.

Task durations are planning estimates. Tune them after menu and equipment trials; do not interpret output as a prediction of exact ticket times.

## Comparing layouts and reports

Compare uses the same scenario, staffing, timings, and seed for both variants. Choose baseline and candidate, then switch between Plan, 3D massing, and Score views. Candidate deltas are measured against baseline. Findings state their rule, evidence, and affected equipment; selecting one highlights those items in both plans.

The app never declares a universal “best” layout. “Performs better” means better under the selected scenario. Preserve positive findings as well as addressing high and medium pressure points. **Report** creates a print/PDF view with assumptions, metrics, findings, date, and safety disclaimer.

## Import, export, autosave, and recovery

The browser autosaves a versioned current project and last-known-good snapshot. **Export project** downloads human-readable JSON. **Import** validates the entire file before replacing current state; malformed or unsupported future schemas leave the current project untouched. Supported version-0 files migrate to schema version 1.

Keep exported checkpoints before major alternatives. JSON is the supported exchange format; this release does not import BIM, DWG, DXF, or IFC.

## Planning limitations

The model compares circulation and simplified station queues. It does not simulate heat, smoke, exhaust capture, make-up air, fire, gas, electrical load, drainage, grease, structural capacity, acoustics, accessibility, or regulatory compliance. Confirm hood coverage and exhaust, tandoor/fire separation, food-safety zoning, worker clearances, accessibility, building constraints, and all equipment services with qualified local professionals before ordering equipment or constructing the kitchen.
