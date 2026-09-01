# Immersive Kitchen Rendering and Traversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make transparent walls genuinely outline-only, restore and improve distinct equipment visuals, add type-specific component configurations, correct first-person strafing and height-aware jumping, replace circular selection with exact bounds, and render a polished happy chef avatar.

**Architecture:** Keep domain data, store mutations, procedural rendering, and first-person mechanics separate. A pure equipment-configuration catalog supplies validated modifier patches and legacy visual hydration; Three.js consumes stable visual presets through the existing registry. Walk collision becomes height-aware through pure geometry/motion functions, while the React controller only owns input and frame integration.

**Tech Stack:** React 19, TypeScript 6, Zustand, Three.js 0.185, React Three Fiber 9, Drei 10, Zod 4, Vitest, Testing Library, Playwright.

## Global Constraints

- Work on `main`; do not merge the separate WebMCP feature branch as part of this plan.
- Use millimetres in domain and collision code and metres only at the Three.js boundary.
- Do not add remote GLB files, texture CDNs, runtime model downloads, or asset-licensing dependencies.
- Preserve item IDs, positions, rotations, user notes, variants, scenarios, revisions, and undo behavior during visual hydration and configuration changes.
- Walls and pillars must remain non-jumpable at every player height.
- Transparent-wall mode must retain borders and pass frames but render no wall surface or wall shadow.
- Existing 2D/3D renderer identity and camera state must survive item and configuration updates.
- Follow red-green-refactor: write and observe each focused test failing before production edits.

---

## File and Responsibility Map

### Domain and persistence

- Create `src/domain/equipment-configurations.ts`: typed configuration catalog, family inference, compatibility, application, modification detection, and visual inference.
- Create `src/domain/equipment-configurations.test.ts`: deterministic catalog and patch behavior.
- Modify `src/domain/project.ts`: optional stable `configurationPreset` field.
- Modify `src/domain/project-schema.ts`: validate the optional field.
- Modify `src/domain/seed-project.ts`: assign configuration identifiers to every seeded component.
- Modify `src/domain/seed-project.test.ts`: require complete seeded presentation metadata.
- Modify `src/state/project-store.ts`: one-step configuration application API.
- Modify `src/state/project-store.test.ts`: history, selection, and placement preservation.
- Modify `src/state/persistence.ts`: hydrate missing visual/configuration metadata after validation.
- Modify `src/state/persistence.test.ts`: legacy-project recovery without geometry loss.

### Inspector and plan

- Create `src/features/editor/EquipmentConfigurationField.tsx`: selected-item configuration control and modified status.
- Create `src/features/editor/equipment-configuration-field.test.tsx`: accessible selection and live update behavior.
- Modify `src/features/editor/EquipmentInspector.tsx`: mount the configuration control below the label.

### Three-dimensional rendering

- Create `src/features/scene/equipment/materials.ts`: reusable PBR material descriptors.
- Create `src/features/scene/equipment/materials.test.ts`: material-contract tests.
- Modify `src/features/scene/equipment/parts.tsx`: rounded PBR primitives.
- Modify `ColdVisuals.tsx`, `HotLineVisuals.tsx`, `PrepVisuals.tsx`, and `WashVisuals.tsx`: configuration-specific procedural equipment.
- Modify `src/features/scene/equipment/equipment-visual-registry.tsx`: register and describe all visual presets.
- Modify `src/features/scene/equipment/equipment-visual-registry.test.tsx`: distinct preset coverage.
- Modify `src/features/scene/KitchenScene.tsx`: restrained self-contained reflection and task lighting.
- Modify `src/features/scene/ArchitectureMesh.tsx`: outline-only transparent wall contract.
- Create `src/features/scene/wall-material.test.ts`: actual wall render-state regression.
- Modify `src/features/scene/EquipmentMesh.tsx`: exact selection cuboid only.
- Create `src/features/scene/equipment-selection.test.ts`: selection descriptor regression.

### First-person traversal

- Modify `src/features/scene/walk/walk-collision.ts`: collider height, jumpability, support surfaces, height-filtered movement.
- Modify `src/features/scene/walk/walk-collision.test.ts`: equipment clearance, landing support, permanent wall/pillar blocking.
- Create `src/features/scene/walk/walk-motion.ts`: pure camera-relative strafe and adaptive jump calculations.
- Create `src/features/scene/walk/walk-motion.test.ts`: left/right and jump-impulse tests.
- Create `src/features/scene/walk/types.ts`: shared walk-pose contract including elevation.
- Modify `src/features/scene/walk/FirstPersonController.tsx`: integrate pure motion and vertical support state.
- Modify `src/features/scene/walk/WalkScene.tsx`: carry the shared elevated pose through the controller boundary.
- Modify `src/features/scene/walk/WalkControlsGuide.tsx`: describe adaptive Space behavior.
- Modify `src/features/scene/walk/walk-mode.test.tsx`: updated accessible help text.
- Modify `src/features/scene/SceneWorkspace.tsx`: expose current walk position/elevation as test-only data attributes without remounting.
- Modify `src/features/scene/scene-sync.test.tsx`: verify live elevated poses do not remount the renderer.
- Modify `src/features/simulation/SimulationThreeScene.tsx`: carry and render elevated walk poses in simulation.

### Avatar and acceptance

- Modify `src/features/scene/agents/ChefAvatar.tsx`: happy face, refined uniform, proportions, and idle motion.
- Modify `src/features/scene/agents/chef-avatar.test.ts`: face/uniform descriptor.
- Modify `e2e/kitchen-lab.spec.ts`: transparent-wall, configuration, selection, controls, traversal, and avatar smoke coverage.
- Modify `docs/user-guide.md`: configuration modifiers and adaptive walk controls.

---

### Task 1: Domain Equipment Configuration Catalog

**Files:**
- Create: `src/domain/equipment-configurations.ts`
- Create: `src/domain/equipment-configurations.test.ts`
- Modify: `src/domain/project.ts`
- Modify: `src/domain/project-schema.ts`
- Modify: `src/domain/project-schema.test.ts`
- Modify: `src/domain/seed-project.ts`
- Modify: `src/domain/seed-project.test.ts`

**Interfaces:**
- Consumes: `EquipmentItem`, `EquipmentCategory`, `StationCapability`, and `ClearanceSpec`.
- Produces: `EquipmentConfiguration`, `EquipmentConfigurationFamily`, `EQUIPMENT_CONFIGURATIONS`, `listCompatibleConfigurations(item)`, `applyEquipmentConfiguration(item, id)`, `isEquipmentConfigurationModified(item)`, and `inferEquipmentConfiguration(item)`.

- [ ] **Step 1: Add failing catalog tests**

