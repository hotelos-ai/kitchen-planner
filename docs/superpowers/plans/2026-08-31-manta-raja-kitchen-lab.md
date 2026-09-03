# Manta Raja Kitchen Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first editable kitchen planner with a synchronized Three.js model and deterministic busy-service simulation for comparing Manta Raja layout variants.

**Architecture:** A Vite/React/TypeScript application owns one canonical project document measured in millimetres. React Konva renders and edits that document in 2D, React Three Fiber renders it in 3D, and a framework-independent simulation package consumes immutable layout/scenario snapshots to produce playback frames, metrics, and findings.

**Tech Stack:** Vite, React, TypeScript, Zustand, Zod, React Konva/Konva, Three.js, React Three Fiber/Drei, Vitest, Testing Library, and Playwright.

## Global Constraints

- Store all geometry internally in millimetres; unit changes affect display and parsing only.
- Default snap interval is 100 mm, with major grid lines every 1,000 mm.
- Display units are `mm`, `cm`, `in`, and `ft`.
- Known equipment starts with dimensions locked, but the user can unlock and edit width and depth per item.
- Walls, windows, D2, the sealed D6 segment, storage zone, and pillar are locked by default.
- Every equipment item is selectable, draggable, keyboard-nudgeable, rotatable, duplicable, removable, and labeled inside its footprint when space permits.
- The baseline trace is approximate and must remain recoverable while users create corrected variants.
- Simulation results are deterministic for a given layout, scenario, and random seed.
- The default scenario is five staff, 50 covers, 60 minutes, and mostly cook-to-order service.
- The app is a comparative planning aid, not a regulatory, HVAC, fire, or food-safety certification tool.
- The editor is desktop-first; smaller screens support viewing, playback, and simple property edits.
- Do not add authentication, cloud persistence, BIM/CAD import, inventory, costing, or photorealistic asset pipelines.

---

## File and Module Map

```text
src/
  app/
    App.tsx                         # top-level view shell and error fallback
    App.test.tsx
    styles.css                      # tokens, layout, responsive and motion rules
  domain/
    project.ts                      # canonical TypeScript domain types
    project-schema.ts               # Zod import/persistence validation
    project-schema.test.ts
    units.ts                        # unit formatting and parsing
    units.test.ts
    geometry.ts                     # snapping, polygons, collisions and transforms
    geometry.test.ts
    seed-project.ts                 # approximate Manta Raja baseline data
    seed-project.test.ts
  state/
    project-store.ts                # Zustand project/editor/variant actions
    project-store.test.ts
    history.ts                      # bounded undo/redo snapshots
    persistence.ts                  # local storage, import and export
    persistence.test.ts
  features/editor/
    PlanWorkspace.tsx               # 2D workspace composition
    PlanCanvas.tsx                  # React Konva stage, camera and layers
    GridLayer.tsx                   # 100 mm/1 m grid rendering
    ArchitectureLayer.tsx           # locked shell, D2, windows, pillar, storage
    EquipmentNode.tsx               # selectable/draggable/transformable equipment
    EquipmentLibrary.tsx            # catalog and custom-item creation
    EquipmentInspector.tsx          # item properties, units, locks and actions
    ProjectSettings.tsx             # units, snap and architecture-lock settings
    LayoutVariants.tsx              # create, rename, activate and remove variants
    plan-interactions.test.tsx
  features/scene/
    SceneWorkspace.tsx              # 3D and split-view composition
    KitchenScene.tsx                # R3F Canvas, lights, cameras and controls
    ArchitectureMesh.tsx            # floor, walls, openings, pillar and storage
    EquipmentMesh.tsx               # procedural category geometry
    Clearances.tsx                  # swing, work and heat overlays
    scene-sync.test.tsx
  simulation/
    types.ts                        # immutable inputs, events, frames and results
    rng.ts                          # seeded deterministic PRNG
    nav-grid.ts                     # walkable cells and A* routes
    nav-grid.test.ts
    tasks.ts                        # order/dish task generation and station mapping
    tasks.test.ts
    engine.ts                       # discrete fixed-step agent/queue engine
    engine.test.ts
    metrics.ts                      # result aggregation
    metrics.test.ts
    recommendations.ts              # evidence-backed comparative rules
    recommendations.test.ts
  features/simulation/
    SimulationWorkspace.tsx         # scenario controls, playback and results
    SimulationScene.tsx             # agents, paths, queues and heatmap in R3F
    ScenarioEditor.tsx
    PlaybackControls.tsx
    Scorecard.tsx
    FindingsPanel.tsx
    simulation-workspace.test.tsx
  features/compare/
    CompareWorkspace.tsx            # side-by-side plan/3D/score comparison
    ReportView.tsx                  # printable assumptions, metrics and findings
    compare-workspace.test.tsx
  test/
    setup.ts
    fixtures.ts
public/reference/
  manta-raja-layout.png             # rotated source sketch for optional tracing overlay
e2e/
  kitchen-lab.spec.ts
docs/
  user-guide.md
```

The following interfaces are stable across tasks:

```ts
type Millimetres = number
type DisplayUnit = 'mm' | 'cm' | 'in' | 'ft'
type PointMm = { x: Millimetres; y: Millimetres }
type EquipmentCategory = 'cooking' | 'cold' | 'prep' | 'washing' | 'landing' | 'storage' | 'hood' | 'custom'

interface EquipmentItem {
  id: string
  label: string
  category: EquipmentCategory
  widthMm: Millimetres
  depthMm: Millimetres
  heightMm: Millimetres
  xMm: Millimetres
  yMm: Millimetres
  rotationDeg: number
  dimensionsLocked: boolean
  movable: boolean
  removable: boolean
  capabilities: StationCapability[]
  clearance?: ClearanceSpec
  approximate?: boolean
}

interface LayoutVariant {
  id: string
  name: string
  parentId?: string
  equipment: EquipmentItem[]
  createdAt: string
  updatedAt: string
}

interface KitchenProject {
  schemaVersion: 1
  id: string
  name: string
  displayUnit: DisplayUnit
  snapMm: Millimetres
  architecture: Architecture
  variants: LayoutVariant[]
  scenarios: SimulationScenario[]
  activeVariantId: string
  activeScenarioId: string
}
```

---

### Task 1: Scaffold the tested application shell

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/app/styles.css`
- Create: `src/test/setup.ts`

**Interfaces:**
- Consumes: none.
- Produces: `App(): JSX.Element`; Vitest/jsdom test environment; project-wide CSS tokens.

- [ ] **Step 1: Create package metadata and install the runtime/test stack**

Create `package.json` with scripts and install dependencies using:

```bash
npm install react react-dom three @react-three/fiber @react-three/drei konva react-konva zustand zod
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/three vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh playwright @playwright/test
```

The scripts must be:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Write the failing shell test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('opens the Manta Raja planning workspace', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Manta Raja Kitchen Lab/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Plan/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 3: Run the test and confirm the red state**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 4: Implement the minimal app shell and visual tokens**

```tsx
// src/app/App.tsx
import { useState } from 'react'
import './styles.css'

