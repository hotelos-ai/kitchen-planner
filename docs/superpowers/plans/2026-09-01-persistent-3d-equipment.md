# Persistent 3D Architecture and Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make plan edits update only affected 3D components while adding legible clearances, transparent outlined walls, accurate service-window cutouts, and recognizable commercial-kitchen equipment.

**Architecture:** Pure geometry builders describe walls, openings, clearances, and visual presets independently of React. React Three Fiber keeps one persistent Canvas whose camera resets only for explicit camera actions or real architecture-dimension changes. An equipment visual registry selects focused procedural components while exact item footprints remain authoritative.

**Tech Stack:** React 19, React Three Fiber 9, Drei 10, Three.js 0.185, TypeScript 6, Vitest, Testing Library, Playwright.

## Global Constraints

- Keep one mounted WebGL Canvas during normal plan edits.
- Renderer remounting is allowed only for explicit context recovery.
- Preserve camera position, target, selection, and controls during item mutations.
- Transparent walls keep fully opaque borders and opening outlines.
- Service windows use configured sill and opening heights; D2 remains a full-height doorway and D6 remains sealed.
- Clearances are visible but never become collision geometry.
- Procedural equipment preserves exact configured dimensions and fixed collision bounds.
- Do not add external 3D assets, HDR environments, post-processing, or heavy physics.

---

## File Structure

- `src/features/scene/wall-geometry.ts`: pure wall-panel and opening-fixture descriptors.
- `src/features/scene/ArchitectureMesh.tsx`: floor, panel meshes, edges, pillar, and zones.
- `src/features/scene/ServiceWindowMesh.tsx`: pass ledges, frames, labels, and flow indicators.
- `src/features/scene/clearance-geometry.ts`: pure clearance and swing descriptors.
- `src/features/scene/Clearances.tsx`: visible fills, borders, hatching, and labels.
- `src/features/scene/equipment/equipment-visual-registry.tsx`: preset registry and fallback.
- `src/features/scene/equipment/HotLineVisuals.tsx`: range, flat-top/fryer, tandoor, hood.
- `src/features/scene/equipment/ColdVisuals.tsx`: freezer, two-door fridge, prep refrigeration.
- `src/features/scene/equipment/WashVisuals.tsx`: sinks, pre-rinse, dishwasher.
- `src/features/scene/equipment/PrepVisuals.tsx`: tables, landing tables, mixer.
- `src/features/scene/equipment/parts.tsx`: shared stainless panels, legs, handles, controls.
- `src/features/scene/EquipmentMesh.tsx`: stable item transform and registered visual host.
- `src/features/scene/camera-policy.ts`: pure camera-reset decisions.
- `src/features/scene/SceneWorkspace.tsx`: persistent Canvas and toolbar state.

### Task 1: Build Correct Wall Panels and Service Openings

**Files:**
- Create: `src/features/scene/wall-geometry.ts`
- Create: `src/features/scene/wall-geometry.test.ts`
- Create: `src/features/scene/ServiceWindowMesh.tsx`
- Modify: `src/features/scene/ArchitectureMesh.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`

**Interfaces:**
- Produces: `buildWallPanels(architecture): WallPanel[]` and `serviceWindowFixtures(architecture): ServiceWindowFixture[]`.
- `WallPanel`: `{ id, centerMm: {x,y,z}, sizeMm: {width,height,depth}, rotationYRad }`.
- `ServiceWindowFixture`: `{ id, flow, label, centerMm, widthMm, sillHeightMm, openingHeightMm, rotationYRad }`.

- [ ] **Step 1: Write failing wall-panel tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { buildWallPanels, serviceWindowFixtures } from './wall-geometry'