```ts
// src/domain/equipment-configurations.test.ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from './seed-project'
import {
  applyEquipmentConfiguration,
  inferEquipmentConfiguration,
  isEquipmentConfigurationModified,
  listCompatibleConfigurations,
} from './equipment-configurations'

describe('equipment configurations', () => {
  const item = createSeedProject().variants[0].equipment.find((value) => value.id === 'two-door-fridge')!

  it('offers the complete refrigeration family for a two-door fridge', () => {
    expect(listCompatibleConfigurations(item).map((value) => value.id)).toEqual([
      'cold-upright-single', 'cold-upright-double', 'cold-undercounter',
      'cold-prep-counter', 'cold-chest-freezer',
    ])
  })

  it('applies a configuration while preserving placement and rotation', () => {
    const configured = applyEquipmentConfiguration({ ...item, rotationDeg: 90 }, 'cold-chest-freezer')
    expect(configured).toMatchObject({
      id: item.id, xMm: item.xMm, yMm: item.yMm, rotationDeg: 90,
      label: 'Chest freezer', category: 'cold', widthMm: 1200, depthMm: 700,
      heightMm: 850, capabilities: ['cold-retrieval'], visualPreset: 'chest-freezer',
      configurationPreset: 'cold-chest-freezer', dimensionsLocked: false,
    })
  })

  it('infers known seed equipment and detects manual modification', () => {
    expect(inferEquipmentConfiguration(item)).toBe('cold-upright-double')
    expect(isEquipmentConfigurationModified({ ...item, configurationPreset: 'cold-upright-double' })).toBe(true)
    expect(isEquipmentConfigurationModified(applyEquipmentConfiguration(item, 'cold-upright-double'))).toBe(false)
    expect(isEquipmentConfigurationModified({ ...item, configurationPreset: 'cold-upright-double', widthMm: item.widthMm + 100 })).toBe(true)
  })

  it('rejects a configuration from an incompatible family', () => {
    expect(() => applyEquipmentConfiguration(item, 'hot-tandoor')).toThrow(/not compatible/i)
  })
})
```

Extend `src/domain/project-schema.test.ts` with a schema-valid item containing `configurationPreset: 'cold-upright-double'` and a rejection for an empty string.

Extend `src/domain/seed-project.test.ts` to assert every seed item has both a nonempty `visualPreset` and a nonempty `configurationPreset`, and that the seed configuration IDs exactly match `CONFIGURATION_BY_SEED_ID`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/domain/equipment-configurations.test.ts src/domain/project-schema.test.ts src/domain/seed-project.test.ts`

Expected: FAIL because the catalog module and `configurationPreset` schema field do not exist.

- [ ] **Step 3: Add the field and catalog types**

```ts
// src/domain/project.ts — EquipmentItem
configurationPreset?: string
```

```ts
// src/domain/project-schema.ts — equipmentSchema
configurationPreset: z.string().min(1).optional(),
```

```ts
// src/domain/equipment-configurations.ts
import type { ClearanceSpec, EquipmentCategory, EquipmentItem, StationCapability } from './project'

export type EquipmentConfigurationFamily = 'refrigeration' | 'hot-line' | 'prep-landing' | 'washing' | 'ventilation'
export type EquipmentConfiguration = {
  id: string
  family: EquipmentConfigurationFamily
  label: string
  description: string
  category: EquipmentCategory
  widthMm: number
  depthMm: number
  heightMm: number
  capabilities: StationCapability[]
  clearance: ClearanceSpec
  visualPreset: string
  notes?: string
}

const configuration = (
  id: string, family: EquipmentConfigurationFamily, label: string,
  category: EquipmentCategory, widthMm: number, depthMm: number, heightMm: number,
  capabilities: StationCapability[], clearance: ClearanceSpec, visualPreset: string,
  description = label,
): EquipmentConfiguration => ({ id, family, label, description, category, widthMm, depthMm, heightMm, capabilities, clearance, visualPreset })

export const EQUIPMENT_CONFIGURATIONS: readonly EquipmentConfiguration[] = [
  configuration('cold-upright-single', 'refrigeration', 'Upright single-door refrigerator', 'cold', 700, 800, 1950, ['cold-retrieval'], { kind: 'door-swing', frontMm: 900 }, 'upright-freezer'),
  configuration('cold-upright-double', 'refrigeration', 'Upright two-door refrigerator', 'cold', 1400, 850, 2000, ['cold-retrieval'], { kind: 'door-swing', frontMm: 1100 }, 'two-door-fridge'),
  configuration('cold-undercounter', 'refrigeration', 'Under-counter refrigerator', 'cold', 1200, 700, 850, ['cold-retrieval'], { kind: 'work', frontMm: 900 }, 'undercounter-fridge'),
  configuration('cold-prep-counter', 'refrigeration', 'Refrigerated prep counter', 'cold', 1200, 700, 850, ['cold-retrieval', 'food-prep'], { kind: 'work', frontMm: 900 }, 'prep-fridge'),
  configuration('cold-chest-freezer', 'refrigeration', 'Chest freezer', 'cold', 1200, 700, 850, ['cold-retrieval'], { kind: 'door-swing', frontMm: 700 }, 'chest-freezer'),
  configuration('hot-range-four', 'hot-line', '4-burner range', 'cooking', 800, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1000 }, 'four-burner-range'),
  configuration('hot-range-six', 'hot-line', '6-burner range', 'cooking', 1200, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1100 }, 'six-burner-range'),
  configuration('hot-range-oven', 'hot-line', 'Range with oven', 'cooking', 1200, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1100 }, 'range-oven'),
  configuration('hot-flat-top', 'hot-line', 'Flat-top griddle', 'cooking', 900, 700, 900, ['flat-top-cook'], { kind: 'heat', frontMm: 1000 }, 'flat-top'),
  configuration('hot-fryer-bank', 'hot-line', 'Twin fryer bank', 'cooking', 700, 700, 900, ['fryer-cook'], { kind: 'heat', frontMm: 1000 }, 'fryer-bank'),
  configuration('hot-flat-fryer', 'hot-line', 'Flat-top + fryer', 'cooking', 1200, 700, 900, ['flat-top-cook', 'fryer-cook'], { kind: 'heat', frontMm: 1000 }, 'flat-top-fryer'),
  configuration('hot-tandoor', 'hot-line', 'Tandoor', 'cooking', 700, 700, 900, ['tandoor-cook'], { kind: 'heat', frontMm: 1000 }, 'tandoor'),
  configuration('prep-open-table', 'prep-landing', 'Open worktable', 'prep', 700, 700, 850, ['food-prep', 'finish-plate'], { kind: 'work', frontMm: 800 }, 'open-table'),
  configuration('prep-enclosed-bench', 'prep-landing', 'Enclosed bench', 'prep', 1200, 700, 850, ['food-prep', 'finish-plate'], { kind: 'work', frontMm: 900 }, 'enclosed-bench'),
  configuration('prep-ingredient-counter', 'prep-landing', 'Ingredient prep counter', 'prep', 1200, 700, 850, ['food-prep'], { kind: 'work', frontMm: 900 }, 'ingredient-counter'),
  configuration('prep-mixer', 'prep-landing', 'Mixer stand', 'prep', 650, 650, 700, ['mix'], { kind: 'work', frontMm: 700 }, 'mixer'),
  configuration('landing-dirty', 'prep-landing', 'Dirty landing', 'landing', 900, 700, 850, ['dirty-landing'], { kind: 'work', frontMm: 800 }, 'landing-table'),
  configuration('landing-clean', 'prep-landing', 'Clean landing', 'landing', 700, 700, 850, ['clean-landing'], { kind: 'work', frontMm: 800 }, 'landing-table'),
  configuration('wash-hand', 'washing', 'Handwash basin', 'washing', 400, 400, 850, ['hand-wash'], { kind: 'work', frontMm: 600 }, 'handwash-sink'),
  configuration('wash-single', 'washing', 'Single sink', 'washing', 700, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 800 }, 'single-sink'),
  configuration('wash-double', 'washing', 'Double sink', 'washing', 1200, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 900 }, 'double-sink'),
  configuration('wash-pre-rinse', 'washing', 'Pre-rinse sink', 'washing', 700, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 800 }, 'pre-rinse-sink'),
  configuration('wash-undercounter-dishwasher', 'washing', 'Under-counter dishwasher', 'washing', 700, 750, 850, ['dish-wash'], { kind: 'work', frontMm: 900 }, 'dishwasher'),
  configuration('wash-pass-through-dishwasher', 'washing', 'Pass-through dishwasher', 'washing', 750, 800, 1500, ['dish-wash'], { kind: 'work', frontMm: 1000 }, 'pass-through-dishwasher'),
  configuration('hood-wall-canopy', 'ventilation', 'Wall canopy hood', 'hood', 3500, 1100, 600, [], { kind: 'service', frontMm: 0 }, 'canopy-hood'),
  configuration('hood-island-canopy', 'ventilation', 'Island canopy hood', 'hood', 3500, 1600, 600, [], { kind: 'service', frontMm: 0 }, 'island-hood'),
]
```

Use these exact inference tables so legacy hydration is deterministic:

```ts
const FAMILY_BY_CATEGORY: Partial<Record<EquipmentCategory, EquipmentConfigurationFamily>> = {
  cold: 'refrigeration', cooking: 'hot-line', prep: 'prep-landing', landing: 'prep-landing',
  washing: 'washing', hood: 'ventilation',
}