type View = 'plan' | 'scene' | 'split' | 'simulate' | 'compare'

export function App() {
  const [view, setView] = useState<View>('plan')
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Manta Raja Kitchen Lab</h1>
        <nav aria-label="Workspace views">
          {(['plan', 'scene', 'split', 'simulate', 'compare'] as const).map((next) => (
            <button key={next} aria-pressed={view === next} onClick={() => setView(next)}>
              {next === 'scene' ? '3D' : next[0].toUpperCase() + next.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      <section aria-live="polite" className="workspace-placeholder">{view}</section>
    </main>
  )
}
```

Define CSS variables in `styles.css` for `--charcoal`, `--steel`, `--sand`, `--copper`, `--cold`, and `--wash`; add `prefers-reduced-motion` handling and make the first viewport a full-height operational workspace.

Configure Vitest in `vite.config.ts` and ESLint in `eslint.config.js`:

```ts
// vite.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: true },
})
```

```js
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
)
```

- [ ] **Step 5: Verify the shell**

Run: `npm test -- src/app/App.test.tsx && npm run build`

Expected: one passing test and a successful production build.

- [ ] **Step 6: Commit the shell**

```bash
git add package.json package-lock.json vite.config.ts tsconfig*.json index.html src
git commit -m "feat: scaffold kitchen lab workspace"
```

---

### Task 2: Define metric domain types, geometry, validation, and units

**Files:**
- Create: `src/domain/project.ts`
- Create: `src/domain/project-schema.ts`
- Create: `src/domain/project-schema.test.ts`
- Create: `src/domain/units.ts`
- Create: `src/domain/units.test.ts`
- Create: `src/domain/geometry.ts`
- Create: `src/domain/geometry.test.ts`
- Create: `src/test/fixtures.ts`

**Interfaces:**
- Consumes: TypeScript and Zod from Task 1.
- Produces: domain interfaces from the file map; `formatLength(mm, unit)`, `parseLength(input, unit)`, `snapMm(value, interval)`, `rotatedFootprint(item)`, `polygonsOverlap(a, b)`, and `projectSchema`.

- [ ] **Step 1: Write failing conversion and geometry tests**

```ts
// src/domain/units.test.ts
import { describe, expect, it } from 'vitest'
import { formatLength, parseLength } from './units'

describe('length units', () => {
  it.each([
    ['mm', '700 mm'], ['cm', '70 cm'], ['in', '27.56 in'], ['ft', `2' 3.56"`],
  ] as const)('formats 700 mm as %s', (unit, expected) => {
    expect(formatLength(700, unit)).toBe(expected)
  })

  it('round-trips without changing canonical millimetres', () => {
    expect(parseLength(formatLength(1200, 'in'), 'in')).toBeCloseTo(1200, 0)
  })
})

// src/domain/geometry.test.ts
import { describe, expect, it } from 'vitest'
import { snapMm } from './geometry'

it('snaps source-grid movement to 100 mm', () => {
  expect(snapMm(1249, 100)).toBe(1200)
  expect(snapMm(1251, 100)).toBe(1300)
})
```

- [ ] **Step 2: Confirm the tests fail**

Run: `npm test -- src/domain/units.test.ts src/domain/geometry.test.ts`

Expected: FAIL with unresolved `./units` and `./geometry` imports.

- [ ] **Step 3: Implement canonical types and unit conversion**

```ts
// src/domain/units.ts
import type { DisplayUnit } from './project'

const MM_PER_INCH = 25.4

export function formatLength(mm: number, unit: DisplayUnit): string {
  if (unit === 'mm') return `${Math.round(mm)} mm`
  if (unit === 'cm') return `${Number((mm / 10).toFixed(2))} cm`
  if (unit === 'in') return `${Number((mm / MM_PER_INCH).toFixed(2))} in`
  const totalInches = mm / MM_PER_INCH
  const feet = Math.floor(totalInches / 12)
  return `${feet}' ${Number((totalInches - feet * 12).toFixed(2))}"`
}

export function parseLength(input: string, unit: DisplayUnit): number {
  const numbers = input.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (!numbers.length) throw new Error('Enter a numeric length')
  if (unit === 'ft') return (numbers[0] * 12 + (numbers[1] ?? 0)) * MM_PER_INCH
  const factor = unit === 'mm' ? 1 : unit === 'cm' ? 10 : MM_PER_INCH
  return numbers[0] * factor
}
```

In `project.ts`, define every interface listed in the file map plus `Architecture`, `Opening`, `ClearanceSpec`, `StationCapability`, `StaffRole`, and `SimulationScenario`. Use string union types rather than free-form category/status strings.

Create shared deterministic test helpers in `src/test/fixtures.ts`:

```ts
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

export const activeItem = (store: ProjectStore, id: string) => {
  const { project } = store.getState()
  return variantItem(store, project.activeVariantId, id)
}

export const variantItem = (store: ProjectStore, variantId: string, id: string) => {
  const variant = store.getState().project.variants.find((value) => value.id === variantId)
  const item = variant?.equipment.find((value) => value.id === id)
  if (!item) throw new Error(`Missing fixture item: ${variantId}/${id}`)
  return item
}
```

- [ ] **Step 4: Implement geometry helpers and schema validation**

```ts
// src/domain/geometry.ts
export const snapMm = (value: number, interval: number) => Math.round(value / interval) * interval
export const normalizeRotation = (degrees: number) => ((degrees % 360) + 360) % 360
```

Add `rotatedFootprint` for 0/90/180/270 degree rectangles and a separating-axis `polygonsOverlap` helper. In `project-schema.ts`, mirror the canonical types with strict Zod objects; require `schemaVersion: z.literal(1)`, positive dimensions, finite coordinates, and at least one variant/scenario.

```ts
export function rotatedFootprint(item: EquipmentItem): PointMm[] {
  const corners = [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }]
  const radians = normalizeRotation(item.rotationDeg) * Math.PI / 180
  return corners.map(({ x, y }) => ({
    x: item.xMm + x * Math.cos(radians) - y * Math.sin(radians),
    y: item.yMm + x * Math.sin(radians) + y * Math.cos(radians),
  }))
}
```

- [ ] **Step 5: Add schema rejection tests**

```ts
it('rejects an imported item with negative width', () => {
  const invalid = structuredClone(validProjectFixture)
  invalid.variants[0].equipment[0].widthMm = -1
  expect(projectSchema.safeParse(invalid).success).toBe(false)
})
```

- [ ] **Step 6: Verify domain behavior and commit**

Run: `npm test -- src/domain && npm run build`

Expected: all domain tests pass; TypeScript build succeeds.

```bash
git add src/domain src/test/fixtures.ts
git commit -m "feat: define metric kitchen domain"
```

---

### Task 3: Seed the Manta Raja project and add safe persistence

**Files:**
- Create: `src/domain/seed-project.ts`
- Create: `src/domain/seed-project.test.ts`
- Create: `src/state/persistence.ts`
- Create: `src/state/persistence.test.ts`
- Create: `public/reference/manta-raja-layout.png`

**Interfaces:**
- Consumes: `KitchenProject` and `projectSchema` from Task 2.
- Produces: `createSeedProject(): KitchenProject`, `loadProject(storage): KitchenProject`, `saveProject(storage, project): void`, `exportProject(project): string`, and `importProject(json): KitchenProject`.

- [ ] **Step 1: Add the correctly rotated source reference**

Run:

```bash
mkdir -p public/reference
sips -s format png -r 90 /path/to/source-layout.HEIC --out public/reference/manta-raja-layout.png
```

Expected: `file public/reference/manta-raja-layout.png` reports PNG image data. Open it once and verify the hot line is across the top, storage is left of the upright freezer, and the tandoor touches the shaded pillar. If `sips` rotation differs on the host, rotate in 90-degree increments until those three anchors match.

- [ ] **Step 2: Write the failing seed invariants**

```ts
// src/domain/seed-project.test.ts
import { expect, it } from 'vitest'
import { createSeedProject } from './seed-project'

