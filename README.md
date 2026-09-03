# CalmKitchen Designer

Design, inspect, and pressure-test commercial kitchen layouts in one browser-based workspace. Part of the HotelOS suite, branded CalmKitchen Designer.

Kitchen Planner combines a dimensionally accurate 2D editor, synchronized procedural 3D, first-person walkthroughs, deterministic busy-service simulation, and evidence-based layout comparison. The repository ships with a detailed example kitchen — a jagged 3.9 × 6.65 m restaurant room — reconstructed from a measured sketch.

> Kitchen Planner is a comparative planning aid. It does not replace architectural, fire, ventilation, food-safety, accessibility, structural, or occupational-safety review.

## Highlights

| Workspace | What it provides |
| --- | --- |
| **Plan** | Metric grid, snapping, drag/resize/rotate, exact dimensions, irregular room geometry, openings, pillars, clearances, diagnostics, undo/redo, and layout variants |
| **3D** | Synchronized equipment and architecture, procedural commercial-kitchen materials, selectable components, transparent walls, clearance overlays, and recoverable WebGL rendering |
| **Walk** | First-person kitchen traversal with keyboard controls, pointer look, collision, adaptive jumping, and an on-screen control guide |
| **Simulate** | Seeded order arrivals, role-aware staff, station queues, pathfinding, ticket flow, backlog, wait-time distribution, throughput, congestion, and live playback |
| **Compare** | Baseline/candidate plans, 3D massing, metric deltas, evidence-backed findings, and printable reports |

All geometry is stored canonically in millimetres. Display units can change without rewriting the project, and identical layouts, scenarios, and random seeds produce identical simulation results.

## Demo project

The bundled example kitchen models:

- a jagged 3.9 m × 6.65 m kitchen shell;
- the D2 staff/receiving entrance and permanently sealed D6 wall;
- separate clean and dirty service windows;
- a structural pillar and dedicated storage zone;
- hot-line, tandoor, refrigeration, preparation, and warewashing stations;
- the proposed five-person brigade and a configurable peak-service scenario.

Use it as a working example, duplicate it into variants, or import/export a validated project JSON file.

## Quick start

### Requirements

- Node.js 20.19+, 22.12+, or 24+
- npm
- A modern browser with WebGL 2 for the 3D workspaces

```bash
git clone git@github.com:hotelos-ai/kitchen-planner.git
cd kitchen-planner
npm install
npm run dev
```

Open the local URL printed by Vite. Project changes autosave in browser storage; **Export project** creates a human-readable, versioned JSON checkpoint.

## Commands

```bash
npm run dev          # Start the Vite development server
npm test             # Run the Vitest unit and component suite
npm run test:watch   # Run tests interactively
npm run lint         # Run ESLint
npm run build        # Type-check and create a production build
npm run e2e          # Run Playwright browser acceptance tests
```

## How it is built

```text
React application shell
├── Zustand project state, history, variants, and persistence
├── Zod project validation and import migration
├── React Konva metric plan editor
├── React Three Fiber / Three.js procedural scene
├── Framework-independent spatial command/query core
└── Seeded navigation, scheduling, queue, and metrics engine
```

The 2D editor and 3D scene consume the same canonical project. Stable component identities allow localized updates instead of rebuilding the renderer when an item moves. The simulation layer is independent of React and can be exercised directly in deterministic tests.

## Current capabilities

- Millimetre-native geometry with mm, cm, inch, and feet/inch display modes
- 10–250 mm snapping over the complete workspace grid
- Equipment positioning, resizing, 90° rotation, duplication, removal, and multiselect
- Typical equipment configurations with matching dimensions, capabilities, clearances, and 3D visuals
- Live boundary, collision, pillar, and front-clearance diagnostics
- Locked architecture, separate service openings, door swings, and equipment clearances
- Layout variants with deterministic baseline/candidate comparison
- Recoverable WebGL context loss without changing the plan
- Live simulation playback in 2D, 3D overview, and first-person modes
- Validated JSON import, export, autosave, last-known-good recovery, and schema migration

## Approved expansion roadmap

The committed product design extends Kitchen Planner with:

- a fullscreen canvas and Chrome-style variant tabs;
- a comprehensive equipment, shelving, and storage-rack catalog;
- quick configuration and appearance skins, double-click editing, and context menus;
- one atomic workspace API shared by the UI and future AI/WebMCP agents;
- a new-room/layout wizard and operational essentials checker;
- first/third-person switching, a refined chef avatar, and FPS-style hands/spatula;
- deterministic constraint-first auto-layout experiments ranked by service simulation;
- one complete JSON export containing all layouts and settings.

See the [workspace expansion design](docs/superpowers/specs/2026-09-01-kitchen-planning-workspace-expansion-design.md) and the [WebMCP spatial agent design](docs/superpowers/specs/2026-09-01-webmcp-spatial-agent-tools-design.md).

## Documentation

- [User guide](docs/user-guide.md)
- [Original Manta Raja design](docs/superpowers/specs/2026-08-31-manta-raja-kitchen-lab-design.md)
- [Immersive kitchen simulation design](docs/superpowers/specs/2026-09-01-immersive-kitchen-simulation-design.md)
- [Rendering and traversal design](docs/superpowers/specs/2026-09-01-immersive-kitchen-rendering-and-traversal-design.md)
- [Tool-ready spatial core plan](docs/superpowers/plans/2026-09-01-tool-ready-spatial-core.md)

## Planning limitations

The current model does not certify heat, smoke, exhaust capture, make-up air, gas, fire suppression, electrical load, drainage, grease handling, structural capacity, acoustics, accessibility, or compliance with local regulations. Confirm services, hood coverage, separation, circulation, accessibility, and installation requirements with qualified local professionals before ordering equipment or beginning construction.