describe('wall geometry', () => {
  const architecture = createSeedProject().architecture

  it('cuts service windows between sill and head while retaining wall above and below', () => {
    const panels = buildWallPanels(architecture)
    const clean = panels.filter((panel) => panel.openingId === 'clean-window')
    expect(clean.map((panel) => panel.part).sort()).toEqual(['above', 'below'])
    expect(clean.find((panel) => panel.part === 'below')?.sizeMm.height).toBe(950)
    expect(clean.find((panel) => panel.part === 'above')?.centerMm.y).toBeGreaterThan(1850)
  })

  it('leaves D2 open, keeps D6 sealed, and returns distinct pass flows', () => {
    expect(buildWallPanels(architecture).some((panel) => panel.openingId === 'd2')).toBe(false)
    expect(buildWallPanels(architecture).some((panel) => panel.coversOffsetMm === 2900 && panel.wall === 'top')).toBe(true)
    expect(serviceWindowFixtures(architecture).map((fixture) => fixture.flow)).toEqual(['clean-out', 'dirty-in'])
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/wall-geometry.test.ts`

Expected: FAIL because `wall-geometry.ts` is missing.

- [ ] **Step 3: Implement pure panel subdivision**

Create `wall-geometry.ts` with exported types and a builder that walks polygon edges, maps cardinal walls, sorts openings, emits full-height wall runs between openings, skips the door span, ignores `sealed-opening` as a gap, and emits below/above panels for `service-window` spans. Clamp sill/head values to wall height and use an 80 mm wall depth.

The descriptor must include `wall`, `openingId`, `part`, and `coversOffsetMm` for deterministic tests and rendering labels.

- [ ] **Step 4: Render panels and service-window fixtures**

Replace `buildWallSegments` usage in `ArchitectureMesh.tsx` with `buildWallPanels`. Render each panel with `boxGeometry` based on `sizeMm`. Add `ServiceWindowMesh` that renders a 40 mm stainless ledge, three-sided opening frame, an outward teal arrow for `clean-out`, an inward amber arrow for `dirty-in`, and an accessible Drei `Html` label.

- [ ] **Step 5: Run scene geometry tests**

Run: `npm test -- src/features/scene/wall-geometry.test.ts src/features/scene/scene-sync.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit architectural openings**

```bash
git add src/features/scene/wall-geometry.ts src/features/scene/wall-geometry.test.ts src/features/scene/ServiceWindowMesh.tsx src/features/scene/ArchitectureMesh.tsx src/features/scene/scene-sync.test.tsx
git commit -m "feat: model service-window wall cutouts"
```

### Task 2: Add Transparent Outlined Walls

**Files:**
- Modify: `src/features/scene/ArchitectureMesh.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Adds: `wallsTransparent: boolean` to `ArchitectureMesh`, `KitchenScene`, and `SceneRendererProps`.

- [ ] **Step 1: Extend the toolbar test with the new state**

```tsx
const FakeRenderer = (props: SceneRendererProps) => (
  <output data-testid="wall-state">{String(props.wallsTransparent)}</output>
)
render(<SceneWorkspace renderer={FakeRenderer} />)
expect(screen.getByTestId('wall-state')).toHaveTextContent('false')
await user.click(screen.getByRole('button', { name: 'Transparent walls' }))
expect(screen.getByTestId('wall-state')).toHaveTextContent('true')
expect(screen.getByRole('button', { name: 'Transparent walls' })).toHaveAttribute('aria-pressed', 'true')
```

- [ ] **Step 2: Run and verify the missing prop/control failure**

Run: `npm test -- src/features/scene/scene-sync.test.tsx`

Expected: FAIL because the toggle and prop are missing.

- [ ] **Step 3: Wire state and render transparent materials with permanent edges**

Add `wallsTransparent` state in `SceneWorkspace`, pass it through `KitchenScene`, and render wall materials as:

```tsx
<meshStandardMaterial
  color="#f3efe5"
  roughness={0.88}
  transparent={wallsTransparent}
  opacity={wallsTransparent ? 0.16 : 1}
  depthWrite={!wallsTransparent}
/>
<Edges color="#27322e" threshold={15} />
```

Keep pillar materials opaque. Add an `aria-pressed` toolbar button labeled `Transparent walls`.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/features/scene/scene-sync.test.tsx && npm run build`

Expected: PASS and build exits 0.

- [ ] **Step 5: Commit wall transparency**

```bash
git add src/features/scene/ArchitectureMesh.tsx src/features/scene/KitchenScene.tsx src/features/scene/SceneWorkspace.tsx src/features/scene/scene-sync.test.tsx src/app/styles.css
git commit -m "feat: add transparent outlined walls"
```

### Task 3: Make Clearances Unmistakable

**Files:**
- Create: `src/features/scene/clearance-geometry.ts`
- Create: `src/features/scene/clearance-geometry.test.ts`
- Modify: `src/features/scene/Clearances.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`

**Interfaces:**
- Produces: `buildClearanceDescriptors(items, architecture, unit): ClearanceDescriptor[]`.
- Adds project `displayUnit` to clearance rendering.

- [ ] **Step 1: Write failing descriptor tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { buildClearanceDescriptors } from './clearance-geometry'

describe('clearance descriptors', () => {
  it('creates visible heat zones and labeled cold door swings', () => {
    const project = createSeedProject()
    const descriptors = buildClearanceDescriptors(project.variants[0].equipment, project.architecture, 'mm')
    expect(descriptors.find((zone) => zone.id === 'clearance-tandoor')).toMatchObject({ kind: 'heat', label: 'Heat clearance · 1000 mm' })
    expect(descriptors.find((zone) => zone.id === 'swing-upright-freezer')).toMatchObject({ kind: 'door-swing' })
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/clearance-geometry.test.ts`

Expected: FAIL because the descriptor builder is missing.

- [ ] **Step 3: Implement descriptors and unit labels**

Use the existing unit formatter from `src/domain/units.ts`. Emit rectangles for front clearances, quarter-circle descriptors for doors/cold equipment, role-specific colors, and world-space label anchors. Descriptor data must contain fill color, outline color, hatch color, and opacity.

- [ ] **Step 4: Render layered clearance geometry**

For rectangular zones render a filled plane at `y=.018`, a `lineLoop` at `y=.024`, repeated diagonal hatch lines at `y=.026`, and a non-interactive `Html` label. Increase fill opacity to `0.28`, keep outlines at `0.95`, and render full swing boundary plus hinge marker. Set `raycast={() => null}` on visualization meshes.

- [ ] **Step 5: Run clearance and scene tests**

Run: `npm test -- src/features/scene/clearance-geometry.test.ts src/features/scene/scene-sync.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit clearance rendering**

```bash
git add src/features/scene/clearance-geometry.ts src/features/scene/clearance-geometry.test.ts src/features/scene/Clearances.tsx src/features/scene/KitchenScene.tsx src/features/scene/SceneWorkspace.tsx
git commit -m "feat: strengthen 3d clearance overlays"
```

### Task 4: Introduce the Equipment Visual Registry and Shared Parts

**Files:**
- Create: `src/features/scene/equipment/equipment-visual-registry.tsx`
- Create: `src/features/scene/equipment/equipment-visual-registry.test.tsx`
- Create: `src/features/scene/equipment/parts.tsx`
- Modify: `src/features/scene/EquipmentMesh.tsx`
- Modify: `src/domain/seed-project.ts`
- Modify: `src/domain/project-schema.ts`

**Interfaces:**
- Produces: `registerEquipmentVisual(preset, component)`, `getEquipmentVisual(item)`, `EquipmentVisualProps`, and `GenericEquipmentVisual`.
- Adds optional `visualPreset` to seeded and schema-validated items.

- [ ] **Step 1: Write failing registry tests**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import { getEquipmentVisual } from './equipment-visual-registry'

describe('equipment visual registry', () => {
  it('resolves explicit presets and a generic fallback', () => {
    const tandoor = createSeedProject().variants[0].equipment.find((item) => item.id === 'tandoor')!
    expect(tandoor.visualPreset).toBe('tandoor')
    expect(getEquipmentVisual(tandoor).displayName).toBe('TandoorVisual')
    expect(getEquipmentVisual({ ...tandoor, id: 'unknown', visualPreset: 'unregistered' }).displayName).toBe('GenericEquipmentVisual')
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/equipment/equipment-visual-registry.test.tsx`

Expected: FAIL because the registry and `visualPreset` are missing.

- [ ] **Step 3: Add visual presets to the domain and seed**

Add `visualPreset?: string` to `EquipmentItem` and `equipmentSchema`. Extend the seed helper with `visualPreset`, assigning exact values: `flat-top-fryer`, `six-burner-range`, `tandoor`, `upright-freezer`, `prep-fridge`, `mixer`, `open-table`, `double-sink`, `two-door-fridge`, `landing-table`, `pre-rinse-sink`, `dishwasher`, `handwash-sink`, and `canopy-hood`.

- [ ] **Step 4: Implement registry and shared dimension-driven parts**

Use a `Map<string, ComponentType<EquipmentVisualProps>>`; return `GenericEquipmentVisual` for unknown presets. `EquipmentVisualProps` contains `{ item, widthM, depthM, heightM }`. Add reusable `StainlessPanel`, `TubularLeg`, `Handle`, `ControlKnob`, `DoorSeam`, and `VentSlots` components in `parts.tsx`.

Update `EquipmentMesh` so the stable outer group owns the item transform, the selected outline owns the exact footprint, and the registered visual renders inside it.

- [ ] **Step 5: Run registry, seed, schema, and scene tests**

Run: `npm test -- src/features/scene/equipment/equipment-visual-registry.test.tsx src/domain/seed-project.test.ts src/domain/project-schema.test.ts src/features/scene/scene-sync.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the visual registry**

```bash
git add src/features/scene/equipment src/features/scene/EquipmentMesh.tsx src/domain/seed-project.ts src/domain/project-schema.ts src/domain/project.ts
git commit -m "refactor: register procedural equipment visuals"
```

### Task 5: Build Recognizable Commercial Equipment Families

**Files:**
- Create: `src/features/scene/equipment/HotLineVisuals.tsx`
- Create: `src/features/scene/equipment/ColdVisuals.tsx`
- Create: `src/features/scene/equipment/WashVisuals.tsx`
- Create: `src/features/scene/equipment/PrepVisuals.tsx`
- Create: `src/features/scene/equipment/equipment-bounds.test.tsx`
- Modify: `src/features/scene/equipment/equipment-visual-registry.tsx`

**Interfaces:**
- Registers all presets assigned in Task 4.
- Preserves the exact `widthM × heightM × depthM` selection/collision envelope.

- [ ] **Step 1: Write failing identifying-feature tests**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import { equipmentVisualDescriptor } from './equipment-visual-registry'

describe('commercial equipment presets', () => {
  it.each([
    ['six-burner', ['burner', 'control-knob', 'rear-guard']],
    ['dishwasher', ['door', 'control-panel', 'dish-rack']],
    ['double-sink', ['basin', 'faucet', 'backsplash']],
    ['mixer', ['bowl', 'mixer-head', 'beater']],
  ])('%s has recognizable parts', (id, parts) => {
    const item = createSeedProject().variants[0].equipment.find((candidate) => candidate.id === id)!
    expect(equipmentVisualDescriptor(item).parts).toEqual(expect.arrayContaining(parts))
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/equipment/equipment-bounds.test.tsx`

Expected: FAIL because descriptors and family components are missing.

- [ ] **Step 3: Build hot-line and cold visual families**

Implement the exact parts required by the approved spec: burner rings/grates/knobs/guard; separate griddle and fryer well/baskets/storage; faceted tandoor body/mouth/rim; hood canopy/baffles/lights; freezer and fridge doors/handles/hinges/vents/feet; prep-fridge drawers/doors/worktop/pan rail.

- [ ] **Step 4: Build wash and prep visual families**

Implement double/handwash/pre-rinse basins, faucet and spray riser, dishwasher front/handle/control/rack, open tables and landing tables with legs/bracing/undershelf, and mixer pedestal/bowl/head/beater.

Export `equipmentVisualDescriptor(item)` alongside the component registry so identifying parts are testable without WebGL.

- [ ] **Step 5: Run equipment and full unit tests**

Run: `npm test -- src/features/scene/equipment src/features/scene/scene-sync.test.tsx && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit recognizable equipment**

```bash
git add src/features/scene/equipment
git commit -m "feat: model recognizable kitchen equipment"
```

### Task 6: Preserve Canvas and Camera During Plan Edits

**Files:**
- Create: `src/features/scene/camera-policy.ts`
- Create: `src/features/scene/camera-policy.test.ts`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`
- Modify: `e2e/kitchen-lab.spec.ts`

**Interfaces:**
- Produces: `cameraArchitectureKey(architecture): string` and stable Canvas generation diagnostics.

- [ ] **Step 1: Write failing camera-policy and mount-stability tests**

```ts
import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { cameraArchitectureKey } from './camera-policy'

it('does not change the camera key for equipment-only edits', () => {
  const first = createSeedProject()
  const second = structuredClone(first)
  second.variants[0].equipment[0].xMm += 100
  expect(cameraArchitectureKey(second.architecture)).toBe(cameraArchitectureKey(first.architecture))
})
```

Add a `SceneWorkspace` test whose fake renderer increments a module-level mount counter in `useEffect`, move the tandoor through the store, and expect the mount count to remain `1` while the displayed X coordinate changes.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/camera-policy.test.ts src/features/scene/scene-sync.test.tsx`

Expected: FAIL because the policy is missing and the current camera effect observes object identity.

- [ ] **Step 3: Stabilize camera and scene dependencies**

Implement `cameraArchitectureKey` from width, depth, wall height, and serialized room polygon only. Make `CameraRig` depend on this scalar key, `cameraMode`, and `fitSignal`, not the cloned architecture object. Memoize wall descriptors by the same architecture key plus openings, and keep equipment keyed only by stable item IDs.

Add `data-renderer-generation={rendererKey}` to the scene canvas wrapper. Do not change `rendererKey` for store updates.

- [ ] **Step 4: Extend the Split-view browser test**

In Playwright, open Split, record `data-renderer-generation`, move and resize the selected tandoor from the plan inspector, and assert the generation is unchanged, the 3D label remains visible, and no page errors occur. Orbit camera preservation is covered by the unit policy plus unchanged Canvas identity.

- [ ] **Step 5: Run focused, full, and browser tests**

Run: `npm test -- src/features/scene && npm test && npm run e2e`

Expected: all tests PASS.

- [ ] **Step 6: Run production checks and commit**

Run: `npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

```bash
git add src/features/scene e2e/kitchen-lab.spec.ts
git commit -m "fix: preserve live 3d scene during edits"
```