it('preserves the confirmed fixed relationships', () => {
  const project = createSeedProject()
  const items = project.variants[0].equipment
  const tandoor = items.find((item) => item.id === 'tandoor')!
  const freezer = items.find((item) => item.id === 'upright-freezer')!
  expect(tandoor.xMm + tandoor.widthMm).toBe(project.architecture.pillars[0].xMm)
  expect(project.architecture.storageZones[0].xMm + project.architecture.storageZones[0].widthMm).toBeLessThanOrEqual(freezer.xMm)
  expect(project.scenarios[0]).toMatchObject({ covers: 50, durationMinutes: 60, seed: 20260831 })
})
```

- [ ] **Step 3: Confirm the seed test fails**

Run: `npm test -- src/domain/seed-project.test.ts`

Expected: FAIL because `createSeedProject` does not exist.

- [ ] **Step 4: Implement the approximate baseline trace**

Use a 3,900 × 6,650 mm coordinate envelope with the origin at the upper-left of the correctly rotated source. Seed the confirmed equipment dimensions and mark uncertain transcriptions in an `approximate: true` metadata field. Use these anchor coordinates:

```ts
function equipment(
  id: string,
  label: string,
  category: EquipmentCategory,
  widthMm: number,
  depthMm: number,
  xMm: number,
  yMm: number,
): EquipmentItem {
  return {
    id, label, category, widthMm, depthMm, xMm, yMm,
    heightMm: category === 'cooking' ? 900 : 850,
    rotationDeg: 0,
    dimensionsLocked: true,
    movable: true,
    removable: true,
    capabilities: [],
  }
}

const hotLine = [
  equipment('flat-top-fryer', 'Flat-top + fryer', 'cooking', 1200, 700, 0, 900),
  equipment('six-burner', '6-burner range', 'cooking', 1200, 900, 1200, 900),
  equipment('tandoor', 'Tandoor', 'cooking', 700, 700, 2400, 900),
]

const pillar = { id: 'pillar', xMm: 3100, yMm: 900, widthMm: 400, depthMm: 400 }
const storageZone = { id: 'adjacent-storage', label: 'Adjacent storage', xMm: 0, yMm: 0, widthMm: 2400, depthMm: 800 }
const uprightFreezer = equipment('upright-freezer', 'Upright freezer', 'cold', 700, 800, 2800, 0)
```

Add the prep, sink, two-door fridge, dirty landing, pre-rinse sink, dishwasher, clean landing, mixer, working table, handwash, service windows, D2, sealed D6 segment, and hood as specified in the design document. Preserve this variant as `baseline-trace`.

Assign capabilities explicitly so the default simulation validates:

```ts
const CAPABILITIES_BY_ID: Record<string, StationCapability[]> = {
  'flat-top-fryer': ['flat-top-cook', 'fryer-cook'],
  'six-burner': ['range-cook'],
  tandoor: ['tandoor-cook'],
  'upright-freezer': ['cold-retrieval'],
  'fridge-clean-prep': ['cold-retrieval', 'food-prep', 'finish-plate'],
  'prep-fridge-counter': ['cold-retrieval', 'food-prep'],
  'dirty-landing': ['dirty-window', 'dirty-landing'],
  'pre-rinse-sink': ['dish-pre-rinse'],
  dishwasher: ['dish-wash'],
  'clean-landing': ['clean-landing'],
  'clean-service-window': ['clean-window'],
}
```

- [ ] **Step 5: Write persistence recovery tests**

```ts
it('falls back to the last good snapshot when current JSON is corrupt', () => {
  const storage = memoryStorage({
    'manta-raja:project:v1': '{broken',
    'manta-raja:project:last-good:v1': JSON.stringify(createSeedProject()),
  })
  expect(loadProject(storage).name).toBe('Manta Raja Kitchen Lab')
})

it('rejects malformed imports without mutating the stored project', () => {
  expect(() => importProject('{"schemaVersion":1}')).toThrow(/valid kitchen project/i)
})
```

- [ ] **Step 6: Implement validated load/save/import/export**

Parse through `projectSchema`; debounce is added at the store layer, while these functions remain synchronous and side-effect-scoped. Store current and last-good keys separately.

```ts
export function importProject(json: string): KitchenProject {
  let candidate: unknown
  try { candidate = JSON.parse(json) } catch { throw new Error('Import is not valid JSON') }
  const parsed = projectSchema.safeParse(candidate)
  if (!parsed.success) throw new Error('Import is not a valid kitchen project')
  return parsed.data
}

export function saveProject(storage: Storage, project: KitchenProject): void {
  const json = JSON.stringify(project)
  storage.setItem(CURRENT_KEY, json)
  storage.setItem(LAST_GOOD_KEY, json)
}
```

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/domain/seed-project.test.ts src/state/persistence.test.ts && npm run build`

```bash
git add public/reference src/domain/seed-project* src/state/persistence*
git commit -m "feat: seed Manta Raja kitchen project"
```

---

### Task 4: Implement project state, history, selection, and variants

**Files:**
- Create: `src/state/history.ts`
- Create: `src/state/project-store.ts`
- Create: `src/state/project-store.test.ts`

**Interfaces:**
- Consumes: canonical project and persistence functions from Tasks 2–3.
- Produces: `useProjectStore`, `projectStore`, and actions `selectItems`, `moveItems`, `rotateItems`, `resizeItem`, `setDisplayUnit`, `addItem`, `duplicateItem`, `removeItem`, `undo`, `redo`, `createVariant`, `activateVariant`, `renameVariant`, and `deleteVariant`.

- [ ] **Step 1: Write failing store interaction tests**

