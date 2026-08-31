# Manta Raja Kitchen Lab — Design Specification

Date: 2026-08-31

## Purpose

Build a desktop-first browser application that reconstructs the proposed Manta Raja Indian restaurant kitchen as an editable metric plan, generates a synchronized Three.js model, and simulates a busy service so layout alternatives can be compared with evidence.

The app is a planning aid. It does not replace review by local fire, ventilation, food-safety, accessibility, building, or occupational-safety professionals.

## Confirmed Site and Service Context

- The kitchen has a jagged footprint whose overall extent is approximately 3.9 m × 6.65 m.
- One graph-paper square in the source layout equals 100 mm × 100 mm.
- D2 is the current staff entrance and ingredient-receiving route.
- D6 will be permanently closed and modeled as a continuous wall.
- The right side has two service windows: clean dishes leave through the upper clean window; dirty dishes return through the lower dirty window.
- Only the shaded pillar shown on the equipment sketch is inside the modeled kitchen.
- A storage area sits to the left of the 700 × 800 mm upright freezer.
- The 700 × 700 mm tandoor sits directly against the pillar.
- The current hood concept covers the continuous hot line, including the six-burner range, flat-top/fryer station, and tandoor, and exhausts outward. The hood position remains editable in planning.
- The initial peak-service scenario uses one head chef, one sous chef, two chefs de partie, and one busser/washer.
- The restaurant has 20 tables with two to three guests each. The default simulation uses a 50-cover wave over 60 minutes and assumes most dishes are cooked to order.

## Product Scope

### Included

- Editable 2D kitchen plan on a true metric grid.
- Click, multiselect, drag, keyboard nudge, rotate, duplicate, add, and remove equipment.
- Per-item dimensions, with a lock that starts enabled for known equipment but can be disabled for editing.
- Global display units: millimetres, centimetres, inches, and feet. Internal storage remains millimetres.
- Equipment library plus custom-item creation.
- Locked architectural layer for walls, service windows, D2, sealed D6, storage zone, and pillar.
- Undo and redo for editor mutations.
- Saved layout variants and baseline-versus-variant comparison.
- Import and export of layout JSON.
- Browser persistence using versioned local storage.
- Synchronized 2D, 3D, split, compare, and simulation views.
- Three.js scene generated from the same layout data as the 2D plan.
- Configurable busy-service scenarios, animated staff movement, station queues, heatmaps, and playback controls.
- Comparative measurements and rule-based layout findings.
- A default approximate trace of the supplied sketch that the user can correct in the editor.

### Excluded from the first release

- Multi-user collaboration, accounts, or cloud persistence.
- BIM, DWG, DXF, or IFC import/export.
- Fluid, thermal, smoke, fire, or HVAC engineering simulation.
- Regulatory compliance certification.
- Automatic menu costing, inventory, purchasing, or staff scheduling.
- Photorealistic equipment assets. The first release uses clear procedural models with recognizable materials and forms.

## Visual and Interaction Direction

### Visual thesis

A precise culinary operations lab: charcoal and stainless-steel surfaces, warm sand backgrounds, a restrained copper-red accent, and a metric grid that keeps the application practical rather than decorative.

### Content plan

1. Primary working surface: plan, 3D, split, compare, or simulation view.
2. Equipment library: known equipment and custom-item creation.
3. Context inspector: name, category, dimensions, position, rotation, locks, clearances, and item actions.
4. Simulation controls and results: scenario assumptions, playback, scorecard, pressure timeline, and findings.

### Interaction thesis

- Dragging has visible snap feedback at 100 mm increments and immediate dimension/position feedback.
- Switching between plan, 3D, and split views preserves selection and camera context.
- Simulation playback uses restrained agent movement, route trails, pressure heatmaps, and clear timeline transitions.

The interface is desktop-first because precise spatial editing needs screen area. Smaller screens remain usable for viewing, simulation playback, and simple property edits, but complex layout editing is not optimized for phones.

## Application Architecture

Use a Vite, React, and TypeScript application.

- `react-konva` renders the interactive 2D metric canvas.
- Three.js is rendered through `@react-three/fiber` and `@react-three/drei` so the 3D scene remains declarative and synchronized with React state.
- Zustand owns editor, layout, history, selection, scenario, and simulation state.
- Zod validates imported JSON and migrates saved local data between schema versions.
- Vitest and Testing Library cover state, interaction, unit conversion, and simulation behavior.
- Playwright covers the core browser workflow after the application is functional.