const CONFIGURATION_BY_SEED_ID: Record<string, string> = {
  'flat-top-fryer': 'hot-flat-fryer',
  'six-burner': 'hot-range-six',
  tandoor: 'hot-tandoor',
  'upright-freezer': 'cold-upright-single',
  'fridge-clean-prep': 'cold-prep-counter',
  'prep-fridge-counter': 'cold-prep-counter',
  mixer: 'prep-mixer',
  'working-table': 'prep-open-table',
  'double-sink': 'wash-double',
  'two-door-fridge': 'cold-upright-double',
  'dirty-landing': 'landing-dirty',
  'pre-rinse-sink': 'wash-pre-rinse',
  dishwasher: 'wash-undercounter-dishwasher',
  'clean-landing': 'landing-clean',
  handwash: 'wash-hand',
  'hot-line-hood': 'hood-wall-canopy',
}
```

Export `CONFIGURATION_BY_SEED_ID` for the seed regression. Add `configurationPreset?: string` to `EquipmentOptions`, copy it in `equipment()`, and assign the mapped value in each of the 16 seed calls. This keeps a fresh project and an imported project on the same metadata contract and preserves the existing import/export equality test.

`inferEquipmentConfiguration` must prefer an existing valid `configurationPreset`, then this seed-ID table, then a unique `visualPreset` match, then a unique capability/category match; ambiguous or unknown items return `undefined`. `listCompatibleConfigurations` must infer a family from a valid preset or `FAMILY_BY_CATEGORY`, return cloned catalog entries in catalog order, and return the full catalog for `category: 'custom'` so a custom box can intentionally be converted. `applyEquipmentConfiguration` must reject unknown or cross-family IDs except when the source category is `custom`; copy only `label`, `category`, dimensions, capabilities, clearance, `visualPreset`, and `configurationPreset`; preserve all other fields; and set `dimensionsLocked: false`. `isEquipmentConfigurationModified` compares exactly those configuration-owned fields with the selected catalog entry.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/domain/equipment-configurations.test.ts src/domain/project-schema.test.ts src/domain/seed-project.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain catalog**

```bash
git add src/domain/equipment-configurations.ts src/domain/equipment-configurations.test.ts src/domain/project.ts src/domain/project-schema.ts src/domain/project-schema.test.ts src/domain/seed-project.ts src/domain/seed-project.test.ts
git commit -m "feat: add equipment configuration catalog"
```

---

### Task 2: One-Step Configuration Application and Inspector UI

**Files:**
- Modify: `src/state/project-store.ts`
- Modify: `src/state/project-store.test.ts`
- Create: `src/features/editor/EquipmentConfigurationField.tsx`
- Create: `src/features/editor/equipment-configuration-field.test.tsx`
- Modify: `src/features/editor/EquipmentInspector.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: Task 1 catalog functions.
- Produces: `ProjectState.applyEquipmentConfiguration(id, configurationId): boolean` and an accessible inspector configuration selector.

- [ ] **Step 1: Add failing store and inspector tests**

```ts
// append to src/state/project-store.test.ts
it('applies a configuration as one revision while preserving placement and selection', () => {
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['two-door-fridge'])
  const before = getActiveItem(store.getState(), 'two-door-fridge')
  expect(store.getState().applyEquipmentConfiguration('two-door-fridge', 'cold-chest-freezer')).toBe(true)
  expect(getActiveItem(store.getState(), 'two-door-fridge')).toMatchObject({
    xMm: before.xMm, yMm: before.yMm, rotationDeg: before.rotationDeg,
    widthMm: 1200, depthMm: 700, heightMm: 850,
    visualPreset: 'chest-freezer', configurationPreset: 'cold-chest-freezer',
  })
  expect(store.getState()).toMatchObject({ revision: 1, selectedIds: ['two-door-fridge'] })
  expect(store.getState().past).toHaveLength(1)
})
```

```tsx
// src/features/editor/equipment-configuration-field.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem } from '../../state/project-store'
import { EquipmentInspector } from './EquipmentInspector'

it('offers and applies typical configurations to the selected component', async () => {
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['two-door-fridge'])
  render(<EquipmentInspector store={store} />)
  const field = screen.getByRole('combobox', { name: /Equipment configuration/i })
  expect(field).toHaveValue('cold-upright-double')
  await userEvent.selectOptions(field, 'cold-chest-freezer')
  expect(getActiveItem(store.getState(), 'two-door-fridge')).toMatchObject({ widthMm: 1200, visualPreset: 'chest-freezer' })
  expect(screen.getByLabelText(/^Width \(mm\)$/i)).toHaveValue('1200')
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/state/project-store.test.ts src/features/editor/equipment-configuration-field.test.tsx`

Expected: FAIL because the store method and selector do not exist.

- [ ] **Step 3: Implement the store method**