```ts
it('moves selected equipment on the 100 mm grid and supports undo', () => {
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['tandoor'])
  store.getState().moveItems(['tandoor'], { xMm: 2461, yMm: 951 })
  expect(activeItem(store, 'tandoor')).toMatchObject({ xMm: 2500, yMm: 1000 })
  store.getState().undo()
  expect(activeItem(store, 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900 })
})

it('does not resize a locked item until it is unlocked', () => {
  const store = createProjectStore(createSeedProject())
  store.getState().resizeItem('tandoor', { widthMm: 900, depthMm: 900 })
  expect(activeItem(store, 'tandoor').widthMm).toBe(700)
  store.getState().setDimensionsLocked('tandoor', false)
  store.getState().resizeItem('tandoor', { widthMm: 900, depthMm: 900 })
  expect(activeItem(store, 'tandoor').widthMm).toBe(900)
})
```

- [ ] **Step 2: Confirm the tests fail**

Run: `npm test -- src/state/project-store.test.ts`

Expected: FAIL because `createProjectStore` is missing.

- [ ] **Step 3: Implement bounded history and atomic actions**

```ts
export interface ProjectState {
  project: KitchenProject
  selectedIds: string[]
  past: KitchenProject[]
  future: KitchenProject[]
  moveItems(ids: string[], point: PointMm): void
  undo(): void
  redo(): void
}
```

Use immutable updates, cap history at 100 project snapshots, push one history entry per completed gesture rather than per pointer-move frame, and preserve selection outside undo snapshots.

```ts
const commitProject = (set: StoreSet, update: (project: KitchenProject) => KitchenProject) => {
  set((state) => ({
    project: update(state.project),
    past: [...state.past.slice(-99), state.project],
    future: [],
  }))
}
```

- [ ] **Step 4: Add variant isolation and unit preference tests**

```ts
it('duplicates a variant without mutating its parent', () => {
  const store = createProjectStore(createSeedProject())
  const childId = store.getState().createVariant('Hot line option')
  store.getState().activateVariant(childId)
  store.getState().moveItems(['tandoor'], { xMm: 2600, yMm: 900 })
  expect(variantItem(store, 'baseline-trace', 'tandoor').xMm).toBe(2400)
})
```

- [ ] **Step 5: Add debounced autosave**

Subscribe to project changes and call `saveProject` after 250 ms of inactivity. Cancel the previous timer on a new mutation and expose `flushAutosave()` for tests and page-unload handling.

```ts
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
projectStore.subscribe((state) => state.project, (project) => {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => saveProject(localStorage, project), 250)
})
```

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/state && npm run build`

```bash
git add src/state
git commit -m "feat: add project editing state and history"
```

---

### Task 5: Build the functional 2D metric editor

**Files:**
- Create: `src/features/editor/PlanWorkspace.tsx`
- Create: `src/features/editor/PlanCanvas.tsx`
- Create: `src/features/editor/GridLayer.tsx`
- Create: `src/features/editor/ArchitectureLayer.tsx`
- Create: `src/features/editor/EquipmentNode.tsx`
- Create: `src/features/editor/EquipmentLibrary.tsx`
- Create: `src/features/editor/EquipmentInspector.tsx`
- Create: `src/features/editor/ProjectSettings.tsx`
- Create: `src/features/editor/LayoutVariants.tsx`
- Create: `src/features/editor/plan-interactions.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `useProjectStore`, geometry helpers, units, and seed project.
- Produces: `PlanWorkspace`, `PlanCanvas`, `EquipmentNode`, and a complete pointer/keyboard editor surface.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('selects an item and exposes editable dimensions in the inspector', async () => {
  const user = userEvent.setup()
  render(<PlanWorkspace />)
  await user.click(screen.getByRole('button', { name: /Tandoor, 700 by 700 millimetres/i }))
  expect(screen.getByRole('textbox', { name: /Equipment label/i })).toHaveValue('Tandoor')
  expect(screen.getByLabelText(/Lock dimensions/i)).toBeChecked()
})

it('adds, duplicates, removes, and restores a custom item', async () => {
  const user = userEvent.setup()
  render(<PlanWorkspace />)
  await user.click(screen.getByRole('button', { name: /Add custom item/i }))
  await user.type(screen.getByLabelText(/Equipment label/i), 'Rice warmer')
  await user.click(screen.getByRole('button', { name: /^Add$/i }))
  await user.click(screen.getByRole('button', { name: /Duplicate/i }))
  await user.click(screen.getByRole('button', { name: /Remove/i }))
  await user.click(screen.getByRole('button', { name: /Undo/i }))
  expect(screen.getAllByText(/Rice warmer/i)).toHaveLength(2)
})
```

- [ ] **Step 2: Confirm the editor tests fail**

Run: `npm test -- src/features/editor/plan-interactions.test.tsx`

Expected: FAIL because `PlanWorkspace` is missing.

- [ ] **Step 3: Implement the Konva metric stage and grid**

`PlanCanvas` converts millimetres to stage pixels through one camera transform:

```ts
export interface PlanCamera {
  pixelsPerMm: number
  offsetPx: { x: number; y: number }
}

export const mmToPx = (mm: number, camera: PlanCamera) => mm * camera.pixelsPerMm
export const pxToMm = (px: number, camera: PlanCamera) => px / camera.pixelsPerMm
```

Render minor lines every 100 mm and major lines every 1,000 mm; virtualize lines to the visible viewport. Add wheel zoom around the pointer, middle-button/spacebar pan, reset view, and a source-reference image toggle aligned to the approximate trace.

- [ ] **Step 4: Implement architecture and equipment layers**

`EquipmentNode` must render a Konva `Group` with a footprint rectangle, category color, compact internal label, dimensions, warning badges, and an invisible padded hit area. On drag end, call `moveItems` with snapped millimetre coordinates. Use a Konva `Transformer` only when `dimensionsLocked === false`; convert scale back into millimetre dimensions and reset node scale to one.

```tsx
<Group
  x={mmToPx(item.xMm, camera)} y={mmToPx(item.yMm, camera)}
  rotation={item.rotationDeg} draggable={item.movable}
  onClick={(event) => selectFromPointer(item.id, event.evt.shiftKey)}
  onDragEnd={(event) => moveItems([item.id], {
    xMm: snapMm(pxToMm(event.target.x(), camera), snapIntervalMm),
    yMm: snapMm(pxToMm(event.target.y(), camera), snapIntervalMm),
  })}
>
  <Rect width={mmToPx(item.widthMm, camera)} height={mmToPx(item.depthMm, camera)} fill={categoryColor(item.category)} />
  <Text text={`${item.label}\n${formatDimensions(item, displayUnit)}`} width={mmToPx(item.widthMm, camera)} align="center" verticalAlign="middle" />
</Group>
```

- [ ] **Step 5: Implement library, inspector, settings, and variants**

The inspector must provide accessible HTML controls for label, width, depth, height, X/Y, rotation, dimension lock, duplicate, and remove. `ProjectSettings` controls display units and snap interval. `EquipmentLibrary` supports preset click-to-add and custom creation. `LayoutVariants` supports create, rename, activate, and delete while protecting the last remaining variant.

```tsx
<label>Width
  <input aria-label="Width" value={formatInput(item.widthMm, unit)} disabled={item.dimensionsLocked}
    onChange={(event) => resizeItem(item.id, { widthMm: parseLength(event.target.value, unit), depthMm: item.depthMm })} />