The application does not maintain separate 2D and 3D models. Both views derive from one canonical layout document in millimetres.

## Canonical Data Model

### Project

- Schema version.
- Project name and display-unit preference.
- Architectural shell.
- Equipment catalog entries.
- Layout variants.
- Simulation scenarios.
- Active variant and scenario identifiers.

### Architecture

- Jagged wall polygon in millimetres.
- Doors and openings, including D2 and the sealed D6 wall segment.
- Clean and dirty service windows.
- Pillar footprint.
- Adjacent storage zone.
- Architecture is locked by default and can only be unlocked through an explicit project setting.

### Equipment item

- Stable identifier.
- Human-readable label shown inside its footprint.
- Category: cooking, cold storage, prep, washing, landing, storage, hood, or custom.
- Width, depth, and height in millimetres.
- X/Y position in millimetres and rotation in degrees.
- Dimension-lock flag.
- Movable and removable flags.
- Visual/material preset.
- Optional working-clearance polygon, door-swing geometry, heat-zone metadata, and station capabilities.

### Layout variant

- Stable identifier, name, and optional parent variant.
- Equipment transforms and dimensions.
- Created and updated timestamps.
- Stored simulation summaries for comparison.

### Simulation scenario

- Covers, duration, and arrival pattern.
- Staff roles and counts.
- Cook-to-order ratio.
- Station task durations and capacities.
- Door-swing, clearance, collision, and dirty/clean-crossing checks.
- Deterministic random seed.

## Initial Equipment Catalog

The initial trace includes, at minimum:

- 1,200 × 700 mm flat-top and fryer equipment stand with storage below.
- 1,200 × 900 mm six-burner range.
- 700 × 700 mm tandoor.
- 700 × 800 mm upright freezer.
- 1,200 × 700 mm fridge/clean-prep station.
- 1,200 × 700 mm prep fridge/counter.
- Approximately 650 × 650 mm mixer.
- 1,200 × 700 mm double sink.
- Approximately 1,400 × 850 mm two-door fridge; the editor exposes its dimensions for correction.
- Approximately 900 × 700 mm dirty landing.
- 700 × 700 mm pre-rinse sink.
- 700 × 750 mm dishwasher.
- 700 × 700 mm clean landing.
- Working table and handwash/sink items shown in the source sketch, with dimensions editable for correction.
- Continuous hood above the hot line.

Any uncertain transcription is explicitly marked as approximate in the initial project data. The source photo can be toggled as a reference layer while the user corrects the trace.

## Editor Behavior

### Metric grid and movement

- Internal coordinates use millimetres.
- Default snap interval is 100 mm, matching one source-paper square.
- A heavier major line appears every 1,000 mm.
- Dragging shows live X/Y coordinates and guides.
- Arrow keys nudge by one grid interval; Shift plus arrow uses a smaller precision increment.
- Rotation defaults to 90-degree steps, with a numeric angle field for exceptional cases.
- Collision and boundary warnings do not block placement; they remain visible so alternatives can be explored.

### Selection and editing

- Every equipment item is clickable and draggable.
- Labels and current dimensions remain inside the footprint when space permits; very small items use a compact label with a hover/focus detail.
- Selecting an item opens its inspector.
- Known equipment starts with dimensions locked. Unlocking enables width and depth edits and resize handles.
- Unit changes only affect display and input parsing, never stored dimensions.
- Additions come from the equipment library or a custom-item form.
- Duplicate preserves dimensions and metadata but creates a new identifier.
- Remove requires one lightweight confirmation and is undoable.
- Undo/redo covers add, remove, move, rotate, resize, and property edits.

### Layout variants

- The supplied trace is preserved as a baseline variant.
- Users can duplicate a variant, rename it, and compare any two variants.
- Compare view can show side-by-side plans, side-by-side 3D scenes, or score differences.

## Three.js Model

- The floor and walls are generated from the architectural polygon.
- Walls, D2, service windows, sealed D6 segment, pillar, and storage zone are visually distinct.
- Equipment uses procedural geometry with category-specific details: burner rings, tandoor opening, sinks, doors, shelves, and work surfaces.
- Door and refrigerator swing areas can be toggled.
- Working clearances, heat zones, and service routes can be toggled.
- Orbit, pan, zoom, top, and perspective cameras are available.
- Clicking equipment in 3D selects the same item in the 2D canvas and inspector.
- Dragging remains a 2D-plan operation in the first release to preserve placement precision.

## Busy-Service Simulation

