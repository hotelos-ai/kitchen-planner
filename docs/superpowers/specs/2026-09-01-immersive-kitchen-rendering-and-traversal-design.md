# Immersive Kitchen Rendering and Traversal Design

**Date:** 2026-09-01  
**Status:** Approved

## Purpose

Repair the 3D kitchen controls and restore a distinctive, high-quality commercial-kitchen presentation. Transparent walls must actually disappear while their borders remain visible. First-person movement must map left and right correctly and allow the player to jump onto or over equipment. Older saved projects must regain the equipment-specific visuals they lost. Equipment, selection feedback, and chef avatars must look deliberate and recognizable without adding runtime asset downloads.

When a component is selected, the inspector must also offer typical domain configurations. Choosing one applies its normal dimensions, capabilities, clearance, category, label, and matching 3D visual while preserving placement and rotation. These configurations remain editable afterward and are represented as structured component data so the eventual agent-tool boundary can discover and apply them.

## Confirmed Root Causes

1. Transparent walls are currently closed boxes rendered at 16% opacity. The near and far faces alpha-composite, and foreground wall runs still read as solid. The existing tests only prove that the toggle boolean reaches the renderer; they do not verify material behavior.
2. A persisted project created before `visualPreset` was added remains schema-valid because that field is optional. The equipment visual registry therefore receives no preset and correctly—but undesirably—falls back to the same generic brown box for every item.
3. The first-person controller negates its computed right vector. A/Left and D/Right therefore move in the opposite lateral direction even though their keyboard mappings are correct.
4. Jumping changes only the camera's vertical position. Walk collision is entirely two-dimensional, so an airborne player remains blocked by every equipment footprint at every height.
5. Selected equipment renders both an exact cuboid border and a circular ground ring. The ring is imprecise and conflicts with the requested square/rectangular component feedback.
6. The current chef has the required uniform pieces but lacks facial features and refined proportions, making it appear unfinished at close range.

## Experience Design

### Visual thesis

A clean, working Indian restaurant kitchen rendered in brushed stainless steel, dark cast iron, enamel, rubber, glass, and warm task light. Equipment should read by silhouette and working details before a label is read. The result should feel polished and physically grounded rather than outlined, toy-like, or uniformly box-shaped.

### Interaction thesis

- Wall transparency becomes an immediate architectural X-ray: surfaces and their shadows disappear, but precise wall edges, openings, and pass frames remain.
- Space produces an obstacle-aware jump. The player can land on low equipment or clear taller equipment while walls and pillars remain solid boundaries.
- Selection uses the item's true rectangular/cuboid bounds, including rotation, with no circular marker.

### Workspace content

The existing application layout, labels, 2D canvas, and simulation overlays remain intact. This work changes 3D rendering, first-person traversal, the selected-item inspector, and the minimum component metadata/persistence needed for visual recovery and configuration modifiers.

## Architecture

### 1. Wall surface and outline separation

`ArchitectureMesh` keeps a single geometry source from `buildWallPanels`, but transparent mode changes the render contract:

- surface color writing is disabled;
- surface opacity is zero;
- depth writing is disabled;
- wall shadow casting is disabled;
- edge lines remain enabled and use the existing dark architectural color;
- service-window frames, pass ledges, openings, pillars, and floor remain visible.

A pure wall-material descriptor will define opaque and outline-only states so unit tests inspect the real material settings rather than only the React toggle prop.

### 2. Visual-preset recovery

Project loading and importing will run a pure visual-preset hydration step after schema validation:

- preserve every explicit `visualPreset` exactly;
- restore known Manta Raja equipment from stable item identifiers and known seed presets;
- infer a safe registered preset from known capabilities/category only when the match is unambiguous;
- use `generic` for genuinely custom or unknown items;
- persist the hydrated result on the next normal save.

This is compatibility enrichment, not a project-wide reset. Positions, dimensions, rotations, names, notes, revisions, variants, and scenarios remain untouched.

### 3. Procedural PBR equipment system

The equipment registry remains the extension point. Its procedural models will use shared, reusable primitives and material presets:

- brushed stainless shells and worktops;
- dark cast-iron burners and grates;
- black enamel controls and fryer wells;
- rubber feet, handles, seals, and guards;
- glass or dark inset panels where appropriate;
- rounded appliance shells and bevels that catch light;
- seams, vents, hinges, handles, knobs, racks, faucets, basins, legs, shelves, ingredient pans, and tandoor mouth detail.