</label>
<label><input type="checkbox" checked={item.dimensionsLocked}
  onChange={(event) => setDimensionsLocked(item.id, event.target.checked)} /> Lock dimensions</label>
```

- [ ] **Step 6: Add keyboard and multiselect behavior**

Handle Delete/Backspace for removable selections, arrow keys for `snapMm`, Shift+arrow for 10 mm precision, Ctrl/Cmd+D for duplicate, Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo, and Escape to clear selection. Dragging a marquee selects intersecting equipment; Shift-click toggles selection.

```ts
function keyDelta(event: KeyboardEvent, snapIntervalMm: number): PointMm | null {
  const amount = event.shiftKey ? 10 : snapIntervalMm
  if (event.key === 'ArrowLeft') return { x: -amount, y: 0 }
  if (event.key === 'ArrowRight') return { x: amount, y: 0 }
  if (event.key === 'ArrowUp') return { x: 0, y: -amount }
  if (event.key === 'ArrowDown') return { x: 0, y: amount }
  return null
}
```

- [ ] **Step 7: Verify the complete editor manually and automatically**

Run: `npm test -- src/features/editor src/state src/domain && npm run build`

Manual check at `npm run dev`:

1. Drag the tandoor and see 100 mm snap feedback.
2. Confirm the tandoor label remains inside its footprint.
3. Unlock dimensions and resize it; relock and confirm handles disappear.
4. Change to feet and back to millimetres with no geometry drift.
5. Create a custom item, duplicate it, remove it, and undo.
6. Create a variant and confirm the baseline remains unchanged.

- [ ] **Step 8: Commit the editor**

```bash
git add src/features/editor src/app
git commit -m "feat: build editable metric kitchen plan"
```

---

### Task 6: Generate the synchronized Three.js kitchen

**Files:**
- Create: `src/features/scene/SceneWorkspace.tsx`
- Create: `src/features/scene/KitchenScene.tsx`
- Create: `src/features/scene/ArchitectureMesh.tsx`
- Create: `src/features/scene/EquipmentMesh.tsx`
- Create: `src/features/scene/Clearances.tsx`
- Create: `src/features/scene/scene-sync.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: active variant, architecture, and selection from `useProjectStore`.
- Produces: `SceneWorkspace`, `KitchenScene`, and millimetre-to-metre conversion `toWorld(mm): number`.

- [ ] **Step 1: Write the failing scene synchronization test**

```tsx
it('uses the active item geometry and synchronizes selection', async () => {
  const FakeSceneRenderer = ({ items, onSelect }: { items: EquipmentItem[]; onSelect(id: string): void }) => (
    <div>{items.map((item) => <button key={item.id} data-testid={`mesh-${item.id}`}
      data-size={`${item.widthMm / 1000},${item.heightMm / 1000},${item.depthMm / 1000}`}
      onClick={() => onSelect(item.id)}>{item.label}</button>)}</div>
  )
  render(<SceneWorkspace renderer={FakeSceneRenderer} />)
  expect(screen.getByTestId('mesh-tandoor')).toHaveAttribute('data-size', '0.7,0.9,0.7')
  await userEvent.click(screen.getByTestId('mesh-tandoor'))
  expect(projectStore.getState().selectedIds).toEqual(['tandoor'])
})
```

- [ ] **Step 2: Confirm the scene test fails**

Run: `npm test -- src/features/scene/scene-sync.test.tsx`

Expected: FAIL because `SceneWorkspace` is missing.

- [ ] **Step 3: Implement architecture meshes**

Use metres in Three.js: `toWorld = (mm) => mm / 1000`. Extrude the floor polygon, build wall segments around it, omit opening spans, model sealed D6 as uninterrupted wall, and add the pillar and adjacent storage zone. Use a 2.8 m default wall height stored in architecture settings.

```tsx
export const toWorld = (mm: number) => mm / 1000

export function ArchitectureMesh({ architecture }: { architecture: Architecture }) {
  return <group>
    <FloorMesh polygon={architecture.roomPolygon.map(({ x, y }) => [toWorld(x), toWorld(y)])} />
    {buildWallSegments(architecture).map((segment) => <WallMesh key={segment.id} segment={segment} heightM={2.8} />)}
    {architecture.pillars.map((pillar) => <PillarMesh key={pillar.id} pillar={pillar} />)}
  </group>
}
```

- [ ] **Step 4: Implement procedural equipment meshes**

`EquipmentMesh` chooses a small category component while respecting exact width/depth/height:

```tsx
export function EquipmentMesh({ item, selected, onSelect }: Props) {
  const size: [number, number, number] = [toWorld(item.widthMm), toWorld(item.heightMm), toWorld(item.depthMm)]
  return (
    <group position={[toWorld(item.xMm + item.widthMm / 2), 0, toWorld(item.yMm + item.depthMm / 2)]}
      rotation-y={-THREE.MathUtils.degToRad(item.rotationDeg)} onClick={(event) => { event.stopPropagation(); onSelect(item.id) }}>
      <EquipmentBody category={item.category} size={size} label={item.label} selected={selected} />
    </group>
  )
}
```

Add recognizable but restrained details for burner rings, flat-top, fryer well, tandoor opening, sink bowls, refrigerator doors, dishwasher, landing tables, shelves, and hood.

- [ ] **Step 5: Add camera controls and overlays**

Provide orbit, pan, zoom, top, perspective, and fit-to-room controls. `Clearances` renders optional work zones, door/refrigerator swings, and heat zones with transparent materials. Preserve the selected item across Plan, 3D, and Split views.

```tsx
<Canvas camera={{ position: [5.5, 7.5, 8], fov: 45 }}>
  <KitchenScene project={project} variant={activeVariant} selectedIds={selectedIds} />
  <OrbitControls makeDefault target={[1.95, 0, 3.325]} />
</Canvas>
```

- [ ] **Step 6: Add a recoverable WebGL fallback**

Wrap the canvas with an error boundary that renders: “3D view is unavailable in this browser. The plan editor is still fully usable.” Do not block the app shell or editor.