The simulation is a deterministic, simplified agent-and-queue model designed for comparing layouts.

### Agents and tasks

- Roles: head chef, sous chef, CDP 1, CDP 2, and busser/washer by default.
- Orders arrive according to the selected seating pattern.
- Each order generates configurable tasks such as cold retrieval, prep, range cooking, flat-top/fryer cooking, tandoor cooking, finishing, and pass delivery.
- Dirty-dish work generates return, landing, pre-rinse, dishwasher, clean landing, and put-away tasks.
- Roles prefer assigned stations but can assist when scenario rules allow.

### Movement

- A navigation grid is derived from the room polygon, equipment footprints, active door swings, and working-clearance zones.
- Agents use shortest traversable routes with penalties for narrow, busy, or opposing-flow cells.
- Agents reserve station working positions while tasks are active.
- Near-overlaps, opposing movements, blocked routes, and wait states become measurable events.

### Playback

- Play, pause, restart, timeline scrub, and 0.5×/1×/2×/4× speeds.
- Follow one role or use the overview camera.
- Toggle route trails, live heatmap, station queues, clearances, and dirty/clean paths.
- The same deterministic seed produces the same result for fair variant comparisons.

### Metrics

- Travel distance by role and total.
- Travel time and task time by role.
- Station utilization and queue time.
- Congestion and opposing-flow events.
- Door-swing and working-clearance conflicts.
- Dirty/clean path crossings.
- Blocked or unreachable tasks.
- Finish-to-clean-window distance and dirty-window-to-wash distance.
- Order completion distribution and simulated throughput.

### Recommendations

Recommendations are rule-based and comparative. Each finding includes the evidence, affected route or station, and measured impact in a compared variant.

Examples include:

- Move a high-frequency cold store closer to its prep consumer.
- Reduce finish-to-pass travel.
- Separate hot-line working zones from through-traffic.
- Protect the busser route from clean-food movement.
- Remove door-swing conflicts or narrow pinch points.
- Preserve a wash-up arrangement that already performs well.

The app does not declare a layout universally “best.” It ranks variants under the selected assumptions and clearly identifies assumptions that remain uncertain.

## Persistence, Import, and Export

- Autosave the active project to versioned local storage after a short debounce.
- Provide explicit JSON export and import.
- Validate imported files before mutating application state.
- On schema mismatch, migrate supported older versions and reject unsupported future versions with a clear message.
- Keep a recoverable last-known-good local snapshot if current saved data cannot be parsed.

## Error and Edge-Case Handling

- Equipment outside the room, overlapping fixed architecture, or blocking required routes receives a visible warning.
- A simulation cannot start if D2, a required service window, or an assigned station is unreachable.
- Invalid numeric input retains the last valid value and explains the accepted range.
- Removing equipment referenced by a scenario prompts the user to reassign or remove its tasks.
- A failed 3D/WebGL initialization leaves the 2D editor usable and displays a diagnostic message.
- Empty and custom projects remain usable without simulation until required station capabilities are assigned.

## Testing and Acceptance Criteria

### Unit and state tests

- Unit conversion round-trips without changing stored millimetres.
- Snapping, rotation, selection, move, resize, add, duplicate, remove, undo, and redo are deterministic.
- Layout variants do not mutate their parent.
- Import validation and schema migrations preserve valid data and reject malformed data.
- Simulation runs are deterministic for the same layout, scenario, and seed.
- Navigation avoids equipment and fixed architecture and reports unreachable tasks.

### Integration tests

- Editing an item updates both 2D and 3D representations.
- Selecting in either view synchronizes the inspector.
- A custom item can be added, configured, duplicated, removed, and restored with undo.
- Switching display units updates every visible measurement without geometry drift.
- Baseline and alternative variants can be simulated and compared.

### Browser acceptance flow

1. Open the seeded Manta Raja project.
2. Correct an equipment position and dimension.
3. Add and remove a custom item.
4. Switch units to feet/inches and back to millimetres without drift.
5. Inspect the updated Three.js scene.
6. Run the default five-person, 50-cover scenario.
7. Duplicate the baseline, rearrange equipment, rerun, and compare metrics.
8. Export and re-import the project.

## Delivery Order

1. Application shell, data schema, seeded Manta Raja project, units, and persistence.
2. Fully functional 2D metric editor and equipment library.
3. Synchronized procedural Three.js view.
4. Scenario editor, navigation, queues, animated agents, and metrics.
5. Variant comparison, recommendation rules, report view, and browser-level verification.

