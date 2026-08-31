# Manta Raja Kitchen Lab

An editable metric kitchen planner and deterministic service simulator for the proposed Manta Raja Indian restaurant. The seeded plan reconstructs the supplied graph-paper layout, including the jagged 3.9 m × 6.65 m shell, D2, permanently sealed D6, two service windows, pillar, storage zone, hot line, cold stations, and wash-up sequence.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The project autosaves in the browser and can be exported as validated JSON.

## Verification

```bash
npm run lint
npm test
npm run build
npm run e2e
```

## Architecture

- React + Vite + TypeScript application shell
- Zustand canonical project state, history, variants, and persistence
- Zod validation and schema migration for imported projects
- React Konva metric 2D editor
- React Three Fiber / Three.js synchronized procedural scene
- Framework-independent seeded navigation, task, queue, and metric engine
- SVG service playback, heatmap, routes, scorecards, comparison, and print report

All geometry is stored in millimetres. Display-unit changes never rewrite geometry. The simulation is deterministic for a given layout, scenario, and seed.

## Documentation

- [User guide](docs/user-guide.md)
- [Design specification](docs/superpowers/specs/2026-08-31-manta-raja-kitchen-lab-design.md)
- [Implementation plan](docs/superpowers/plans/2026-08-31-manta-raja-kitchen-lab.md)

This is a comparative planning aid, not a fire, ventilation, food-safety, accessibility, structural, or occupational-safety certification.