```tsx
<SceneErrorBoundary fallback={<p role="alert">3D view is unavailable in this browser. The plan editor is still fully usable.</p>}>
  <KitchenSceneCanvas />
</SceneErrorBoundary>
```

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/features/scene && npm run build`

Manual check: move and resize an unlocked item in Plan view and confirm the 3D mesh updates immediately in Split view; click the mesh and confirm the same inspector selection.

```bash
git add src/features/scene src/app
git commit -m "feat: add synchronized Three.js kitchen"
```

---

### Task 7: Implement deterministic navigation, task generation, queues, and metrics

**Files:**
- Create: `src/simulation/types.ts`
- Create: `src/simulation/rng.ts`
- Create: `src/simulation/nav-grid.ts`
- Create: `src/simulation/nav-grid.test.ts`
- Create: `src/simulation/tasks.ts`
- Create: `src/simulation/tasks.test.ts`
- Create: `src/simulation/engine.ts`
- Create: `src/simulation/engine.test.ts`
- Create: `src/simulation/metrics.ts`
- Create: `src/simulation/metrics.test.ts`

**Interfaces:**
- Consumes: immutable `Architecture`, `EquipmentItem[]`, and `SimulationScenario`.
- Produces: `buildNavGrid(input)`, `findRoute(grid, start, goal)`, `generateServiceTasks(scenario, equipment, rng)`, `runSimulation(input): SimulationResult`, and `aggregateMetrics(events): SimulationMetrics`.

- [ ] **Step 1: Define immutable simulation contracts**

```ts
export interface SimulationInput {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  scenario: SimulationScenario
}

export interface AgentFrame {
  agentId: string
  role: StaffRole
  xMm: number
  yMm: number
  state: 'walking' | 'working' | 'waiting' | 'blocked'
  taskId?: string
}

export interface SimulationResult {
  seed: number
  durationSeconds: number
  frames: readonly SimulationFrame[]
  events: readonly SimulationEvent[]
  metrics: SimulationMetrics
  warnings: readonly string[]
}

export interface SimulationMetrics {
  totalTravelMm: number
  travelByRoleMm: Record<StaffRole, number>
  timeByRoleSeconds: Record<StaffRole, { walking: number; working: number; waiting: number }>
  stationUtilization: Record<string, number>
  queueSeconds: Record<string, number>
  congestionEvents: number
  hotLineCongestionEvents: number
  opposingFlowEvents: number
  doorConflictEvents: number
  dirtyCleanCrossings: number
  unreachableTasks: number
  finishToPassTravelMm: number
  dirtyToWashTravelMm: number
  completedOrders: number
  orderCompletionP50Seconds: number
  orderCompletionP90Seconds: number
  trafficCells: readonly { xMm: number; yMm: number; visits: number }[]
}
```

Add deterministic fixtures to `src/test/fixtures.ts`: derive `defaultInput` and `seededEquipment` from `createSeedProject()`, define `simpleRoomWithCentralBlock` as a 2,000 mm square room with one 200 mm square block at its center, and define `blockedFixture` as a room split by an unbroken 200 mm wall. Export `simulationResultFixture` by running the default input once in the fixture setup and `fastFixtureRunner = () => simulationResultFixture` for UI tests.

- [ ] **Step 2: Write failing route tests**

```ts
it('routes around equipment and fixed architecture', () => {
  const grid = buildNavGrid(simpleRoomWithCentralBlock, 100)
  const route = findRoute(grid, { x: 100, y: 100 }, { x: 1900, y: 1900 })
  expect(route.every((point) => grid.isWalkable(point))).toBe(true)
  expect(route.some((point) => point.x > 900 && point.x < 1100 && point.y > 900 && point.y < 1100)).toBe(false)
})

it('reports an unreachable required station', () => {
  const grid = buildNavGrid(blockedFixture, 100)
  expect(() => findRoute(grid, blockedFixture.entry, blockedFixture.station)).toThrow(/unreachable/i)
})
```

- [ ] **Step 3: Implement navigation**

Rasterize the room polygon at 100 mm cells. Mark equipment footprints and fixed architecture as blocked; mark working clearances as reservable goal cells. Use A* with Manhattan distance plus penalties from mutable occupancy and opposing-flow maps. Route results must contain millimetre cell centers.

```ts
export function findRoute(grid: NavGrid, startMm: PointMm, goalMm: PointMm): PointMm[] {
  const start = grid.toCell(startMm)
  const goal = grid.toCell(goalMm)
  const open = new MinPriorityQueue<NavCell>()
  open.push(start, 0)
  const cameFrom = new Map<string, NavCell>()
  const cost = new Map([[grid.key(start), 0]])
  while (!open.isEmpty()) {
    const current = open.pop()
    if (grid.sameCell(current, goal)) return reconstructRoute(cameFrom, current).map(grid.toPointMm)
    for (const next of grid.walkableNeighbours(current)) {
      const nextCost = cost.get(grid.key(current))! + grid.moveCost(current, next)
      if (nextCost < (cost.get(grid.key(next)) ?? Infinity)) {
        cost.set(grid.key(next), nextCost)
        cameFrom.set(grid.key(next), current)
        open.push(next, nextCost + manhattan(next, goal))
      }
    }
  }
  throw new Error('Required station is unreachable')
}
```

- [ ] **Step 4: Write failing task-generation tests**

```ts
it('creates cook-to-order and dirty-dish chains for the default wave', () => {
  const tasks = generateServiceTasks(defaultScenario, seededEquipment, createRng(20260831))
  expect(tasks.some((task) => task.capability === 'tandoor-cook')).toBe(true)
  expect(tasks.some((task) => task.capability === 'dish-pre-rinse')).toBe(true)
  expect(tasks.filter((task) => task.orderId).length).toBeGreaterThan(50)
})
```

- [ ] **Step 5: Implement task chains and station assignment**

Generate retrieval → prep → cooking → finish → clean-window chains and dirty-window → landing → pre-rinse → dishwasher → clean-landing chains. Use scenario-provided duration ranges and the seeded PRNG. Resolve each capability to reachable equipment; emit a validation error before simulation if a required capability has no station.

```ts
export function orderTaskChain(order: ServiceOrder, rng: Rng): SimTask[] {
  const cooking = rng.pick(order.requiredCookingCapabilities)
  return chain(order.id, [
    task('cold-retrieval', 'cold-retrieval', rng.between(20, 45)),
    task('prep', 'food-prep', rng.between(45, 120)),
    task('cook', cooking, rng.between(180, 540)),
    task('finish', 'finish-plate', rng.between(25, 60)),
    task('pass', 'clean-window', rng.between(5, 15)),
  ])
}
```

- [ ] **Step 6: Write the failing deterministic engine test**

```ts
it('returns identical results for identical inputs and seed', () => {
  const first = runSimulation(defaultInput)
  const second = runSimulation(structuredClone(defaultInput))
  expect(second.metrics).toEqual(first.metrics)
  expect(second.events).toEqual(first.events)
})
```

- [ ] **Step 7: Implement the fixed-step engine and queues**

Run at a 250 ms logical step and record display frames every one simulated second. Assign tasks by role preference, route agents, reserve working cells, enqueue at occupied stations, detect near-overlaps/opposing movement/door swings/dirty-clean crossings, and continue until scenario duration plus a bounded drain period.

```ts
export function runSimulation(input: SimulationInput): SimulationResult {
  const state = createInitialState(input)
  for (let elapsedMs = 0; elapsedMs <= input.scenario.durationMinutes * 60_000 + MAX_DRAIN_MS; elapsedMs += 250) {
    releaseArrivals(state, elapsedMs)
    assignReadyTasks(state)
    advanceAgents(state, 250)
    detectEvents(state, elapsedMs)
    if (elapsedMs % 1000 === 0) state.frames.push(captureFrame(state, elapsedMs))
    if (state.complete && elapsedMs >= input.scenario.durationMinutes * 60_000) break
  }
  return finalizeResult(state, input.scenario.seed)
}
```

- [ ] **Step 8: Implement metric aggregation**

Aggregate total and per-role travel, walking/working/waiting time, station utilization, queue time, congestion, opposing-flow, door conflicts, dirty-clean crossings, unreachable tasks, finish-to-pass distance, dirty-to-wash distance, throughput, and order completion percentiles.

```ts
export function aggregateMetrics(events: readonly SimulationEvent[]): SimulationMetrics {
  return events.reduce(applyMetricEvent, emptyMetrics())
}
```

- [ ] **Step 9: Verify performance and commit**

Run: `npm test -- src/simulation && npm run build`

Expected: all deterministic tests pass; a default 60-minute service completes in under two seconds on the development machine.

```bash
git add src/simulation
git commit -m "feat: implement deterministic kitchen simulation"
```

---

### Task 8: Build simulation controls, playback, agents, heatmaps, and scorecards

**Files:**
- Create: `src/features/simulation/SimulationWorkspace.tsx`
- Create: `src/features/simulation/SimulationScene.tsx`
- Create: `src/features/simulation/ScenarioEditor.tsx`
- Create: `src/features/simulation/PlaybackControls.tsx`
- Create: `src/features/simulation/Scorecard.tsx`
- Create: `src/features/simulation/FindingsPanel.tsx`
- Create: `src/features/simulation/simulation-workspace.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `runSimulation`, active variant/scenario, and `KitchenScene`.
- Produces: configurable scenario form, playback state, animated agent/route layers, heatmap, and scorecard.