```ts
// src/state/project-store.ts
applyEquipmentConfiguration(id: string, configurationId: string): boolean

// inside createProjectStore return object
applyEquipmentConfiguration: (id, configurationId) => {
  let configured: EquipmentItem
  try {
    configured = configureEquipmentItem(getActiveItem(get(), id), configurationId)
  } catch {
    return false
  }
  const result = dispatch({ type: 'update-item', id, patch: configured })
  return result.ok
},
```

Use the exact alias `import { applyEquipmentConfiguration as configureEquipmentItem } from '../domain/equipment-configurations'` to avoid colliding with the store method name.

- [ ] **Step 4: Implement the focused inspector field**

```tsx
// src/features/editor/EquipmentConfigurationField.tsx
import type { EquipmentItem } from '../../domain/project'
import { isEquipmentConfigurationModified, listCompatibleConfigurations } from '../../domain/equipment-configurations'
import type { ProjectStore } from '../../state/project-store'

export function EquipmentConfigurationField({ item, store }: { item: EquipmentItem; store: ProjectStore }) {
  const options = listCompatibleConfigurations(item)
  const modified = isEquipmentConfigurationModified(item)
  return <label className="equipment-configuration-field">Configuration
    <select
      aria-label="Equipment configuration"
      value={item.configurationPreset ?? 'custom'}
      onChange={(event) => {
        if (event.target.value !== 'custom') store.getState().applyEquipmentConfiguration(item.id, event.target.value)
      }}
    >
      <option value="custom">Custom / manual</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <small>{modified ? 'Typical configuration · modified' : 'Applies typical size, clearance, capabilities, and 3D skin'}</small>
  </label>
}
```

Mount it immediately below the equipment label in `EquipmentInspector`. Add restrained spacing and small-copy styles without creating a new card.

- [ ] **Step 5: Run focused and plan interaction tests**