The scene will use restrained key/fill/task lighting and a self-contained procedural environment reflection. No remote GLB, texture CDN, runtime model fetch, or asset-licensing dependency is introduced. Material and geometry helpers remain usable by future component registries.

### 4. Precise component selection

`EquipmentMesh` will remove the circular ground ring. A selected item will show one orange outline matching the item's exact local cuboid dimensions. Because the outline lives inside the already rotated item group, it follows the item's rotation and placement automatically. The transparent selection fill remains non-occluding.

### 5. Component configuration modifiers

A domain-owned configuration catalog defines common equipment variants independently of React and Three.js. Each entry contains:

- stable configuration identifier and family;
- user-facing name and concise description;
- category and capabilities;
- typical width, depth, and height in millimetres;
- recommended front/side/back clearance;
- matching `visualPreset`;
- optional notes about door or lid operation.

Initial families and configurations are:

- **Refrigeration:** upright single-door, upright two-door, under-counter/bench refrigerator, refrigerated prep counter, and chest/top-opening freezer.
- **Hot line:** four-burner range, six-burner range, range with oven, flat-top, fryer bank, combination flat-top/fryer, and tandoor.
- **Prep and landing:** open worktable, enclosed bench/counter, ingredient-prep counter, mixer stand, dirty landing, and clean landing.
- **Washing:** handwash basin, single sink, double sink, pre-rinse sink, under-counter dishwasher, and pass-through dishwasher.
- **Ventilation:** wall canopy and island canopy.

The selected-item inspector shows a **Configuration** control directly below the equipment label. It lists only compatible configurations from the item's family. Applying one:

- preserves `id`, `xMm`, `yMm`, `rotationDeg`, movement/removal permissions, and user notes;
- atomically updates label, category, dimensions, capabilities, clearance, configuration identifier, and visual preset;
- remains one revision and one undo step;
- keeps the component selected;
- updates the existing 2D and 3D objects without remounting either renderer;
- leaves all dimension, capability, clearance, and label fields editable afterward.

Manual edits do not erase the selected configuration identifier. The inspector marks it as **modified** when current values differ from its defaults. A custom or unmatched item offers a neutral **Custom/manual** state and compatible family choices rather than guessing silently.

The catalog exposes pure `listCompatibleConfigurations(item)` and `applyConfiguration(item, configurationId)` operations. This gives the future WebMCP manifest a structured way to advertise and apply the same modifiers without duplicating UI logic or accepting arbitrary merge patches.

### 6. Height-aware traversal

Walk colliders gain vertical metadata:

- equipment: actual `heightMm`, jumpable and landable;
- pass ledges: actual ledge height, jumpable and landable;
- walls: wall height, never jumpable;
- pillars: wall height, never jumpable.

The controller tracks player foot height separately from eye height. Horizontal movement resolves against:

- all walls and pillars regardless of player height;
- equipment or ledges only while the player's feet are below their top-clearance plane.

While descending, a support query detects whether the player's footprint crosses a jumpable top surface. The player lands at that surface height and becomes grounded. Walking off a raised surface starts a controlled fall to the next support or floor.

When Space is pressed, the controller searches a short corridor in the intended movement direction, or the camera-forward direction when stationary. If it finds jumpable equipment, it calculates the minimum vertical impulse needed for the player's feet to clear that obstacle with a safety margin. The normal jump impulse remains the minimum. Walls and pillars are excluded from adaptive jump targeting and always block traversal.

### 7. Correct lateral movement

The camera-relative right vector will use the correct cross-product direction without the current negation. Keyboard semantics remain conventional:

- A and Left Arrow: camera-relative left;
- D and Right Arrow: camera-relative right;
- W/Up and S/Down: forward and backward;
- Space: adaptive jump;
- Shift: faster horizontal movement.

Keyboard events continue to be ignored while typing in form controls and continue to prevent browser scrolling while walk mode is active.

### 8. Happy chef avatar

`ChefAvatar` remains lightweight procedural geometry suitable for several simultaneous workers. It gains:

- visible eyes with brows;
- a curved happy mouth and subtle cheeks;
- ears and a better head/neck transition;
- a refined toque with band and crown;
- tailored jacket, apron, neckerchief, trousers, and non-slip shoes;
- rounded hands and improved limb proportions;
- role color limited to accents rather than the full uniform;
- subtle breathing/idle movement in addition to existing walk/work articulation.

The expression remains clearly happy at overview distance without becoming cartoonishly oversized or uncanny at close range.