- [ ] **Step 1: Write the failing scenario/run test**

```tsx
it('runs the approved five-person 50-cover scenario and displays metrics', async () => {
  render(<SimulationWorkspace run={fastFixtureRunner} />)
  expect(screen.getByLabelText(/Covers/i)).toHaveValue(50)
  expect(screen.getByText(/Head chef/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
  expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
  expect(screen.getByText(/Dirty-clean crossings/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Confirm the test fails**

Run: `npm test -- src/features/simulation/simulation-workspace.test.tsx`

Expected: FAIL because `SimulationWorkspace` is missing.

- [ ] **Step 3: Implement scenario editing and validation**

Expose covers, duration, arrival pattern, cook-to-order ratio, seed, staff roles/counts, station duration ranges, and collision/door/dirty-clean checks. Validate before run and link missing capabilities back to the equipment editor.

```tsx
<label>Covers <input type="number" min={1} value={scenario.covers}
  onChange={(event) => updateScenario({ covers: Number(event.target.value) })} /></label>
<button onClick={run} disabled={validationErrors.length > 0}>Run {scenario.durationMinutes}-minute service</button>
```

- [ ] **Step 4: Implement playback controls**

Use `requestAnimationFrame` only for playback interpolation; the simulation result is precomputed. Support play, pause, restart, scrub, 0.5×/1×/2×/4×, role follow, route trails, queues, heatmap, clearances, and dirty/clean path toggles.

```ts
const simulationTimeMs = Math.min(result.durationSeconds * 1000, playbackStartedAtMs + (now - realStartedAtMs) * speed)
const frameIndex = Math.floor(simulationTimeMs / 1000)
const mix = (simulationTimeMs % 1000) / 1000
const agents = interpolateAgents(result.frames[frameIndex], result.frames[frameIndex + 1], mix)
```

- [ ] **Step 5: Render agents, paths, queues, and heatmaps**

Interpolate between one-second frames. Render each role with a stable color and accessible legend. Accumulate traffic per 100 mm cell into a normalized floor heatmap texture. Queue badges face the camera and show waiting count without occluding station selection.

```tsx
{agents.map((agent) => <AgentMesh key={agent.agentId} frame={agent} color={ROLE_COLORS[agent.role]} />)}
<TrafficHeatmap cells={result.metrics.trafficCells} visible={layers.heatmap} />
```

- [ ] **Step 6: Render metrics and assumptions**

`Scorecard` displays all approved metrics and a pressure-over-time timeline. Always show the scenario assumptions and the planning-aid disclaimer beside results.

```tsx
<aside aria-label="Simulation assumptions">{scenario.covers} covers over {scenario.durationMinutes} minutes · seed {scenario.seed}</aside>
<p className="disclaimer">Comparative planning aid — verify fire, ventilation, hygiene, accessibility, and worker safety with qualified local professionals.</p>
```

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/features/simulation src/simulation && npm run build`

Manual check: run, pause, scrub, change speed, follow the busser, toggle the heatmap, and verify results stay unchanged when replaying the same seed.

```bash
git add src/features/simulation src/app
git commit -m "feat: add busy-service playback and metrics"
```

---

### Task 9: Add evidence-backed layout comparison and recommendations

**Files:**
- Create: `src/simulation/recommendations.ts`
- Create: `src/simulation/recommendations.test.ts`
- Create: `src/features/compare/CompareWorkspace.tsx`
- Create: `src/features/compare/ReportView.tsx`
- Create: `src/features/compare/compare-workspace.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: two `LayoutVariant` values and their `SimulationResult` values.
- Produces: `compareResults(baseline, candidate): MetricDelta[]`, `buildFindings(context): LayoutFinding[]`, compare workspace, and printable report.

- [ ] **Step 1: Write failing recommendation tests**

```ts
it('recommends the candidate only when evidence improves the selected pressure point', () => {
  const findings = buildFindings({ baseline: congestedHotLine, candidate: relievedHotLine })
  expect(findings).toContainEqual(expect.objectContaining({
    ruleId: 'hot-line-pinch-point',
    severity: 'high',
    evidence: expect.arrayContaining([expect.stringMatching(/congestion/i)]),
    delta: expect.objectContaining({ direction: 'improved' }),
  }))
})