Run: `npm test -- src/state/project-store.test.ts src/features/editor/equipment-configuration-field.test.tsx src/features/editor/plan-interactions.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit configuration application**

```bash
git add src/state/project-store.ts src/state/project-store.test.ts src/features/editor/EquipmentConfigurationField.tsx src/features/editor/equipment-configuration-field.test.tsx src/features/editor/EquipmentInspector.tsx src/app/styles.css
git commit -m "feat: add selected equipment configurations"
```

---

### Task 3: Legacy Visual and Configuration Hydration

**Files:**
- Modify: `src/state/persistence.ts`
- Modify: `src/state/persistence.test.ts`

**Interfaces:**
- Consumes: `inferEquipmentConfiguration` and `EQUIPMENT_CONFIGURATIONS` from Task 1.
- Produces: `hydrateEquipmentPresentation(project): KitchenProject`, reused by stored and imported project validation.

- [ ] **Step 1: Add failing legacy recovery tests**

```ts
// append to src/state/persistence.test.ts
it('restores visual presets in schema-valid projects saved before equipment skins existed', () => {
  const legacyPresentation = createSeedProject()
  legacyPresentation.variants.forEach((variant) => variant.equipment.forEach((item) => {
    delete item.visualPreset
    delete item.configurationPreset
  }))
  legacyPresentation.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm = 2150
  const storage = memoryStorage({ [CURRENT_PROJECT_KEY]: JSON.stringify(legacyPresentation) })
  const loaded = loadProject(storage)
  expect(loaded.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({
    xMm: 2150, visualPreset: 'tandoor', configurationPreset: 'hot-tandoor',
  })
  expect(new Set(loaded.variants[0].equipment.map((item) => item.visualPreset)).size).toBeGreaterThan(8)
})

it('preserves explicit visual and configuration presets', () => {
  const project = createSeedProject()
  const item = project.variants[0].equipment[0]
  item.visualPreset = 'custom-studio-model'
  item.configurationPreset = 'custom-family-model'
  expect(importProject(JSON.stringify(project)).variants[0].equipment[0]).toMatchObject({
    visualPreset: 'custom-studio-model', configurationPreset: 'custom-family-model',
  })
})
```

- [ ] **Step 2: Run the persistence test and verify RED**

Run: `npm test -- src/state/persistence.test.ts`

Expected: FAIL because missing visual presets remain missing.

- [ ] **Step 3: Implement post-validation hydration**

```ts
// src/state/persistence.ts
export function hydrateEquipmentPresentation(project: KitchenProject): KitchenProject {
  const hydrated = structuredClone(project)
  hydrated.variants.forEach((variant) => variant.equipment.forEach((item) => {
    const inferred = inferEquipmentConfiguration(item)
    const configuration = inferred
      ? EQUIPMENT_CONFIGURATIONS.find((value) => value.id === inferred)
      : undefined
    item.configurationPreset ??= inferred
    item.visualPreset ??= configuration?.visualPreset ?? 'generic'
  }))
  return hydrated
}

function validated(value: unknown): KitchenProject | null {
  const result = projectSchema.safeParse(migrate(value))
  return result.success ? hydrateEquipmentPresentation(result.data) : null
}
```

Preserve the current explicit future-version and invalid-import error messages. After those checks, replace `importProject`'s duplicate schema parsing with:

```ts
const project = validated(candidate)
if (!project) throw new Error('Import is not a valid kitchen project')
return project
```

This makes stored and imported projects share validation and hydration without weakening import diagnostics.

- [ ] **Step 4: Run persistence and store tests**

Run: `npm test -- src/state/persistence.test.ts src/state/project-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit legacy hydration**

```bash
git add src/state/persistence.ts src/state/persistence.test.ts
git commit -m "fix: restore legacy equipment visuals"
```

---

### Task 4: Reusable Procedural PBR Material System

**Files:**
- Create: `src/features/scene/equipment/materials.ts`
- Create: `src/features/scene/equipment/materials.test.ts`
- Modify: `src/features/scene/equipment/parts.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`

**Interfaces:**
- Produces: `KitchenMaterialName`, `KITCHEN_MATERIALS`, `KitchenSurfaceMaterial`, and rounded `BoxPart`.

- [ ] **Step 1: Add failing material descriptor tests**

```ts
// src/features/scene/equipment/materials.test.ts
import { describe, expect, it } from 'vitest'
import { KITCHEN_MATERIALS } from './materials'

describe('kitchen PBR materials', () => {
  it('defines visibly distinct physical surfaces', () => {
    expect(KITCHEN_MATERIALS.brushedSteel).toMatchObject({ metalness: 0.88, roughness: 0.24 })
    expect(KITCHEN_MATERIALS.castIron).toMatchObject({ metalness: 0.5, roughness: 0.58 })
    expect(KITCHEN_MATERIALS.blackEnamel.clearcoat).toBeGreaterThan(0)
    expect(KITCHEN_MATERIALS.rubber.metalness).toBe(0)
    expect(new Set(Object.values(KITCHEN_MATERIALS).map((value) => value.color)).size).toBeGreaterThan(5)
  })
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/scene/equipment/materials.test.ts`

Expected: FAIL because `materials.ts` does not exist.

- [ ] **Step 3: Implement material descriptors and physical material component**

```tsx
// src/features/scene/equipment/materials.ts
export type KitchenMaterialName = 'brushedSteel' | 'darkSteel' | 'castIron' | 'blackEnamel' | 'rubber' | 'glass' | 'ceramic' | 'copper' | 'whiteUniform'
export type KitchenMaterialDescriptor = {
  color: string
  metalness: number
  roughness: number
  clearcoat?: number
  clearcoatRoughness?: number
  transmission?: number
  transparent?: boolean
  opacity?: number
}
export const KITCHEN_MATERIALS: Record<KitchenMaterialName, KitchenMaterialDescriptor> = {
  brushedSteel: { color: '#cbd3d1', metalness: .88, roughness: .24, clearcoat: .1, clearcoatRoughness: .28 },
  darkSteel: { color: '#59635f', metalness: .72, roughness: .32 },
  castIron: { color: '#202522', metalness: .5, roughness: .58 },
  blackEnamel: { color: '#171b19', metalness: .18, roughness: .22, clearcoat: .72, clearcoatRoughness: .18 },
  rubber: { color: '#202321', metalness: 0, roughness: .86 },
  glass: { color: '#9fb8b4', metalness: 0, roughness: .08, transmission: .72, transparent: true, opacity: .42 },
  ceramic: { color: '#e8e5dc', metalness: 0, roughness: .3, clearcoat: .4, clearcoatRoughness: .2 },
  copper: { color: '#9d5e3f', metalness: .76, roughness: .3 },
  whiteUniform: { color: '#f6f3ea', metalness: 0, roughness: .7 },
}
```

In `parts.tsx`, add `KitchenSurfaceMaterial`, switch box bodies to Drei `RoundedBox`, clamp bevel radius to one quarter of the smallest dimension, and retain the existing `color`, `metalness`, and `roughness` overrides for compatibility. Remove default dark `Edges` from ordinary equipment parts; use explicit seam parts where a visual needs separation.

In `KitchenScene.tsx`, add a self-contained `<Environment resolution={64}>` with two `Lightformer` rectangles, reduce flat ambient intensity, and retain one warm directional key light. Do not use an environment preset string because Drei presets fetch remote assets.

- [ ] **Step 4: Run focused scene tests and build**

Run: `npm test -- src/features/scene/equipment/materials.test.ts src/features/scene/equipment/equipment-visual-registry.test.tsx && npm run build`

Expected: PASS; no external asset request or TypeScript error.

- [ ] **Step 5: Commit the material system**

```bash
git add src/features/scene/equipment/materials.ts src/features/scene/equipment/materials.test.ts src/features/scene/equipment/parts.tsx src/features/scene/KitchenScene.tsx
git commit -m "feat: add procedural kitchen PBR materials"
```

---

### Task 5: Distinct Configuration-Specific Equipment Models

**Files:**
- Modify: `src/features/scene/equipment/ColdVisuals.tsx`
- Modify: `src/features/scene/equipment/HotLineVisuals.tsx`
- Modify: `src/features/scene/equipment/PrepVisuals.tsx`
- Modify: `src/features/scene/equipment/WashVisuals.tsx`
- Modify: `src/features/scene/equipment/equipment-visual-registry.tsx`
- Modify: `src/features/scene/equipment/equipment-visual-registry.test.tsx`

**Interfaces:**
- Consumes: Task 4 physical primitives and every Task 1 `visualPreset`.
- Produces: a registered recognizable component for every configuration preset.

- [ ] **Step 1: Extend the registry test and verify RED**

```tsx
// append to equipment-visual-registry.test.tsx
it.each([
  ['chest-freezer', 'ChestFreezerVisual', ['top-lid', 'hinge', 'handle', 'compressor-vent']],
  ['undercounter-fridge', 'UndercounterFridgeVisual', ['countertop', 'door', 'seal', 'handle']],
  ['four-burner-range', 'FourBurnerVisual', ['burner', 'grate', 'control-knob']],
  ['range-oven', 'RangeOvenVisual', ['burner', 'oven-door', 'control-knob']],
  ['flat-top', 'FlatTopVisual', ['griddle', 'grease-tray', 'control-knob']],
  ['fryer-bank', 'FryerBankVisual', ['fryer-well', 'basket', 'drain-valve']],
  ['enclosed-bench', 'EnclosedBenchVisual', ['worktop', 'sliding-door', 'plinth']],
  ['single-sink', 'SingleSinkVisual', ['basin', 'faucet', 'backsplash']],
  ['pass-through-dishwasher', 'PassThroughDishwasherVisual', ['hood-door', 'rack', 'control-panel']],
  ['island-hood', 'IslandHoodVisual', ['canopy', 'baffle-filter', 'underside-light']],
])('%s resolves a recognizable procedural model', (preset, displayName, parts) => {
  const item = { ...createSeedProject().variants[0].equipment[0], visualPreset: preset }
  expect(getEquipmentVisual(item).displayName).toBe(displayName)
  expect(equipmentVisualDescriptor(item).parts).toEqual(expect.arrayContaining(parts))
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/scene/equipment/equipment-visual-registry.test.tsx`

Expected: FAIL for every unregistered new preset.

- [ ] **Step 3: Implement reusable model families**

Refactor each file around internal family components and export these exact names:

- `HotLineVisuals.tsx`: `FourBurnerVisual`, `SixBurnerVisual`, `RangeOvenVisual`, `FlatTopVisual`, `FryerBankVisual`, and `IslandHoodVisual`; use an internal `RangeVisual` accepting `burners: 4 | 6` and `oven: boolean`.
- `ColdVisuals.tsx`: `UndercounterFridgeVisual` and `ChestFreezerVisual` in addition to the existing refrigerator/freezer components.
- `PrepVisuals.tsx`: `EnclosedBenchVisual` and `IngredientCounterVisual` in addition to the open and landing tables.
- `WashVisuals.tsx`: `SingleSinkVisual` and `PassThroughDishwasherVisual`; make `SinkBase` accept `basins: 1 | 2` so single and double sinks share geometry.

`RangeVisual` must render one cast-iron burner ring and two crossing grate bars per burner, a raised rear guard, one front knob per burner, and an optional black-enamel oven door with glass inset. `FlatTopVisual` must render a dark griddle plate, rear splash, front grease tray, and controls. `FryerBankVisual` must render two recessed wells, two wire-frame baskets with handles, front controls, and drain valves. `IslandHoodVisual` belongs in `HotLineVisuals.tsx` alongside `CanopyHoodVisual` and adds suspension rods plus two opposed baffle banks.

`UndercounterFridgeVisual` must render a rounded refrigerated base, steel worktop, two sealed doors, horizontal handles, and compressor vent. `ChestFreezerVisual` must render a low rounded cabinet, two top lids, rear hinges, front pull, and compressor vent. `EnclosedBenchVisual` must render a steel worktop, enclosed base, two overlapping sliding-door faces, recessed pulls, and plinth. `IngredientCounterVisual` adds a raised rail and at least four ingredient pans. `SingleSinkVisual` shares the existing sink base with one basin. `PassThroughDishwasherVisual` renders a tall rear body, lift hood, rack rails, dish rack, and control panel.

Use `KitchenSurfaceMaterial` names consistently: steel shells, cast-iron heat surfaces, enamel controls, rubber feet/seals, and glass oven panels. Preserve every existing recognizable detail and replace blanket box outlines with explicit seam geometry.

- [ ] **Step 4: Register all models and descriptors**

Add every Task 1 `visualPreset` to the registry. Reuse an implementation only where the silhouette is intentionally identical (`landing-table` variants); keep `canopy-hood` and `island-hood` as separate registered components. Add exact part arrays matching the tests and assert that no catalog preset resolves to `GenericEquipmentVisual`.

- [ ] **Step 5: Run visual registry, seed, and production build checks**

Run: `npm test -- src/features/scene/equipment/equipment-visual-registry.test.tsx src/domain/seed-project.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit distinct equipment models**

```bash
git add src/features/scene/equipment/ColdVisuals.tsx src/features/scene/equipment/HotLineVisuals.tsx src/features/scene/equipment/PrepVisuals.tsx src/features/scene/equipment/WashVisuals.tsx src/features/scene/equipment/equipment-visual-registry.tsx src/features/scene/equipment/equipment-visual-registry.test.tsx
git commit -m "feat: add distinct equipment configuration models"
```

---

### Task 6: Truly Transparent Walls and Exact Selection Bounds

**Files:**
- Modify: `src/features/scene/ArchitectureMesh.tsx`
- Create: `src/features/scene/wall-material.test.ts`
- Modify: `src/features/scene/EquipmentMesh.tsx`
- Create: `src/features/scene/equipment-selection.test.ts`
- Modify: `src/features/scene/scene-sync.test.tsx`

**Interfaces:**
- Produces: `wallSurfaceRenderState(outlineOnly)` and `equipmentSelectionDescriptor(item)`.

- [ ] **Step 1: Add failing material and selection tests**

```ts
// src/features/scene/wall-material.test.ts
import { expect, it } from 'vitest'
import { wallSurfaceRenderState } from './ArchitectureMesh'

it('removes all wall surface and shadow output in outline-only mode', () => {
  expect(wallSurfaceRenderState(true)).toEqual({
    transparent: true, opacity: 0, colorWrite: false, depthWrite: false, castShadow: false,
  })
  expect(wallSurfaceRenderState(false)).toEqual({
    transparent: false, opacity: 1, colorWrite: true, depthWrite: true, castShadow: true,
  })
})
```

```ts
// src/features/scene/equipment-selection.test.ts
import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { equipmentSelectionDescriptor } from './EquipmentMesh'

it('uses exact cuboid bounds and never a circular marker', () => {
  const item = createSeedProject().variants[0].equipment.find((value) => value.id === 'tandoor')!
  expect(equipmentSelectionDescriptor(item)).toEqual({
    shape: 'cuboid', widthM: .7, depthM: .7, heightM: .9, ring: false,
  })
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/scene/wall-material.test.ts src/features/scene/equipment-selection.test.ts`

Expected: FAIL because both descriptor functions are missing.

- [ ] **Step 3: Implement wall output state**

```tsx
// ArchitectureMesh.tsx
export const wallSurfaceRenderState = (outlineOnly: boolean) => outlineOnly
  ? { transparent: true, opacity: 0, colorWrite: false, depthWrite: false, castShadow: false }
  : { transparent: false, opacity: 1, colorWrite: true, depthWrite: true, castShadow: true }

function WallMesh({ panel, transparent: outlineOnly }: { panel: WallPanel; transparent: boolean }) {
  const { castShadow, ...materialState } = wallSurfaceRenderState(outlineOnly)
  return <mesh
    position={[toWorld(panel.centerMm.x), toWorld(panel.centerMm.y), toWorld(panel.centerMm.z)]}
    rotation={[0, panel.rotationYRad, 0]}
    castShadow={castShadow}
    receiveShadow={!outlineOnly}
  >
    <boxGeometry args={[toWorld(panel.sizeMm.width), toWorld(panel.sizeMm.height), toWorld(panel.sizeMm.depth)]} />
    <meshStandardMaterial color="#f3efe5" roughness={.88} {...materialState} />
    <Edges color="#34413d" threshold={15} />
  </mesh>
}
```

- [ ] **Step 4: Replace circular selection with exact bounds**

Export the pure descriptor, keep the selected transparent cuboid and its orange `Edges`, and delete the selected `<ringGeometry>` mesh entirely. Keep the selection cuboid inside the rotated equipment group so no separate world transform is needed.

- [ ] **Step 5: Run focused scene tests and build**

Run: `npm test -- src/features/scene/wall-material.test.ts src/features/scene/equipment-selection.test.ts src/features/scene/scene-sync.test.tsx && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit rendering-state fixes**

```bash
git add src/features/scene/ArchitectureMesh.tsx src/features/scene/wall-material.test.ts src/features/scene/EquipmentMesh.tsx src/features/scene/equipment-selection.test.ts src/features/scene/scene-sync.test.tsx
git commit -m "fix: render outline-only walls and exact selection"
```

---

### Task 7: Height-Aware Collision and Adaptive Jump Math

**Files:**
- Modify: `src/features/scene/walk/walk-collision.ts`
- Modify: `src/features/scene/walk/walk-collision.test.ts`
- Create: `src/features/scene/walk/walk-motion.ts`
- Create: `src/features/scene/walk/walk-motion.test.ts`

**Interfaces:**
- Produces: height-aware `WalkCollider`, `resolveWalkStep(body, delta, colliders, footHeightMm)`, `supportHeightAt(position, colliders)`, `findJumpObstacle(body, direction, colliders)`, `cameraRelativeRight(forward)`, `jumpVelocityForObstacle(input)`, and `advanceVerticalMotion(state, deltaSeconds, supportHeightMm)`.

- [ ] **Step 1: Write failing movement-math tests**

```ts
// src/features/scene/walk/walk-motion.test.ts
import { describe, expect, it } from 'vitest'
import { advanceVerticalMotion, cameraRelativeRight, jumpVelocityForObstacle } from './walk-motion'

describe('walk motion', () => {
  it('maps camera forward to conventional left and right vectors', () => {
    expect(cameraRelativeRight({ x: 0, y: -1 })).toEqual({ x: 1, y: 0 })
    expect(cameraRelativeRight({ x: 1, y: 0 })).toEqual({ x: 0, y: 1 })
  })

  it('calculates enough impulse to clear low and tall equipment', () => {
    const low = jumpVelocityForObstacle({ obstacleTopMm: 850, supportHeightMm: 0 })
    const tall = jumpVelocityForObstacle({ obstacleTopMm: 1950, supportHeightMm: 0 })
    expect((low * low) / (2 * 9.81) * 1000).toBeGreaterThanOrEqual(1029)
    expect((tall * tall) / (2 * 9.81) * 1000).toBeGreaterThanOrEqual(2129)
    expect(tall).toBeGreaterThan(low)
  })

  it('lands only while crossing a support top and falls after walking off it', () => {
    expect(advanceVerticalMotion(
      { footHeightMm: 900, velocityMps: -1, grounded: false }, .1, 850,
    )).toEqual({ footHeightMm: 850, velocityMps: 0, grounded: true })

    const falling = advanceVerticalMotion(
      { footHeightMm: 850, velocityMps: 0, grounded: true }, .1, 0,
    )
    expect(falling.grounded).toBe(false)
    expect(falling.footHeightMm).toBeLessThan(850)
  })
})
```

Extend `walk-collision.test.ts` to assert collider `topMm`/`jumpable`, movement blocked below equipment but allowed above it, walls blocked at 5000 mm, and exact support height over the open table.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/scene/walk/walk-motion.test.ts src/features/scene/walk/walk-collision.test.ts`

Expected: FAIL because vertical collider metadata and pure motion functions do not exist.

- [ ] **Step 3: Implement pure motion calculations**

```ts
// src/features/scene/walk/walk-motion.ts
import type { PointMm } from '../../../domain/project'

export const GRAVITY_MPS2 = 9.81
export const NORMAL_JUMP_MPS = 3.4
export const JUMP_CLEARANCE_MM = 180

export function cameraRelativeRight(forward: PointMm): PointMm {
  const length = Math.hypot(forward.x, forward.y) || 1
  return { x: (-forward.y / length) || 0, y: (forward.x / length) || 0 }
}

export function jumpVelocityForObstacle({ obstacleTopMm, supportHeightMm, marginMm = JUMP_CLEARANCE_MM }: {
  obstacleTopMm: number
  supportHeightMm: number
  marginMm?: number
}): number {
  const riseM = Math.max(0, obstacleTopMm + marginMm - supportHeightMm) / 1000
  return Math.max(NORMAL_JUMP_MPS, Math.sqrt(2 * GRAVITY_MPS2 * riseM))
}

export type VerticalMotionState = { footHeightMm: number; velocityMps: number; grounded: boolean }

export function advanceVerticalMotion(state: VerticalMotionState, deltaSeconds: number, supportHeightMm: number): VerticalMotionState {
  if (state.grounded && Math.abs(state.footHeightMm - supportHeightMm) <= 1) return { ...state, footHeightMm: supportHeightMm, velocityMps: 0 }
  const fallingFromSupport = state.grounded && supportHeightMm < state.footHeightMm
  const velocityMps = (fallingFromSupport ? 0 : state.velocityMps) - GRAVITY_MPS2 * deltaSeconds
  const footHeightMm = state.footHeightMm + velocityMps * deltaSeconds * 1000
  if (velocityMps <= 0 && state.footHeightMm >= supportHeightMm && footHeightMm <= supportHeightMm) {
    return { footHeightMm: supportHeightMm, velocityMps: 0, grounded: true }
  }
  return { footHeightMm, velocityMps, grounded: false }
}
```

- [ ] **Step 4: Add collider heights and filtering**

```ts
export type WalkCollider = {
  id: string
  kind: WalkColliderKind
  polygon: PointMm[]
  topMm: number
  jumpable: boolean
  landable: boolean
}
```

Set equipment top to `item.heightMm`; walls and pillars to `architecture.wallHeightMm` with both flags false; pass ledges to their sill height with both flags true. Update `resolveWalkStep` so walls/pillars always resolve and jumpable colliders resolve only while `footHeightMm < collider.topMm + 40`. Add:

```ts
export function supportHeightAt(position: PointMm, colliders: readonly WalkCollider[]): number {
  return colliders
    .filter((value) => value.landable && pointInPolygon(position, value.polygon))
    .reduce((height, value) => Math.max(height, value.topMm), 0)
}
```

Implement `findJumpObstacle(body, direction, colliders)` by sampling the normalized intended direction from `body.radiusMm` to 1400 mm in 40 mm increments. At each sample, use the existing circle/polygon overlap logic with `body.radiusMm`, and return the first intersecting collider whose `jumpable` flag is true. Never return walls or pillars.

- [ ] **Step 5: Run pure movement tests**

Run: `npm test -- src/features/scene/walk/walk-motion.test.ts src/features/scene/walk/walk-collision.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit traversal primitives**

```bash
git add src/features/scene/walk/walk-motion.ts src/features/scene/walk/walk-motion.test.ts src/features/scene/walk/walk-collision.ts src/features/scene/walk/walk-collision.test.ts
git commit -m "feat: add height-aware walk collision"
```

---

### Task 8: First-Person Controller Integration and Conventional Controls

**Files:**
- Create: `src/features/scene/walk/types.ts`
- Modify: `src/features/scene/walk/FirstPersonController.tsx`
- Modify: `src/features/scene/walk/WalkScene.tsx`
- Modify: `src/features/scene/walk/WalkControlsGuide.tsx`
- Modify: `src/features/scene/walk/walk-mode.test.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`

**Interfaces:**
- Consumes: Task 7 pure functions.
- Produces: corrected A/D and arrows, adaptive Space, raised-surface landing/falling, and observable player elevation.

- [ ] **Step 1: Add failing help and controller-surface assertions**

Update `walk-mode.test.tsx` to require `Space · adaptive jump` and conventional left/right text. Extend `scene-sync.test.tsx`'s fake renderer callback contract to prove `onPlayerPositionChange` retains live x/y updates and add `data-player-elevation-mm` to the scene surface contract.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/scene/walk/walk-mode.test.tsx src/features/scene/scene-sync.test.tsx`

Expected: FAIL because help and elevation output are absent.

- [ ] **Step 3: Correct camera-relative strafing**

Replace the Three.js cross/negate expression with the tested pure vector:

```ts
const right2d = cameraRelativeRight({ x: forward.x, y: forward.z })
const right = new THREE.Vector3(right2d.x, 0, right2d.y)
```

Keep `walk-input.ts` mappings unchanged: they are already correct.

- [ ] **Step 4: Add the shared elevated walk-pose contract**

```ts
// src/features/scene/walk/types.ts
import type { PointMm } from '../../../domain/project'

export type WalkPlayerPosition = PointMm & { elevationMm: number }
```

Replace every walk-position callback/state currently typed as `PointMm` in `FirstPersonController`, `WalkScene`, `SceneWorkspace`, and `SimulationThreeScene` with `WalkPlayerPosition`.

- [ ] **Step 5: Integrate adaptive vertical state**

Add refs for `supportHeightMm`, previous foot height, and player elevation. On jump, call `findJumpObstacle` using desired direction or camera forward and feed its `topMm` to `jumpVelocityForObstacle`. Pass current foot height into `resolveWalkStep`.

Use `advanceVerticalMotion` after horizontal resolution:

1. derive the current foot height from `(camera.position.y - EYE_HEIGHT_M) * 1000`;
2. query `supportHeightAt(resolved.positionMm, colliders)`;
3. pass the current vertical state, clamped frame delta, and support height into the pure helper;
4. set camera y to `EYE_HEIGHT_M + next.footHeightMm / 1000` and persist its velocity/grounded values;
5. publish `{ x, y, elevationMm: next.footHeightMm }` no more than every 100 ms.

Position the visible player chef group at `[playerPosition.x / 1000, playerPosition.elevationMm / 1000, playerPosition.y / 1000]` when overview mode displays it.

- [ ] **Step 6: Update accessible guide and test observability**

Render `Space · adaptive jump` and `A/Left · move left · D/Right · move right`. Add `data-player-x-mm`, `data-player-y-mm`, and `data-player-elevation-mm` to the scene canvas from the last published pose.

- [ ] **Step 7: Run walk, scene, simulation, and build checks**

Run: `npm test -- src/features/scene/walk src/features/scene/scene-sync.test.tsx src/features/simulation/simulation-workspace.test.tsx && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit controller integration**

```bash
git add src/features/scene/walk/types.ts src/features/scene/walk/FirstPersonController.tsx src/features/scene/walk/WalkControlsGuide.tsx src/features/scene/walk/walk-mode.test.tsx src/features/scene/walk/WalkScene.tsx src/features/scene/SceneWorkspace.tsx src/features/simulation/SimulationThreeScene.tsx src/features/scene/scene-sync.test.tsx
git commit -m "fix: add conventional adaptive walkthrough controls"
```

---

### Task 9: Refined Happy Chef Avatar

**Files:**
- Modify: `src/features/scene/agents/ChefAvatar.tsx`
- Modify: `src/features/scene/agents/chef-avatar.test.ts`

**Interfaces:**
- Produces: `chefVisualDescriptor(role, player)` with face, uniform, and motion-part metadata used by the procedural avatar.

- [ ] **Step 1: Extend the descriptor test and verify RED**

```ts
// src/features/scene/agents/chef-avatar.test.ts
it('describes a happy expressive face and tailored chef uniform', () => {
  const descriptor = chefVisualDescriptor('head-chef', true)
  expect(descriptor.parts).toEqual(expect.arrayContaining([
    'toque-band', 'toque-crown', 'eyes', 'eyebrows', 'smile', 'cheeks', 'ears',
    'double-breasted-jacket', 'apron', 'neckerchief', 'trousers', 'non-slip-shoes',
  ]))
  expect(descriptor.expression).toBe('happy')
  expect(descriptor.accent).toBe('#b95f47')
})
```

Run: `npm test -- src/features/scene/agents/chef-avatar.test.ts`

Expected: FAIL because expression and the new parts are absent.

- [ ] **Step 2: Implement the refined lightweight avatar**

Update the descriptor to return `expression: 'happy'`. Refine the JSX with:

- paired white/black eye meshes at the face front;
- short dark eyebrow capsules;
- a half torus smile with cheek spheres;
- small ear spheres and a short neck cylinder;
- a tapered jacket body with apron plane and double button rows;
- a toque band plus three rounded crown lobes rather than stacked plain cylinders;
- rounded hands and shoes using rubber material;
- a torso ref whose y-position adds a maximum 8 mm breathing cycle only when not moving and reduced motion is false.

Keep one material instance per mesh type where practical and avoid HTML facial content.

- [ ] **Step 3: Run avatar and simulation tests**

Run: `npm test -- src/features/scene/agents/chef-avatar.test.ts src/features/simulation/simulation-workspace.test.tsx && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit avatar improvements**

```bash
git add src/features/scene/agents/ChefAvatar.tsx src/features/scene/agents/chef-avatar.test.ts
git commit -m "feat: refine the happy chef avatar"
```

---

### Task 10: Browser Acceptance, Documentation, and Final Gate

**Files:**
- Modify: `e2e/kitchen-lab.spec.ts`
- Modify: `docs/user-guide.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces browser-level proof and user guidance.

- [ ] **Step 1: Add browser assertions before final implementation verification**

Extend the existing 3D-control test to:

```ts
await page.getByRole('button', { name: 'Transparent walls', exact: true }).click()
await expect(page.getByRole('button', { name: 'Transparent walls', exact: true })).toHaveAttribute('aria-pressed', 'true')
await expect(page.getByText('Clean pass · orders out')).toBeVisible()
await expect(page.getByText('Dirty return · dishes in')).toBeVisible()
```

Add a modifier flow: select the two-door fridge in Plan, choose `Chest freezer`, assert width/depth/height fields and label, switch to 3D, assert the existing canvas identity is unchanged, and confirm the component remains selectable.

Add a walk flow that records `data-player-x-mm`/`data-player-y-mm`, holds A then D and ArrowLeft then ArrowRight for 250 ms each, and asserts opposite signed lateral deltas. Press Space facing a jumpable station and assert `data-player-elevation-mm` rises above its prior value. Keep wall blocking primarily in deterministic unit tests to avoid camera-angle flakiness.

- [ ] **Step 2: Update the user guide**

Document:

- selected-item **Configuration** applies typical dimensions, clearance, capabilities, and 3D skin while preserving placement;
- manually edited configured items display **modified**;
- transparent walls are outline-only;
- A/Left and D/Right strafe conventionally;
- Space adapts to equipment height, low equipment is landable, and walls/pillars remain solid.

- [ ] **Step 3: Run the focused browser test**

Run: `npm run e2e -- e2e/kitchen-lab.spec.ts`

Expected: all kitchen-lab browser tests PASS with no page errors.

- [ ] **Step 4: Perform headed visual review with Playwright CLI**

Run the dev server, open 3D in a headed browser, and capture before/after screenshots under `output/playwright/`. Verify from at least two camera angles:

- wall surfaces and their shadows disappear completely in transparent mode;
- wall borders and pass frames remain;
- the range, fryer, tandoor, refrigeration, sinks, dishwasher, mixer, tables, and hood have different silhouettes/materials;
- chest-freezer configuration changes geometry;
- selected items show a precise box outline with no circle;
- the chef smile is visible at close range.

Expected: no visual acceptance item fails. If any does, return to the owning task and add a focused regression before adjusting code.

- [ ] **Step 5: Run the complete verification gate**

Run:

```bash
npm test
npm run lint
npm run build
npm run e2e
git diff --check
git status --short
```

Expected: all unit/contract tests pass, lint is clean, production build succeeds, all Playwright tests pass, no whitespace errors appear, and only intended documentation/test changes remain before the final commit.

- [ ] **Step 6: Commit browser proof and documentation**

```bash
git add e2e/kitchen-lab.spec.ts docs/user-guide.md
git commit -m "test: verify immersive kitchen rendering and traversal"
```

- [ ] **Step 7: Re-run the full gate on the committed tree**

Run: `npm test && npm run lint && npm run build && npm run e2e && git status --short`

Expected: every command succeeds and the worktree is clean.