## Data Flow and Compatibility

1. Persistence parses a project and hydrates only missing visual presets and configuration identifiers where a match is trustworthy.
2. The inspector reads compatible configurations from the domain catalog and applies a chosen configuration as one validated store update.
3. `EquipmentMesh` asks the existing registry for the hydrated or configured preset and renders the corresponding procedural component.
4. Scene controls update local React state without remounting the canvas or resetting the camera.
5. Transparent-wall state selects the tested material descriptor for every wall panel.
6. Walk mode derives height-aware colliders from the live architecture and active equipment.
7. Keyboard state produces camera-relative movement and obstacle-aware vertical motion each frame.

The project schema gains an optional stable configuration identifier while retaining backward compatibility. The 2D plan and simulation consume the resulting ordinary equipment fields and need no special configuration branches. The future WebMCP layer can consume the pure catalog/application functions without coupling tool registration to kitchen UI code.

## Error and Safety Behavior

- Unknown custom equipment always gets the generic visual rather than guessing a misleading appliance.
- Invalid or unavailable preset names never break the 3D renderer.
- Incompatible configuration identifiers fail validation and do not partially update a component.
- Configuration application preserves placement and rotation even when typical dimensions change.
- Adaptive jumping never disables wall or pillar collision.
- Landing selects only top surfaces that are vertically crossed while descending; it does not teleport the player upward through equipment.
- A lost WebGL context continues to use the existing recoverable restart flow.
- Reduced-motion mode keeps locomotion functional while suppressing decorative avatar animation.

## Testing

Implementation follows red-green-refactor with tests written and observed failing before production edits.

### Unit and component tests

- Transparent wall material has zero opacity, no color/depth writes, and no wall shadow, while outline configuration remains enabled.
- Opaque wall material retains its normal surface and shadow behavior.
- Loading a schema-valid project with missing presets restores every known equipment visual without changing geometry or scenarios.
- Explicit and custom visual presets are preserved.
- Compatible modifier lists are deterministic and family-scoped.
- Applying each modifier produces its complete validated field set, preserves position/rotation, and creates one undoable revision.
- Manually changed modifier fields produce a **modified** state without losing the configuration identifier.
- A/Left produce a leftward camera-relative vector; D/Right produce the inverse vector.
- Equipment colliders expose actual top heights.
- Airborne movement clears equipment only when foot height is above its top plane.
- Walls and pillars remain blocking at every jump height.
- Adaptive impulse clears both a low counter and the upright freezer.
- Descending onto a low item lands at its exact top; walking off returns the player to the floor.
- Selected-equipment descriptors contain an exact rectangular/cuboid outline and no circular ring.
- Chef descriptors include the happy face, refined uniform, and role accent parts.

### Browser verification

- Transparent walls visibly disappear from multiple camera angles while borders and pass frames remain.
- A/D and both horizontal arrow keys move in the expected directions.
- The player can jump onto a low table, walk across it, jump over a tall appliance, and cannot jump through a wall or pillar.
- A legacy saved project visibly renders distinct range, fryer, tandoor, refrigeration, prep, sink, dishwasher, mixer, table, and hood models.
- Selecting representative cold, hot-line, prep, wash, and hood items offers the correct typical configurations; applying one updates both plan dimensions and the live 3D skin without a reload.
- Selecting rotated and unrotated equipment shows exact rectangular bounds without a circle.
- The happy chef remains recognizable in overview, simulation, and close first-person-adjacent views.
- No page errors or WebGL context regressions occur.

The final gate runs all unit tests, lint, production build, and the complete Playwright suite.

## Acceptance Criteria

1. Transparent-wall mode renders no wall surface or wall shadow, while architectural borders and service-window frames remain visible.
2. Existing projects automatically regain correct distinct equipment visuals without losing user edits.
3. Equipment uses differentiated, self-contained PBR-style geometry and materials with no remote runtime assets.
4. A/Left and D/Right move in the conventional camera-relative directions.
5. Space allows landing on low equipment and clearing tall equipment; walls and pillars always remain solid.
6. Selection uses only exact component-aligned rectangular/cuboid borders, never a circle.
7. Selected components expose compatible typical configurations that atomically apply dimensions, capabilities, clearances, and matching visuals while preserving placement and rotation.
8. Chef avatars have a clearly happy face and refined, role-aware kitchen attire.
9. Human editing, simulation, WebMCP, 2D/3D synchronization, camera persistence, and context-loss recovery continue to work.