it('preserves positive findings for wash-up zoning', () => {
  expect(buildFindings(goodWashContext).some((finding) => finding.ruleId === 'wash-route-performing-well')).toBe(true)
})
```

- [ ] **Step 2: Implement comparison and recommendation rules**

Create rules for hot-line congestion, finish-to-pass travel, cold-store-to-prep travel, dirty-window-to-wash travel, dirty/clean crossings, door conflicts, unreachable tasks, and preserved good zones. Each `LayoutFinding` must contain `ruleId`, `severity`, `title`, `explanation`, `evidence`, `affectedItemIds`, and optional baseline/candidate delta. Never emit “best layout”; use “performs better under this scenario.”

```ts
const hotLinePinchPoint: RecommendationRule = ({ baseline, candidate }) => {
  const delta = candidate.metrics.hotLineCongestionEvents - baseline.metrics.hotLineCongestionEvents
  if (baseline.metrics.hotLineCongestionEvents < 5 || delta >= 0) return null
  return {
    ruleId: 'hot-line-pinch-point', severity: 'high', title: 'Relieve the hot-line pinch point',
    explanation: 'The candidate performs better under this scenario because fewer agents enter overlapping hot-line work zones.',
    evidence: [`Congestion events: ${baseline.metrics.hotLineCongestionEvents} → ${candidate.metrics.hotLineCongestionEvents}`],
    affectedItemIds: ['six-burner', 'tandoor', 'flat-top-fryer'],
    delta: { direction: 'improved', value: delta },
  }
}
```

- [ ] **Step 3: Write the failing compare workspace test**

```tsx
it('compares two variants and keeps assumptions visible', async () => {
  render(<CompareWorkspace />)
  await userEvent.selectOptions(screen.getByLabelText(/Baseline layout/i), 'baseline-trace')
  await userEvent.selectOptions(screen.getByLabelText(/Candidate layout/i), 'variant-b')
  expect(screen.getByText(/50 covers over 60 minutes/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Priority findings/i })).toBeInTheDocument()
})
```

- [ ] **Step 4: Implement comparison and report views**

Provide side-by-side Plan, 3D, and score tabs; metric deltas; linked highlighting of affected equipment; recommendation findings; and a print stylesheet. `ReportView` includes project/variant names, date, scenario assumptions, metric table, findings, warnings, and the planning-aid disclaimer.

```tsx
<section className="compare-grid">
  <VariantPreview variant={baseline} result={baselineResult} selectedFinding={selectedFinding} />
  <VariantPreview variant={candidate} result={candidateResult} selectedFinding={selectedFinding} />
</section>
<FindingsPanel findings={findings} onSelect={setSelectedFinding} />
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/simulation/recommendations.test.ts src/features/compare && npm run build`

```bash
git add src/simulation/recommendations* src/features/compare src/app
git commit -m "feat: compare layouts with evidence-backed findings"
```

---

### Task 10: Complete import/export, resilience, accessibility, and end-to-end verification

**Files:**
- Create: `src/app/ErrorBoundary.tsx`
- Create: `e2e/kitchen-lab.spec.ts`
- Create: `playwright.config.ts`
- Create: `docs/user-guide.md`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Create: `README.md`

**Interfaces:**
- Consumes: all application modules.
- Produces: resilient production application, browser acceptance coverage, and user documentation.

- [ ] **Step 1: Write the full browser acceptance test**

```ts
// e2e/kitchen-lab.spec.ts
import { expect, test } from '@playwright/test'

test('edits, simulates, compares, exports, and restores Manta Raja', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Manta Raja Kitchen Lab/i })).toBeVisible()

  await page.getByRole('button', { name: /Tandoor, 700 by 700 millimetres/i }).click()
  await page.getByLabel(/Lock dimensions/i).uncheck()
  await page.getByLabel(/Width/i).fill('750')
  await page.getByLabel(/Display units/i).selectOption('ft')
  await page.getByLabel(/Display units/i).selectOption('mm')
  await expect(page.getByLabel(/Width/i)).toHaveValue('750')

  await page.getByRole('button', { name: /Add custom item/i }).click()
  await page.getByLabel(/Equipment label/i).fill('Rice warmer')
  await page.getByRole('button', { name: /^Add$/i }).click()

  await page.getByRole('button', { name: /3D/i }).click()
  await expect(page.getByTestId('kitchen-scene')).toBeVisible()

  await page.getByRole('button', { name: /Simulate/i }).click()
  await page.getByRole('button', { name: /Run 60-minute service/i }).click()
  await expect(page.getByText(/Total staff travel/i)).toBeVisible()

  await page.getByRole('button', { name: /Compare/i }).click()
  await expect(page.getByRole('heading', { name: /Priority findings/i })).toBeVisible()
  await expect(page.getByText(/planning aid/i)).toBeVisible()
})
```

Create `playwright.config.ts` so the test owns its development server:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
})
```

- [ ] **Step 2: Run the end-to-end test and confirm the first red state**

Run: `npx playwright install chromium && npm run e2e`

Expected: FAIL on the first incomplete accessible name or workflow link, providing a concrete punch list.

- [ ] **Step 3: Wire import/export and recovery UI**

Add topbar actions for JSON export and file import. Validate before replacing state, show an error summary on invalid files, keep the current project untouched on failure, and offer the last-known-good snapshot when startup recovery occurs.

```tsx
async function onImport(file: File) {
  try {
    const imported = importProject(await file.text())
    replaceProject(imported)
    setImportError(null)
  } catch (error) {
    setImportError(error instanceof Error ? error.message : 'Import failed')
  }
}
```

- [ ] **Step 4: Add error boundaries and unreachable-state guidance**

Use `ErrorBoundary` around the app workspace and the separate WebGL boundary from Task 6. Simulation validation errors must link to missing/unreachable equipment. Invalid numeric fields keep the last valid value and announce their error through `aria-describedby`.

```tsx
<ErrorBoundary fallback={(error) => <RecoveryPanel error={error} onRestore={restoreLastGoodProject} />}>
  <WorkspaceRouter />
</ErrorBoundary>
```

- [ ] **Step 5: Finish accessibility and responsive behavior**

Ensure every canvas item has an equivalent focusable DOM control and inspector path. Add visible focus, 44 px touch targets on compact screens, keyboard shortcuts help, reduced-motion handling, sufficient text contrast, and non-color-only warning/role legends. On narrow screens, default to view-only scene/playback with library and inspector drawers.

- [ ] **Step 6: Write the user guide**

Document the coordinate/grid model, tracing overlay, equipment editing, dimension locks, units, custom items, variants, 3D controls, simulation assumptions, comparison interpretation, import/export, keyboard shortcuts, and regulatory limitations in `docs/user-guide.md`. Keep `README.md` to setup, scripts, architecture summary, and links to the design/plan/user guide.

- [ ] **Step 7: Run the complete verification matrix**

Run:

```bash
npm run lint
npm test
npm run build
npm run e2e
```

Expected: zero lint errors, all Vitest tests pass, production build succeeds, and Playwright acceptance passes in Chromium.

- [ ] **Step 8: Inspect the final app visually**

Check at 1440 × 900 and 390 × 844. Confirm no clipped controls, labels remain inside usable equipment footprints, Plan/3D selection is synchronized, simulation routes remain legible, print report has no navigation chrome, and reduced-motion mode removes decorative transitions without breaking playback controls.

- [ ] **Step 9: Commit the production-ready app**

```bash
git add src e2e playwright.config.ts docs/user-guide.md README.md package*.json
git commit -m "feat: complete Manta Raja kitchen lab"
```

---

## Final Acceptance

The implementation is complete when the seeded project opens without setup, the user can correct every item on a 100 mm grid, unit switching cannot change geometry, the same data drives the 3D scene, the default service simulation is deterministic, two variants can be compared with traceable evidence, and the complete lint/test/build/e2e matrix passes.
