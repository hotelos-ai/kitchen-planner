# WebMCP Spatial Agent Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the live spatial editor and service simulation as safe, discoverable WebMCP site tools so an external AI can translate a user's image or instructions into verified drawing and simulation changes while the app remains the renderer and simulator.

**Architecture:** Add a domain-neutral agent facade over the existing revisioned command/query service. It normalizes catalog operations, previews complete candidate documents, issues revision-bound single-use tokens, and commits through one transactional Zustand mutation. A framework-free WebMCP adapter registers strict JSON-Schema tools on the top-level `document.modelContext`; React only composes that adapter, shows status/activity, and presents an agent-triggered simulation result in the existing shared simulation workspace.

**Tech Stack:** TypeScript 6, React 19, Zustand 5, Zod 4 (`z.toJSONSchema`), Vitest 4, Testing Library, Playwright, WebMCP imperative API, existing Konva/React Three Fiber/Three.js views.

## Global Constraints

- Register tools only through top-level JavaScript `document.modelContext.registerTool`; do not use declarative form tools or iframe registration.
- Pass an `AbortSignal` as the second `registerTool` argument and abort it on teardown; the draft API has no imperative `unregisterTool` method.
- Do not add image upload, image processing, an AI/model call, API keys, a server-side MCP endpoint, or a remote-control channel.
- The external agent interprets images and natural language; the application accepts only strict structured operations and parameter patches.
- All coordinates and dimensions at the tool boundary are finite millimetre numbers.
- All document mutations require a successful preview token, revision match, full validation, one history entry, and one revision increment.
- Tool handlers must read current store state at invocation time and must never capture a stale project snapshot.
- Tool-driven edits must update the existing store without remounting the persistent Three.js canvas or resetting its camera.
- Tool definitions and registration code remain domain-neutral; commercial-kitchen data lives in a replaceable capability manifest.
- Every tool result is JSON-safe, includes `ok` and `revision`, and returns enough changed IDs, assumptions, warnings, or findings to verify the action.
- Preserve full human functionality and provide setup guidance when `document.modelContext` is absent or registration is rejected.
- Simulation output is a comparative planning aid, not operational measurement or regulatory certification.

---

## File and Responsibility Map

### Domain-neutral agent layer

- `src/core/agent-tools/capability-manifest.ts`: catalog and workspace-manifest interfaces.
- `src/core/agent-tools/agent-contracts.ts`: strict Zod input schemas and inferred public tool input types.
- `src/core/agent-tools/execute-layout-batch.ts`: pure all-or-nothing command batch executor.
- `src/core/agent-tools/preview-registry.ts`: in-memory expiring, revision-bound, single-use preview tokens.
- `src/core/agent-tools/agent-workspace-facade.ts`: read, preview, apply, diagnose, configure simulation, and run simulation workflows.

### Kitchen domain adapter

- `src/domain/kitchen-capability-manifest.ts`: kitchen component catalog, coordinate guidance, scenario metadata, and catalog-item construction.
- `src/domain/project-schema.ts`: cross-field simulation validation and exported strict scenario patch schema.
- `src/domain/spatial-adapter.ts`: capability description delegated to the manifest.

### State and application boundary

- `src/state/project-store.ts`: one-step candidate-project commit with stale-revision protection.
- `src/core/application/application-service.ts`: validated run/query behavior reused by the facade.
- `src/core/application/types.ts`: service result types needed by the facade.

### WebMCP adapter

- `src/webmcp/model-context.d.ts`: local draft API declarations.
- `src/webmcp/tool-definitions.ts`: stable tool metadata, generated JSON Schemas, annotations, handlers, and activity events.
- `src/webmcp/register-webmcp.ts`: feature detection, async registration, abort cleanup, and partial-failure state.

### React integration

- `src/webmcp/WebMcpProvider.tsx`: facade composition, registration lifecycle, and lightweight status/activity context.
- `src/webmcp/AgentToolsPanel.tsx`: status, copyable prompt, responsibilities, tool list, examples, and recent activity.
- `src/features/simulation/useSimulationSession.ts`: load an existing deterministic result without rerunning it.
- `src/features/simulation/SimulationWorkspace.tsx`: consume an agent launch request and display its exact result.
- `src/app/App.tsx`: own panel visibility, simulation launch request, and workspace navigation.
- `src/app/styles.css`: responsive panel, status, and activity presentation.

### Verification and documentation

- Focused `*.test.ts(x)` files beside each new module.
- `e2e/webmcp.spec.ts`: browser shim, discovery, drawing edits, stale/token safety, simulation configuration/playback, fallback, and renderer identity.
- `docs/user-guide.md`: end-user agent workflow and compatibility/privacy guidance.

---

### Task 1: Domain-Neutral Capability Manifest and Kitchen Catalog

**Files:**
- Create: `src/core/agent-tools/capability-manifest.ts`
- Create: `src/domain/kitchen-capability-manifest.ts`
- Create: `src/domain/kitchen-capability-manifest.test.ts`
- Modify: `src/domain/spatial-adapter.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: existing `EquipmentItem`, `EquipmentCategory`, `StationCapability`, `StaffRole`, and `SpatialDocumentAdapter.describeCapabilities()`.
- Produces: `ComponentCatalogEntry<TItem>`, `WorkspaceCapabilityManifest<TItem>`, `CatalogPlacement`, `kitchenCapabilityManifest`, and `createKitchenCatalogItem(input)`.

- [ ] **Step 1: Write the failing manifest and catalog-construction tests**

```ts
// src/domain/kitchen-capability-manifest.test.ts
import { describe, expect, it } from 'vitest'
import { kitchenCapabilityManifest } from './kitchen-capability-manifest'

describe('kitchenCapabilityManifest', () => {
  it('describes the generic workspace and every rendered kitchen preset', () => {
    expect(kitchenCapabilityManifest.workspace).toMatchObject({
      kind: 'commercial-kitchen', canonicalUnit: 'mm', origin: 'top-left',
      axes: { x: 'right', y: 'down' },
    })
    expect(kitchenCapabilityManifest.catalog.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'flat-top-fryer', 'six-burner-range', 'tandoor', 'upright-freezer',
      'prep-fridge', 'two-door-fridge', 'mixer', 'open-table', 'double-sink',
      'landing-table', 'pre-rinse-sink', 'dishwasher', 'handwash-sink',
      'canopy-hood', 'generic',
    ]))
  })

  it('creates a complete validated component from a catalog type and placement', () => {
    const item = kitchenCapabilityManifest.createItem({
      catalogType: 'tandoor', id: 'agent-tandoor-2', xMm: 1800, yMm: 900,
      overrides: { label: 'Second tandoor', approximate: true },
    })
    expect(item).toMatchObject({
      id: 'agent-tandoor-2', label: 'Second tandoor', category: 'cooking',
      widthMm: 700, depthMm: 700, heightMm: 900, xMm: 1800, yMm: 900,
      movable: true, removable: true, capabilities: ['tandoor-cook'],
      visualPreset: 'tandoor', approximate: true,
    })
  })

  it('returns cloned catalog values so callers cannot mutate the manifest', () => {
    const first = kitchenCapabilityManifest.listCatalog({ category: 'cold' })
    first[0].label = 'tampered'
    expect(kitchenCapabilityManifest.listCatalog({ category: 'cold' })[0].label).not.toBe('tampered')
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npm test -- src/domain/kitchen-capability-manifest.test.ts`

Expected: FAIL because `kitchen-capability-manifest.ts` does not exist.

- [ ] **Step 3: Define the focused domain-neutral interfaces**

```ts
// src/core/agent-tools/capability-manifest.ts
import type { SpatialItem } from '../spatial/types'

export type CatalogPlacement = {
  catalogType: string
  id: string
  xMm: number
  yMm: number
  overrides?: Record<string, unknown>
}

export type ComponentCatalogEntry = {
  id: string
  label: string
  category: string
  description: string
  defaultDimensionsMm: { width: number; depth: number; height: number }
  minimumDimensionsMm: { width: number; depth: number; height: number }
  capabilities: string[]
  suggestedFrontClearanceMm?: number
  visualPreset: string
}

export interface WorkspaceCapabilityManifest<TItem extends SpatialItem> {
  workspace: {
    kind: string
    name: string
    canonicalUnit: 'mm'
    supportedDisplayUnits: readonly ['mm', 'cm', 'in', 'ft']
    origin: 'top-left'
    axes: { x: 'right'; y: 'down' }
    imageResponsibility: string
  }
  catalog: readonly ComponentCatalogEntry[]
  staffRoles: readonly string[]
  arrivalPatterns: readonly string[]
  listCatalog(filters?: { category?: string; capability?: string }): ComponentCatalogEntry[]
  createItem(input: CatalogPlacement): TItem
}
```

- [ ] **Step 4: Implement the kitchen manifest as immutable data**

```ts
// src/domain/kitchen-capability-manifest.ts
import type { ComponentCatalogEntry, WorkspaceCapabilityManifest } from '../core/agent-tools/capability-manifest'
import type { EquipmentCategory, EquipmentItem, StationCapability } from './project'

type KitchenEntry = ComponentCatalogEntry & {
  category: EquipmentCategory
  capabilities: StationCapability[]
}

const defineEntry = (id: string, label: string, category: EquipmentCategory, width: number, depth: number, height: number, capabilities: StationCapability[], clearance: number): KitchenEntry => ({
  id, label, category,
  description: `${label} spatial component`,
  defaultDimensionsMm: { width, depth, height },
  minimumDimensionsMm: { width: 100, depth: 100, height: 100 },
  capabilities, suggestedFrontClearanceMm: clearance, visualPreset: id,
})

const catalog: KitchenEntry[] = [
  defineEntry('flat-top-fryer', 'Flat-top + fryer', 'cooking', 1200, 700, 900, ['flat-top-cook', 'fryer-cook'], 1000),
  defineEntry('six-burner-range', '6-burner range', 'cooking', 1200, 900, 900, ['range-cook'], 1100),
  defineEntry('tandoor', 'Tandoor', 'cooking', 700, 700, 900, ['tandoor-cook'], 1000),
  defineEntry('upright-freezer', 'Upright freezer', 'cold', 700, 800, 1950, ['cold-retrieval'], 900),
  defineEntry('prep-fridge', 'Prep fridge + counter', 'cold', 1200, 700, 850, ['cold-retrieval', 'food-prep'], 900),
  defineEntry('two-door-fridge', '2-door fridge', 'cold', 1400, 850, 1000, ['cold-retrieval'], 1100),
  defineEntry('mixer', 'Mixer', 'prep', 650, 650, 700, ['mix'], 700),
  defineEntry('open-table', 'Working table', 'prep', 700, 700, 850, ['food-prep', 'finish-plate'], 800),
  defineEntry('double-sink', 'Double sink', 'washing', 1200, 700, 850, ['dish-pre-rinse'], 900),
  defineEntry('landing-table', 'Landing table', 'landing', 900, 700, 850, [], 800),
  defineEntry('pre-rinse-sink', 'Pre-rinse sink', 'washing', 700, 700, 850, ['dish-pre-rinse'], 800),
  defineEntry('dishwasher', 'Dishwasher', 'washing', 700, 750, 850, ['dish-wash'], 900),
  defineEntry('handwash-sink', 'Handwash sink', 'washing', 400, 400, 850, ['hand-wash'], 600),
  defineEntry('canopy-hood', 'Canopy hood', 'hood', 3500, 1100, 600, [], 0),
  defineEntry('generic', 'Generic spatial component', 'custom', 600, 600, 850, [], 600),
]

const clone = <T,>(value: T): T => structuredClone(value)

export const kitchenCapabilityManifest: WorkspaceCapabilityManifest<EquipmentItem> = {
  workspace: {
    kind: 'commercial-kitchen', name: 'Manta Raja Kitchen Lab', canonicalUnit: 'mm',
    supportedDisplayUnits: ['mm', 'cm', 'in', 'ft'], origin: 'top-left',
    axes: { x: 'right', y: 'down' },
    imageResponsibility: 'The external agent interprets reference images and user language. This site receives only structured spatial operations.',
  },
  catalog,
  staffRoles: ['head-chef', 'sous-chef', 'cdp', 'busser-washer'],
  arrivalPatterns: ['seating-wave', 'steady', 'two-waves'],
  listCatalog(filters = {}) {
    return clone(catalog.filter((entry) =>
      (!filters.category || entry.category === filters.category)
      && (!filters.capability || entry.capabilities.includes(filters.capability as StationCapability))))
  },
  createItem({ catalogType, id, xMm, yMm, overrides = {} }) {
    const entry = catalog.find((candidate) => candidate.id === catalogType)
    if (!entry) throw new Error(`Unknown catalog type: ${catalogType}`)
    const override = overrides as Partial<Pick<EquipmentItem, 'label' | 'category' | 'widthMm' | 'depthMm' | 'heightMm' | 'rotationDeg' | 'capabilities' | 'clearance' | 'approximate' | 'notes'>>
    const item: EquipmentItem = {
      id, label: override.label ?? entry.label, category: override.category ?? entry.category,
      widthMm: override.widthMm ?? entry.defaultDimensionsMm.width,
      depthMm: override.depthMm ?? entry.defaultDimensionsMm.depth,
      heightMm: override.heightMm ?? entry.defaultDimensionsMm.height,
      xMm, yMm, rotationDeg: override.rotationDeg ?? 0,
      capabilities: override.capabilities ? [...override.capabilities] : [...entry.capabilities],
      visualPreset: entry.visualPreset,
      clearance: override.clearance ?? (entry.suggestedFrontClearanceMm
        ? { frontMm: entry.suggestedFrontClearanceMm, kind: entry.category === 'cooking' ? 'heat' : 'work' }
        : undefined),
      approximate: override.approximate, notes: override.notes,
      dimensionsLocked: false, movable: true, removable: true,
    }
    return clone(item)
  },
}
```

- [ ] **Step 5: Delegate spatial capability description and export the interface**

```ts
// src/domain/spatial-adapter.ts — replace describeCapabilities body
describeCapabilities() {
  return {
    workspace: structuredClone(kitchenCapabilityManifest.workspace),
    itemPresets: kitchenCapabilityManifest.catalog.map((entry) => entry.id),
    domainCapabilities: [...new Set(kitchenCapabilityManifest.catalog.flatMap((entry) => entry.capabilities))],
    catalog: kitchenCapabilityManifest.listCatalog(),
  }
}
```

Add `import { kitchenCapabilityManifest } from './kitchen-capability-manifest'`, and export `./agent-tools/capability-manifest` from `src/core/index.ts`.

- [ ] **Step 6: Run focused and regression tests**

Run: `npm test -- src/domain/kitchen-capability-manifest.test.ts src/core/queries/layout-query.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the capability boundary**

```bash
git add src/core/agent-tools/capability-manifest.ts src/domain/kitchen-capability-manifest.ts src/domain/kitchen-capability-manifest.test.ts src/domain/spatial-adapter.ts src/core/index.ts
git commit -m "feat: add spatial capability manifest"
```

---

### Task 2: Pure Atomic Layout Batches and One-Step Store Commits

**Files:**
- Create: `src/core/agent-tools/execute-layout-batch.ts`
- Create: `src/core/agent-tools/execute-layout-batch.test.ts`
- Modify: `src/state/project-store.ts`
- Modify: `src/state/project-store.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `executeLayoutCommand`, `LayoutCommand`, `ProjectEnvelope`, and `SpatialDocumentAdapter`.
- Produces: `executeLayoutBatch(input): LayoutBatchResult<TProject>` and `ProjectState.commitProjectCandidate(project, expectedRevision): ProjectCommitResult`.

- [ ] **Step 1: Write failing atomic-batch tests**

```ts
// src/core/agent-tools/execute-layout-batch.test.ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import { executeLayoutBatch } from './execute-layout-batch'

describe('executeLayoutBatch', () => {
  it('applies ordered operations to an isolated candidate with one resulting revision', () => {
    const project = createSeedProject()
    const result = executeLayoutBatch({
      envelope: { project, revision: 4 }, adapter: kitchenSpatialAdapter,
      expectedRevision: 4,
      commands: [
        { type: 'move-items', ids: ['tandoor'], anchor: { x: 2200, y: 900 } },
        { type: 'rotate-items', ids: ['tandoor'], deltaDeg: 90 },
      ],
    })
    expect(result).toMatchObject({ ok: true, revision: 5, changedIds: ['tandoor'] })
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2400, rotationDeg: 0 })
    if (result.ok) expect(result.project.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2200, rotationDeg: 90 })
  })

  it('returns the failing index and no candidate when any operation fails', () => {
    const project = createSeedProject()
    const result = executeLayoutBatch({
      envelope: { project, revision: 0 }, adapter: kitchenSpatialAdapter,
      commands: [
        { type: 'move-items', ids: ['tandoor'], anchor: { x: 2200, y: 900 } },
        { type: 'resize-item', id: 'missing', widthMm: 500, depthMm: 500 },
      ],
    })
    expect(result).toMatchObject({ ok: false, code: 'batch-operation-failed', operationIndex: 1, revision: 0 })
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')?.xMm).toBe(2400)
  })
})
```

Append this test to `src/state/project-store.test.ts`:

```ts
it('commits an agent candidate as one revision and one undo entry', () => {
  const store = createProjectStore(createSeedProject())
  const candidate = structuredClone(store.getState().project)
  candidate.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm = 2100
  candidate.variants[0].equipment.find((item) => item.id === 'six-burner')!.xMm = 1100
  expect(store.getState().commitProjectCandidate(candidate, 0)).toMatchObject({ ok: true, revision: 1 })
  expect(store.getState().past).toHaveLength(1)
  store.getState().undo()
  expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2400)
  expect(store.getState().commitProjectCandidate(candidate, 0)).toMatchObject({ ok: false, code: 'stale-revision', revision: 2 })
})
```

- [ ] **Step 2: Run the tests and verify missing interfaces**

Run: `npm test -- src/core/agent-tools/execute-layout-batch.test.ts src/state/project-store.test.ts`

Expected: FAIL because the batch module and `commitProjectCandidate` do not exist.

- [ ] **Step 3: Implement the pure batch executor**

```ts
// src/core/agent-tools/execute-layout-batch.ts
import type { LayoutCommand } from '../commands/layout-command'
import { executeLayoutCommand, type CommandErrorCode } from '../commands/execute-layout-command'
import type { ProjectEnvelope, SpatialDocumentAdapter, SpatialItem } from '../spatial/types'

export type LayoutBatchResult<TProject> =
  | { ok: true; project: TProject; revision: number; changedIds: string[]; warnings: string[]; commands: LayoutCommand[] }
  | { ok: false; code: 'stale-revision' | 'empty-batch' | 'batch-operation-failed'; message: string; revision: number; operationIndex?: number; causeCode?: CommandErrorCode; issues?: unknown }

export function executeLayoutBatch<TProject, TItem extends SpatialItem, TScenario>(input: {
  envelope: ProjectEnvelope<TProject>
  adapter: SpatialDocumentAdapter<TProject, TItem, TScenario>
  commands: readonly LayoutCommand[]
  expectedRevision?: number
}): LayoutBatchResult<TProject> {
  const { envelope, adapter } = input
  if (input.expectedRevision !== undefined && input.expectedRevision !== envelope.revision) {
    return { ok: false, code: 'stale-revision', message: `Expected revision ${input.expectedRevision}, received ${envelope.revision}.`, revision: envelope.revision }
  }
  if (input.commands.length === 0) return { ok: false, code: 'empty-batch', message: 'At least one layout operation is required.', revision: envelope.revision }
  let working: ProjectEnvelope<TProject> = { project: structuredClone(envelope.project), revision: envelope.revision }
  const changedIds: string[] = []
  const warnings: string[] = []
  for (let index = 0; index < input.commands.length; index += 1) {
    const result = executeLayoutCommand({ envelope: working, adapter, command: input.commands[index] })
    if (!result.ok) return {
      ok: false, code: 'batch-operation-failed', message: result.message,
      revision: envelope.revision, operationIndex: index, causeCode: result.code, issues: result.issues,
    }
    working = { project: result.project, revision: result.revision }
    changedIds.push(...result.changedIds)
    warnings.push(...result.warnings)
  }
  return {
    ok: true, project: working.project, revision: envelope.revision + 1,
    changedIds: [...new Set(changedIds)], warnings: [...new Set(warnings)], commands: structuredClone(input.commands),
  }
}
```

- [ ] **Step 4: Add the transactional store commit**

```ts
// src/state/project-store.ts — exported result and ProjectState member
export type ProjectCommitResult =
  | { ok: true; revision: number }
  | { ok: false; revision: number; code: 'stale-revision' | 'invalid-project'; message: string; issues?: unknown }

// ProjectState
commitProjectCandidate(project: KitchenProject, expectedRevision: number): ProjectCommitResult

// createProjectStore return object
commitProjectCandidate: (project, expectedRevision) => {
  const state = get()
  if (state.revision !== expectedRevision) return {
    ok: false, revision: state.revision, code: 'stale-revision',
    message: `Expected revision ${expectedRevision}, received ${state.revision}.`,
  }
  const parsed = projectSchema.safeParse(project)
  if (!parsed.success) return {
    ok: false, revision: state.revision, code: 'invalid-project',
    message: 'Candidate project failed full validation.', issues: parsed.error.issues,
  }
  set({
    project: structuredClone(parsed.data), revision: state.revision + 1,
    past: appendHistory(state.past, state.project), future: [],
  })
  return { ok: true, revision: state.revision + 1 }
},
```

Add `import { projectSchema } from '../domain/project-schema'` to `src/state/project-store.ts`. Extend the store test with an invalid candidate whose `activeVariantId` is `missing` and assert `invalid-project` without a revision change.

- [ ] **Step 5: Export the batch executor and run focused tests**

Add `export * from './agent-tools/execute-layout-batch'` to `src/core/index.ts`.

Run: `npm test -- src/core/agent-tools/execute-layout-batch.test.ts src/state/project-store.test.ts src/core/commands/execute-layout-command.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the atomic mutation foundation**

```bash
git add src/core/agent-tools/execute-layout-batch.ts src/core/agent-tools/execute-layout-batch.test.ts src/state/project-store.ts src/state/project-store.test.ts src/core/index.ts
git commit -m "feat: add atomic layout batch commits"
```

---

### Task 3: Strict Agent Inputs and Preview Tokens

**Files:**
- Create: `src/core/agent-tools/agent-contracts.ts`
- Create: `src/core/agent-tools/agent-contracts.test.ts`
- Create: `src/core/agent-tools/preview-registry.ts`
- Create: `src/core/agent-tools/preview-registry.test.ts`
- Modify: `src/domain/project-schema.ts`
- Modify: `src/domain/project-schema.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: existing layout command semantics and `SimulationScenario`.
- Produces: strict schemas for all ten site-tool inputs, `AgentLayoutOperation`, `SimulationScenarioPatch`, and `createPreviewRegistry<T>()`.

- [ ] **Step 1: Write failing schema and token tests**

```ts
// src/core/agent-tools/agent-contracts.test.ts
import { describe, expect, it } from 'vitest'
import { previewLayoutChangesInputSchema, previewSimulationChangesInputSchema, runSimulationInputSchema } from './agent-contracts'

describe('agent tool contracts', () => {
  it('accepts exact drawing operations and rejects arbitrary patches', () => {
    expect(previewLayoutChangesInputSchema.parse({
      expectedRevision: 3,
      operations: [{ op: 'move_components', ids: ['tandoor'], anchor: { xMm: 2200, yMm: 900 } }],
    })).toBeTruthy()
    expect(() => previewLayoutChangesInputSchema.parse({
      expectedRevision: 3,
      operations: [{ op: 'update_component', id: 'tandoor', patch: { __proto__: { admin: true } } }],
    })).toThrow()
  })

  it('validates simulation parameters and presentation values', () => {
    expect(previewSimulationChangesInputSchema.parse({
      scenarioId: 'dinner-peak', expectedRevision: 0,
      patch: { covers: 60, staff: [{ role: 'cdp', count: 3 }] },
    })).toBeTruthy()
    expect(() => previewSimulationChangesInputSchema.parse({ scenarioId: 'dinner-peak', expectedRevision: 0, patch: { cookToOrderRatio: 2 } })).toThrow()
    expect(runSimulationInputSchema.parse({ scenarioId: 'dinner-peak', expectedRevision: 0, presentation: 'open-live-simulation', playbackSpeed: 25 })).toBeTruthy()
  })

  it('supports exact architecture and variant operations without arbitrary fields', () => {
    expect(previewLayoutChangesInputSchema.parse({ expectedRevision: 0, operations: [
      { op: 'set_architecture_locked', locked: false },
      { op: 'update_architecture', patch: { widthMm: 4100, roomPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 4100, yMm: 0 }, { xMm: 4100, yMm: 6650 }] } },
      { op: 'duplicate_variant', sourceId: 'baseline-trace', duplicateId: 'wider-option', name: 'Wider option' },
      { op: 'activate_variant', id: 'wider-option' },
    ] })).toBeTruthy()
  })
})
```

```ts
// src/core/agent-tools/preview-registry.test.ts
import { describe, expect, it } from 'vitest'
import { createPreviewRegistry } from './preview-registry'

describe('preview registry', () => {
  it('issues single-use revision-bound tokens with deterministic expiry', () => {
    let now = 1_000
    let sequence = 0
    const registry = createPreviewRegistry<{ candidate: string }>({ now: () => now, createId: () => `token-${++sequence}`, ttlMs: 600_000 })
    expect(registry.issue({ kind: 'layout', revision: 2, payload: { candidate: 'v2' } })).toBe('token-1')
    expect(registry.consume('token-1', { kind: 'layout', revision: 3 })).toMatchObject({ ok: false, code: 'preview-revision-changed' })
    expect(registry.issue({ kind: 'layout', revision: 2, payload: { candidate: 'v2-fresh' } })).toBe('token-2')
    expect(registry.consume('token-2', { kind: 'layout', revision: 2 })).toMatchObject({ ok: true, payload: { candidate: 'v2-fresh' } })
    expect(registry.consume('token-2', { kind: 'layout', revision: 2 })).toMatchObject({ ok: false, code: 'invalid-preview-token' })
    now += 600_001
    expect(registry.issue({ kind: 'simulation', revision: 2, payload: { candidate: 'expired' } })).toBe('token-3')
    expect(registry.consume('token-3', { kind: 'simulation', revision: 2 })).toMatchObject({ ok: false, code: 'expired-preview-token' })
  })
})
```

- [ ] **Step 2: Run the focused tests and verify both modules are missing**

Run: `npm test -- src/core/agent-tools/agent-contracts.test.ts src/core/agent-tools/preview-registry.test.ts`

Expected: FAIL with missing-module errors.

- [ ] **Step 3: Define strict Zod contracts**

```ts
// src/core/agent-tools/agent-contracts.ts
import { z } from 'zod'

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.-]+$/)
const ids = z.array(id).min(1).max(100)
const pointMm = z.object({ xMm: z.number().finite(), yMm: z.number().finite() }).strict()
const dimensions = z.object({ widthMm: z.number().min(100).finite(), depthMm: z.number().min(100).finite(), heightMm: z.number().min(100).finite().optional() }).strict()
const capability = z.enum(['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep', 'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash', 'mix'])
const architecturePoint = z.object({ xMm: z.number().finite(), yMm: z.number().finite() }).strict()
const architectureRect = z.object({ id, xMm: z.number().finite(), yMm: z.number().finite(), widthMm: z.number().positive().finite(), depthMm: z.number().positive().finite() }).strict()
const opening = z.object({
  id, label: z.string().min(1).max(120), kind: z.enum(['door', 'service-window', 'sealed-opening']),
  wall: z.enum(['top', 'right', 'bottom', 'left']), offsetMm: z.number().nonnegative().finite(),
  widthMm: z.number().positive().finite(), sillHeightMm: z.number().nonnegative().finite().optional(),
  heightMm: z.number().positive().finite().optional(), flow: z.enum(['entry', 'clean-out', 'dirty-in', 'closed']).optional(),
  swingDepthMm: z.number().nonnegative().finite().optional(),
}).strict()
const architecturePatch = z.object({
  widthMm: z.number().positive().finite().optional(), depthMm: z.number().positive().finite().optional(),
  wallHeightMm: z.number().positive().finite().optional(), roomPolygon: z.array(architecturePoint).min(3).max(100).optional(),
  openings: z.array(opening).max(100).optional(), pillars: z.array(architectureRect).max(100).optional(),
  storageZones: z.array(architectureRect.extend({ label: z.string().min(1).max(120), adjacent: z.boolean() }).strict()).max(100).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'At least one architecture field is required')
const safeItemPatch = z.object({
  label: z.string().min(1).max(120).optional(),
  category: z.enum(['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom']).optional(),
  heightMm: z.number().min(100).finite().optional(),
  approximate: z.boolean().optional(), notes: z.string().max(1000).optional(),
  capabilities: z.array(capability).max(30).optional(),
  clearance: z.object({ frontMm: z.number().nonnegative().finite(), leftMm: z.number().nonnegative().finite().optional(), rightMm: z.number().nonnegative().finite().optional(), backMm: z.number().nonnegative().finite().optional(), kind: z.enum(['work', 'door-swing', 'heat', 'service']) }).strict().optional(),
}).strict()

export const agentLayoutOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_component'), id: id.optional(), catalogType: id, xMm: z.number().finite(), yMm: z.number().finite(), dimensions: dimensions.partial().optional(), rotationDeg: z.number().finite().optional(), patch: safeItemPatch.optional() }).strict(),
  z.object({ op: z.literal('move_components'), ids, anchor: pointMm }).strict(),
  z.object({ op: z.literal('nudge_components'), ids, delta: pointMm }).strict(),
  z.object({ op: z.literal('rotate_components'), ids, deltaDeg: z.number().finite() }).strict(),
  z.object({ op: z.literal('resize_component'), id, dimensions }).strict(),
  z.object({ op: z.literal('set_dimensions_locked'), id, locked: z.boolean() }).strict(),
  z.object({ op: z.literal('update_component'), id, patch: safeItemPatch }).strict(),
  z.object({ op: z.literal('duplicate_component'), id, duplicateId: id }).strict(),
  z.object({ op: z.literal('remove_components'), ids }).strict(),
  z.object({ op: z.literal('set_display_unit'), unit: z.enum(['mm', 'cm', 'in', 'ft']) }).strict(),
  z.object({ op: z.literal('set_snap'), intervalMm: z.number().positive().finite() }).strict(),
  z.object({ op: z.literal('set_architecture_locked'), locked: z.boolean() }).strict(),
  z.object({ op: z.literal('update_architecture'), patch: architecturePatch }).strict(),
  z.object({ op: z.literal('create_variant'), id, name: z.string().min(1).max(120) }).strict(),
  z.object({ op: z.literal('duplicate_variant'), sourceId: id, duplicateId: id, name: z.string().min(1).max(120) }).strict(),
  z.object({ op: z.literal('activate_variant'), id }).strict(),
  z.object({ op: z.literal('rename_variant'), id, name: z.string().min(1).max(120) }).strict(),
  z.object({ op: z.literal('remove_variant'), id }).strict(),
])

export const previewLayoutChangesInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  operations: z.array(agentLayoutOperationSchema).min(1).max(100),
  intent: z.string().max(500).optional(),
}).strict()
export const applyPreviewInputSchema = z.object({ previewToken: z.string().min(1).max(256) }).strict()
export const getLayoutInputSchema = z.object({ view: z.enum(['summary', 'architecture', 'components', 'full']).default('summary'), ids: z.array(id).max(100).optional(), category: z.string().max(80).optional(), tag: z.string().max(80).optional() }).strict()
export const getCatalogInputSchema = z.object({ category: z.string().max(80).optional(), capability: z.string().max(80).optional() }).strict()
export const emptyInputSchema = z.object({}).strict()

const staff = z.array(z.object({ role: z.enum(['head-chef', 'sous-chef', 'cdp', 'busser-washer']), count: z.number().int().min(0).max(20) }).strict()).min(1).max(20)
const duration = z.object({ minSeconds: z.number().positive().finite(), maxSeconds: z.number().positive().finite() }).strict().refine((value) => value.minSeconds <= value.maxSeconds, 'minSeconds must not exceed maxSeconds')
export const simulationScenarioPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(), covers: z.number().int().min(1).max(500).optional(),
  durationMinutes: z.number().min(1).max(360).finite().optional(),
  arrivalPattern: z.enum(['seating-wave', 'steady', 'two-waves']).optional(),
  cookToOrderRatio: z.number().min(0).max(1).optional(), seed: z.number().int().optional(), staff: staff.optional(),
  checks: z.object({ collisions: z.boolean(), doorSwings: z.boolean(), dirtyCleanCrossings: z.boolean() }).strict().optional(),
  taskDurations: z.partialRecord(capability, duration).optional(),
  stationCapacities: z.record(z.string(), z.number().int().positive().max(20)).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'At least one simulation parameter is required')
export const previewSimulationChangesInputSchema = z.object({ scenarioId: id, expectedRevision: z.number().int().nonnegative(), patch: simulationScenarioPatchSchema }).strict()
export const runSimulationInputSchema = z.object({ scenarioId: id, expectedRevision: z.number().int().nonnegative(), elapsedSeconds: z.number().nonnegative().finite().optional(), presentation: z.enum(['results-only', 'open-live-simulation']).default('results-only'), playbackSpeed: z.number().min(1).max(100).finite().optional() }).strict()

export const AGENT_LAYOUT_OPERATION_NAMES = [
  'add_component', 'move_components', 'nudge_components', 'rotate_components', 'resize_component',
  'set_dimensions_locked', 'update_component', 'duplicate_component', 'remove_components',
  'set_display_unit', 'set_snap', 'set_architecture_locked', 'update_architecture',
  'create_variant', 'duplicate_variant', 'activate_variant', 'rename_variant', 'remove_variant',
] as const
export type AgentLayoutOperation = z.infer<typeof agentLayoutOperationSchema>
export type SimulationScenarioPatch = z.infer<typeof simulationScenarioPatchSchema>
```

- [ ] **Step 4: Enforce duration ordering in complete scenarios**

In `src/domain/project-schema.ts`, add `.superRefine(...)` to `scenarioSchema` that reports an issue for every `taskDurations[capability]` where `minSeconds > maxSeconds`:

```ts
}).strict().superRefine((scenario, context) => {
  Object.entries(scenario.taskDurations ?? {}).forEach(([capability, range]) => {
    if (range.minSeconds > range.maxSeconds) context.addIssue({
      code: 'custom', path: ['taskDurations', capability],
      message: 'Minimum task duration must not exceed maximum task duration',
    })
  })
})
```

Add a test to `project-schema.test.ts` proving `{ minSeconds: 90, maxSeconds: 30 }` is rejected.

- [ ] **Step 5: Implement the expiring token registry**

```ts
// src/core/agent-tools/preview-registry.ts
export type PreviewKind = 'layout' | 'simulation'
type Entry<T> = { kind: PreviewKind; revision: number; expiresAt: number; payload: T }
type ConsumeResult<T> =
  | { ok: true; payload: T }
  | { ok: false; code: 'invalid-preview-token' | 'expired-preview-token' | 'preview-revision-changed'; message: string }

export function createPreviewRegistry<T>(options: { now?: () => number; createId?: () => string; ttlMs?: number } = {}) {
  const now = options.now ?? Date.now
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID())
  const ttlMs = options.ttlMs ?? 600_000
  const entries = new Map<string, Entry<T>>()
  return {
    issue(input: { kind: PreviewKind; revision: number; payload: T }) {
      const token = createId()
      entries.set(token, { ...input, payload: structuredClone(input.payload), expiresAt: now() + ttlMs })
      return token
    },
    consume(token: string, expected: { kind: PreviewKind; revision: number }): ConsumeResult<T> {
      const entry = entries.get(token)
      if (!entry || entry.kind !== expected.kind) return { ok: false, code: 'invalid-preview-token', message: 'Preview token is invalid or already used.' }
      entries.delete(token)
      if (now() > entry.expiresAt) return { ok: false, code: 'expired-preview-token', message: 'Preview token has expired.' }
      if (entry.revision !== expected.revision) return { ok: false, code: 'preview-revision-changed', message: `Preview revision ${entry.revision} no longer matches ${expected.revision}.` }
      return { ok: true, payload: structuredClone(entry.payload) }
    },
    clear() { entries.clear() },
  }
}
```

- [ ] **Step 6: Run focused schema and registry tests**

Run: `npm test -- src/core/agent-tools/agent-contracts.test.ts src/core/agent-tools/preview-registry.test.ts src/domain/project-schema.test.ts`

Expected: PASS.

- [ ] **Step 7: Export and commit the contracts**

Add exports for both new modules to `src/core/index.ts`, then:

```bash
git add src/core/agent-tools/agent-contracts.ts src/core/agent-tools/agent-contracts.test.ts src/core/agent-tools/preview-registry.ts src/core/agent-tools/preview-registry.test.ts src/domain/project-schema.ts src/domain/project-schema.test.ts src/core/index.ts
git commit -m "feat: define safe agent preview contracts"
```

---

### Task 4: Agent Workspace Facade for Drawing and Simulation

**Files:**
- Create: `src/core/agent-tools/agent-workspace-facade.ts`
- Create: `src/core/agent-tools/agent-workspace-facade.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `ProjectStore`, `ApplicationService`, `WorkspaceCapabilityManifest<EquipmentItem>`, `executeLayoutBatch`, strict input schemas, `analyzeLayout`, and `createPreviewRegistry`.
- Produces: `AgentWorkspaceFacade`, `SimulationPresentationRequest`, and `createAgentWorkspaceFacade(options)`.

- [ ] **Step 1: Write failing end-to-end facade tests**

```ts
// src/core/agent-tools/agent-workspace-facade.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createApplicationService } from '../application/application-service'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenCapabilityManifest } from '../../domain/kitchen-capability-manifest'
import { runSimulation } from '../../simulation/engine'
import { createProjectStore, getActiveItem } from '../../state/project-store'
import { createAgentWorkspaceFacade } from './agent-workspace-facade'

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const presentSimulation = vi.fn()
  const service = createApplicationService({ store, runSimulation })
  return { store, presentSimulation, facade: createAgentWorkspaceFacade({ store, service, manifest: kitchenCapabilityManifest, presentSimulation, createId: () => 'preview-1' }) }
}

describe('AgentWorkspaceFacade', () => {
  it('guides an external image-reading agent without accepting images', () => {
    const { facade } = setup()
    const guide = facade.getWorkspaceGuide({})
    expect(guide).toMatchObject({ ok: true, revision: 0, data: { canonicalUnit: 'mm' } })
    expect(JSON.stringify(guide)).toMatch(/external agent.*image/i)
    expect(JSON.stringify(guide)).not.toMatch(/uploadUrl|imageData|base64/)
  })

  it('previews and applies a multi-component drawing change as one undo step', () => {
    const { facade, store } = setup()
    const preview = facade.previewLayoutChanges({
      expectedRevision: 0,
      operations: [
        { op: 'move_components', ids: ['tandoor'], anchor: { xMm: 2200, yMm: 900 } },
        { op: 'add_component', id: 'agent-rice-warmer', catalogType: 'generic', xMm: 1300, yMm: 4300, patch: { label: 'Rice warmer' } },
      ],
    })
    expect(preview).toMatchObject({ ok: true, revision: 0, data: { previewToken: 'preview-1', changedIds: expect.arrayContaining(['tandoor', 'agent-rice-warmer']) } })
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2400)
    expect(facade.applyLayoutChanges({ previewToken: 'preview-1' })).toMatchObject({ ok: true, revision: 1 })
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2200)
    expect(store.getState().past).toHaveLength(1)
    expect(facade.applyLayoutChanges({ previewToken: 'preview-1' })).toMatchObject({ ok: false, code: 'invalid-preview-token' })
  })

  it('previews scenario changes, invalidates stale results, and presents the exact run', () => {
    const { facade, store, presentSimulation } = setup()
    const preview = facade.previewSimulationChanges({ scenarioId: 'dinner-peak', expectedRevision: 0, patch: { covers: 64, staff: [{ role: 'head-chef', count: 1 }, { role: 'sous-chef', count: 1 }, { role: 'cdp', count: 3 }, { role: 'busser-washer', count: 1 }] } })
    expect(preview).toMatchObject({ ok: true, data: { changedParameters: expect.arrayContaining(['covers', 'staff']) } })
    if (!preview.ok) throw new Error('preview failed')
    expect(facade.applySimulationChanges({ previewToken: preview.data.previewToken })).toMatchObject({ ok: true, revision: 1 })
    expect(store.getState().project.scenarios[0].covers).toBe(64)
    const run = facade.runSimulation({ scenarioId: 'dinner-peak', expectedRevision: 1, presentation: 'open-live-simulation', playbackSpeed: 25 })
    expect(run).toMatchObject({ ok: true, revision: 1, data: { metrics: { totalOrders: expect.any(Number) } } })
    expect(presentSimulation).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'dinner-peak', revision: 1, speed: 25, result: expect.any(Object) }))
  })

  it('updates unlocked architecture and activates a new variant through the same preview', () => {
    const { facade, store } = setup()
    const preview = facade.previewLayoutChanges({ expectedRevision: 0, operations: [
      { op: 'set_architecture_locked', locked: false },
      { op: 'update_architecture', patch: { wallHeightMm: 3000 } },
      { op: 'duplicate_variant', sourceId: 'baseline-trace', duplicateId: 'agent-option', name: 'Agent option' },
      { op: 'activate_variant', id: 'agent-option' },
    ] })
    expect(preview).toMatchObject({ ok: true })
    if (!preview.ok) throw new Error('preview failed')
    expect(facade.applyLayoutChanges({ previewToken: preview.data.previewToken })).toMatchObject({ ok: true, revision: 1 })
    expect(store.getState().project).toMatchObject({ activeVariantId: 'agent-option', architecture: { wallHeightMm: 3000, locked: false } })
  })
})
```

- [ ] **Step 2: Run the test and verify the facade is missing**

Run: `npm test -- src/core/agent-tools/agent-workspace-facade.test.ts`

Expected: FAIL because `createAgentWorkspaceFacade` does not exist.

- [ ] **Step 3: Define the facade interfaces and normalization map**

```ts
// src/core/agent-tools/agent-workspace-facade.ts — public interfaces
import type { SimulationScenario } from '../../domain/project'
import type { LayoutIssue } from '../../domain/layout-diagnostics'
import type { SimulationResult } from '../../simulation/types'
import type { SimulationQuerySnapshot } from '../application/types'
import type { AgentLayoutOperation } from './agent-contracts'

export type SimulationPresentationRequest = {
  id: string
  scenarioId: string
  revision: number
  speed: number
  result: SimulationResult
}

export type LayoutPreviewData = { previewToken: string; changedIds: string[]; operations: AgentLayoutOperation[]; diagnosticsBefore: LayoutIssue[]; diagnosticsAfter: LayoutIssue[] }
export type LayoutApplyData = { changedIds: string[]; diagnostics: LayoutIssue[] }
export type SimulationPreviewData = { previewToken: string; scenario: SimulationScenario; changedParameters: string[] }
export type SimulationApplyData = { scenario: SimulationScenario; changedParameters: string[] }
export type SimulationRunData = { assumptions: SimulationScenario; metrics: SimulationResult['metrics']; durationSeconds: number; snapshot?: SimulationQuerySnapshot }

export interface AgentWorkspaceFacade {
  getWorkspaceGuide(input: unknown): AgentResult<unknown>
  getLayout(input: unknown): AgentResult<unknown>
  getComponentCatalog(input: unknown): AgentResult<unknown>
  analyzeLayout(input: unknown): AgentResult<unknown>
  previewLayoutChanges(input: unknown): AgentResult<LayoutPreviewData>
  applyLayoutChanges(input: unknown): AgentResult<LayoutApplyData>
  getSimulationGuide(input: unknown): AgentResult<unknown>
  previewSimulationChanges(input: unknown): AgentResult<SimulationPreviewData>
  applySimulationChanges(input: unknown): AgentResult<SimulationApplyData>
  runSimulation(input: unknown): AgentResult<SimulationRunData>
}

export type AgentResult<T> =
  | { ok: true; revision: number; data: T; warnings: string[] }
  | { ok: false; revision: number; code: string; message: string; details?: unknown; issues?: unknown }

export function createAgentWorkspaceFacade(options: {
  store: ProjectStore
  service: ApplicationService
  manifest: WorkspaceCapabilityManifest<EquipmentItem>
  presentSimulation(request: SimulationPresentationRequest): void
  createId?: () => string
  now?: () => Date
}): AgentWorkspaceFacade
```

Implement `normalizeLayoutOperations(operations, manifest, createId, now): LayoutCommand[]` as a total `flatMap` so a full-height resize may produce two internal commands:

```ts
switch (operation.op) {
  case 'add_component': {
    const id = operation.id ?? `agent-${operation.catalogType}-${createId()}`
    const item = manifest.createItem({
      catalogType: operation.catalogType, id, xMm: operation.xMm, yMm: operation.yMm,
      overrides: { ...operation.patch, ...operation.dimensions, rotationDeg: operation.rotationDeg ?? 0 },
    })
    return [{ type: 'add-item', item }]
  }
  case 'move_components': return [{ type: 'move-items', ids: operation.ids, anchor: { x: operation.anchor.xMm, y: operation.anchor.yMm } }]
  case 'nudge_components': return [{ type: 'nudge-items', ids: operation.ids, delta: { x: operation.delta.xMm, y: operation.delta.yMm } }]
  case 'rotate_components': return [{ type: 'rotate-items', ids: operation.ids, deltaDeg: operation.deltaDeg }]
  case 'resize_component': return [
    { type: 'resize-item', id: operation.id, widthMm: operation.dimensions.widthMm, depthMm: operation.dimensions.depthMm },
    ...(operation.dimensions.heightMm === undefined ? [] : [{ type: 'update-item' as const, id: operation.id, patch: { heightMm: operation.dimensions.heightMm } }]),
  ]
  case 'set_dimensions_locked': return [{ type: 'set-dimensions-locked', id: operation.id, locked: operation.locked }]
  case 'update_component': return [{ type: 'update-item', id: operation.id, patch: operation.patch }]
  case 'duplicate_component': return [{ type: 'duplicate-item', id: operation.id, duplicateId: operation.duplicateId }]
  case 'remove_components': return [{ type: 'remove-items', ids: operation.ids }]
  case 'set_display_unit': return [{ type: 'set-display-unit', unit: operation.unit }]
  case 'set_snap': return [{ type: 'set-snap', intervalMm: operation.intervalMm }]
  case 'set_architecture_locked': return [{ type: 'set-architecture-lock', locked: operation.locked }]
  case 'update_architecture': {
    const { roomPolygon, ...patch } = operation.patch
    return [{ type: 'update-architecture', patch: { ...patch, ...(roomPolygon ? { roomPolygon: roomPolygon.map((point) => ({ x: point.xMm, y: point.yMm })) } : {}) } }]
  }
  case 'create_variant': return [{ type: 'create-variant', id: operation.id, name: operation.name, now: now().toISOString() }]
  case 'duplicate_variant': return [{ type: 'duplicate-variant', sourceId: operation.sourceId, duplicateId: operation.duplicateId, name: operation.name, now: now().toISOString() }]
  case 'activate_variant': return [{ type: 'activate-variant', id: operation.id }]
  case 'rename_variant': return [{ type: 'rename-variant', id: operation.id, name: operation.name }]
  case 'remove_variant': return [{ type: 'remove-variant', id: operation.id }]
}
```

- [ ] **Step 4: Implement read, preview, and apply workflows**

`createAgentWorkspaceFacade` must create one preview registry whose payload union is:

```ts
type PreviewPayload =
  | { kind: 'layout'; candidate: KitchenProject; changedIds: string[]; warnings: string[]; beforeIssues: LayoutIssue[]; afterIssues: LayoutIssue[] }
  | { kind: 'simulation'; candidate: KitchenProject; scenarioId: string; changedParameters: string[]; warnings: string[] }
```

Implement these exact rules:

- Every method parses with its Task 3 schema and converts parse failures to `invalid-input` with Zod issues.
- `getWorkspaceGuide` returns manifest workspace data, room summary, current revision, tool names, operations, and the sequence `read → preview → apply → analyze`.
- `getLayout` delegates to application-service queries and filters cloned items when IDs/category/tag are supplied.
- `getComponentCatalog` delegates to `manifest.listCatalog`.
- `analyzeLayout` returns `LayoutIssue[]`, counts by severity, and the current revision.
- `previewLayoutChanges` normalizes once, calls `executeLayoutBatch`, compares `analyzeLayout` before/after, stores the complete candidate in a `layout` token, and does not mutate the store.
- `applyLayoutChanges` consumes the token using the store's current revision, calls `commitProjectCandidate`, and returns the stored candidate summary. Never rerun normalization at apply time.
- `getSimulationGuide` returns current cloned scenarios, editable field descriptions, manifest roles/patterns, and result definitions.
- `previewSimulationChanges` merges the strict patch onto the exact scenario, parses the complete value with `scenarioSchema`, constructs a candidate project, records changed top-level keys, and issues a `simulation` token.
- `applySimulationChanges` consumes and commits the candidate once. It reports that all earlier run results are stale.
- `runSimulation` calls `service.runScenario`, optionally `service.querySimulation`, and for `open-live-simulation` passes the exact successful `SimulationResult` to `presentSimulation` with speed defaulting to 25.
- Catch catalog lookup failures and return `unknown-catalog-component` rather than throwing through WebMCP.
- Call `structuredClone` on all externally returned document and result payloads.

Initialize dependencies and parsing failures exactly once inside the factory:

```ts
const { store, service, manifest, presentSimulation } = options
const createId = options.createId ?? (() => crypto.randomUUID())
const now = options.now ?? (() => new Date())
const previews = createPreviewRegistry<PreviewPayload>({ createId, now: () => now().getTime() })
const invalid = (issues: unknown, revision: number): AgentResult<never> => ({ ok: false, revision, code: 'invalid-input', message: 'Tool input is invalid.', details: issues })
const layoutIssues = (project: KitchenProject) => {
  const variant = project.variants.find((value) => value.id === project.activeVariantId)
  return analyzeLayout(project.architecture, variant?.equipment ?? [])
}
```

Use these concrete read method bodies:

```ts
getWorkspaceGuide(input) {
  const state = store.getState()
  const parsed = emptyInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  return { ok: true, revision: state.revision, warnings: [], data: {
    ...structuredClone(manifest.workspace),
    room: { widthMm: state.project.architecture.widthMm, depthMm: state.project.architecture.depthMm, polygon: structuredClone(state.project.architecture.roomPolygon) },
    workflow: ['get_workspace_guide', 'get_component_catalog', 'get_layout', 'preview_layout_changes', 'apply_layout_changes', 'analyze_layout'],
    simulationWorkflow: ['get_simulation_guide', 'preview_simulation_changes', 'apply_simulation_changes', 'run_simulation'],
    operations: [...AGENT_LAYOUT_OPERATION_NAMES],
    guidance: ['Do not send image bytes to this site.', 'Use millimetres.', 'Do not invent a scale.', 'Reread after stale-revision.'],
  } }
},
getLayout(input) {
  const state = store.getState()
  const parsed = getLayoutInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  if (parsed.data.view === 'summary') {
    const active = service.queryLayout({ type: 'active-layout' })
    if (!active.ok) return active
    return { ok: true, revision: state.revision, warnings: [], data: { projectId: state.project.id, name: state.project.name, activeVariantId: state.project.activeVariantId, activeScenarioId: state.project.activeScenarioId, displayUnit: state.project.displayUnit, snapMm: state.project.snapMm, layout: active.data } }
  }
  if (parsed.data.view === 'architecture') {
    const result = service.queryLayout({ type: 'architecture' })
    return result.ok ? { ok: true, revision: result.revision, warnings: [], data: { architecture: result.data } } : result
  }
  if (parsed.data.view === 'components') {
    const result = service.queryLayout({ type: 'list-items', category: parsed.data.category, tag: parsed.data.tag })
    if (!result.ok) return result
    const items = (result.data as EquipmentItem[]).filter((item) => !parsed.data.ids || parsed.data.ids.includes(item.id))
    return { ok: true, revision: result.revision, warnings: [], data: { components: structuredClone(items) } }
  }
  const result = service.queryLayout({ type: 'project-snapshot' })
  return result.ok ? { ok: true, revision: result.revision, warnings: [], data: { project: result.data } } : result
},
getComponentCatalog(input) {
  const state = store.getState()
  const parsed = getCatalogInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  return { ok: true, revision: state.revision, warnings: [], data: { components: manifest.listCatalog(parsed.data) } }
},
analyzeLayout(input) {
  const state = store.getState()
  const parsed = emptyInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  const findings = layoutIssues(state.project)
  return { ok: true, revision: state.revision, warnings: [], data: { findings: structuredClone(findings), summary: { errors: findings.filter((finding) => finding.severity === 'error').length, warnings: findings.filter((finding) => finding.severity === 'warning').length } } }
},
getSimulationGuide(input) {
  const state = store.getState()
  const parsed = emptyInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  return { ok: true, revision: state.revision, warnings: [], data: {
    activeScenarioId: state.project.activeScenarioId, scenarios: structuredClone(state.project.scenarios),
    editableParameters: ['name', 'covers', 'durationMinutes', 'arrivalPattern', 'cookToOrderRatio', 'seed', 'staff', 'checks', 'taskDurations', 'stationCapacities'],
    staffRoles: [...manifest.staffRoles], arrivalPatterns: [...manifest.arrivalPatterns],
    resultFields: ['assumptions', 'metrics', 'durationSeconds', 'snapshot'],
    disclaimer: 'Simulation values are planning assumptions, not observed service data or regulatory certification.',
  } }
},
```

Use these concrete mutation method bodies inside the returned facade object (with `invalid(schemaResult, revision)` converting Zod failures and `layoutIssues(project)` selecting the active variant before calling `analyzeLayout`):

```ts
previewLayoutChanges(input) {
  const state = store.getState()
  const parsed = previewLayoutChangesInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  try {
    const commands = normalizeLayoutOperations(parsed.data.operations, manifest, createId, now)
    const batch = executeLayoutBatch({ envelope: { project: state.project, revision: state.revision }, adapter: kitchenSpatialAdapter, commands, expectedRevision: parsed.data.expectedRevision })
    if (!batch.ok) return { ok: false, revision: batch.revision, code: batch.code, message: batch.message, details: batch }
    const candidate = projectSchema.safeParse(batch.project)
    if (!candidate.success) return { ok: false, revision: state.revision, code: 'invalid-project', message: 'Candidate project failed full validation.', details: candidate.error.issues }
    const payload: PreviewPayload = { kind: 'layout', candidate: candidate.data, changedIds: batch.changedIds, warnings: batch.warnings, beforeIssues: layoutIssues(state.project), afterIssues: layoutIssues(candidate.data) }
    const previewToken = previews.issue({ kind: 'layout', revision: state.revision, payload })
    return { ok: true, revision: state.revision, warnings: batch.warnings, data: { previewToken, changedIds: batch.changedIds, operations: parsed.data.operations, diagnosticsBefore: payload.beforeIssues, diagnosticsAfter: payload.afterIssues } }
  } catch (error) {
    return { ok: false, revision: state.revision, code: 'unknown-catalog-component', message: error instanceof Error ? error.message : 'Catalog component could not be created.' }
  }
},
applyLayoutChanges(input) {
  const state = store.getState()
  const parsed = applyPreviewInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  const consumed = previews.consume(parsed.data.previewToken, { kind: 'layout', revision: state.revision })
  if (!consumed.ok) return { ok: false, revision: state.revision, code: consumed.code, message: consumed.message }
  if (consumed.payload.kind !== 'layout') return { ok: false, revision: state.revision, code: 'invalid-preview-token', message: 'Preview token is not a layout preview.' }
  const committed = store.getState().commitProjectCandidate(consumed.payload.candidate, state.revision)
  if (!committed.ok) return committed
  return { ok: true, revision: committed.revision, warnings: consumed.payload.warnings, data: { changedIds: consumed.payload.changedIds, diagnostics: consumed.payload.afterIssues } }
},
previewSimulationChanges(input) {
  const state = store.getState()
  const parsed = previewSimulationChangesInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  if (parsed.data.expectedRevision !== state.revision) return { ok: false, revision: state.revision, code: 'stale-revision', message: `Expected revision ${parsed.data.expectedRevision}, received ${state.revision}.` }
  const current = state.project.scenarios.find((scenario) => scenario.id === parsed.data.scenarioId)
  if (!current) return { ok: false, revision: state.revision, code: 'missing-scenario', message: `Scenario ${parsed.data.scenarioId} does not exist.` }
  const scenario = scenarioSchema.safeParse({ ...current, ...parsed.data.patch, id: current.id })
  if (!scenario.success) return { ok: false, revision: state.revision, code: 'invalid-scenario', message: 'Resulting scenario is invalid.', details: scenario.error.issues }
  const candidate = structuredClone(state.project)
  candidate.scenarios = candidate.scenarios.map((value) => value.id === current.id ? scenario.data : value)
  const changedParameters = Object.keys(parsed.data.patch)
  const payload: PreviewPayload = { kind: 'simulation', candidate, scenarioId: current.id, changedParameters, warnings: ['Applying this preview invalidates results from older revisions.'] }
  const previewToken = previews.issue({ kind: 'simulation', revision: state.revision, payload })
  return { ok: true, revision: state.revision, warnings: payload.warnings, data: { previewToken, scenario: structuredClone(scenario.data), changedParameters } }
},
applySimulationChanges(input) {
  const state = store.getState()
  const parsed = applyPreviewInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  const consumed = previews.consume(parsed.data.previewToken, { kind: 'simulation', revision: state.revision })
  if (!consumed.ok) return { ok: false, revision: state.revision, code: consumed.code, message: consumed.message }
  if (consumed.payload.kind !== 'simulation') return { ok: false, revision: state.revision, code: 'invalid-preview-token', message: 'Preview token is not a simulation preview.' }
  const committed = store.getState().commitProjectCandidate(consumed.payload.candidate, state.revision)
  if (!committed.ok) return committed
  const scenario = consumed.payload.candidate.scenarios.find((value) => value.id === consumed.payload.scenarioId)!
  return { ok: true, revision: committed.revision, warnings: consumed.payload.warnings, data: { scenario: structuredClone(scenario), changedParameters: consumed.payload.changedParameters } }
},
runSimulation(input) {
  const state = store.getState()
  const parsed = runSimulationInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues, state.revision)
  const run = service.runScenario({ scenarioId: parsed.data.scenarioId, expectedRevision: parsed.data.expectedRevision })
  if (!run.ok) return run
  const scenario = state.project.scenarios.find((value) => value.id === parsed.data.scenarioId)!
  if (parsed.data.presentation === 'open-live-simulation') presentSimulation({ id: `simulation-${createId()}`, scenarioId: scenario.id, revision: state.revision, speed: parsed.data.playbackSpeed ?? 25, result: run.data })
  const snapshot = parsed.data.elapsedSeconds === undefined ? undefined : service.querySimulation({ scenarioId: scenario.id, elapsedSeconds: parsed.data.elapsedSeconds })
  return { ok: true, revision: state.revision, warnings: run.warnings, data: { assumptions: structuredClone(scenario), metrics: structuredClone(run.data.metrics), durationSeconds: run.data.durationSeconds, ...(snapshot?.ok ? { snapshot: snapshot.data } : {}) } }
},
```

- [ ] **Step 5: Run facade, application-service, batch, and store tests**

Run: `npm test -- src/core/agent-tools/agent-workspace-facade.test.ts src/core/application/application-service.test.ts src/core/agent-tools/execute-layout-batch.test.ts src/state/project-store.test.ts`

Expected: PASS.

- [ ] **Step 6: Export and commit the agent facade**

Add `export * from './agent-tools/agent-workspace-facade'` to `src/core/index.ts`, then:

```bash
git add src/core/agent-tools/agent-workspace-facade.ts src/core/agent-tools/agent-workspace-facade.test.ts src/core/index.ts
git commit -m "feat: add agent workspace facade"
```

---

### Task 5: WebMCP Tool Definitions and Strict JSON Schemas

**Files:**
- Create: `src/webmcp/tool-definitions.ts`
- Create: `src/webmcp/tool-definitions.test.ts`

**Interfaces:**
- Consumes: `AgentWorkspaceFacade`, Task 3 Zod schemas, and `z.toJSONSchema`.
- Produces: `WebMcpToolDefinition`, `WebMcpActivity`, `WEBMCP_TOOL_NAMES`, and `createWebMcpToolDefinitions(facade, onActivity)`.

- [ ] **Step 1: Write failing definition and invocation tests**

```ts
// src/webmcp/tool-definitions.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createWebMcpToolDefinitions, WEBMCP_TOOL_NAMES } from './tool-definitions'

describe('WebMCP tool definitions', () => {
  it('publishes stable unique workflow tools with strict schemas and annotations', () => {
    const facade = new Proxy({}, { get: () => vi.fn(() => ({ ok: true, revision: 0, data: {}, warnings: [] })) })
    const tools = createWebMcpToolDefinitions(facade as never, vi.fn())
    expect(tools.map((tool) => tool.name)).toEqual(WEBMCP_TOOL_NAMES)
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(10)
    expect(tools.find((tool) => tool.name === 'get_layout')?.annotations).toEqual({ readOnlyHint: true })
    expect(tools.find((tool) => tool.name === 'apply_layout_changes')?.annotations).toEqual({ readOnlyHint: false })
    expect(tools.find((tool) => tool.name === 'run_simulation')?.annotations).toEqual({ readOnlyHint: false })
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true)
  })

  it('invokes the current facade method, reports activity, and honors cancellation', async () => {
    const getLayout = vi.fn(() => ({ ok: true, revision: 7, data: { view: 'summary' }, warnings: [] }))
    const onActivity = vi.fn()
    const tools = createWebMcpToolDefinitions({ getLayout } as never, onActivity)
    const tool = tools.find((candidate) => candidate.name === 'get_layout')!
    await expect(tool.execute({ view: 'summary' }, { signal: new AbortController().signal })).resolves.toMatchObject({ ok: true, revision: 7 })
    expect(getLayout).toHaveBeenCalledWith({ view: 'summary' })
    expect(onActivity).toHaveBeenLastCalledWith(expect.objectContaining({ tool: 'get_layout', status: 'success', revision: 7 }))
    const controller = new AbortController(); controller.abort(new DOMException('Canceled', 'AbortError'))
    await expect(tool.execute({}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `npm test -- src/webmcp/tool-definitions.test.ts`

Expected: FAIL because `tool-definitions.ts` does not exist.

- [ ] **Step 3: Implement the stable definition factory**

```ts
// src/webmcp/tool-definitions.ts
import { z, type ZodType } from 'zod'
import type { AgentWorkspaceFacade } from '../core/agent-tools/agent-workspace-facade'
import { applyPreviewInputSchema, emptyInputSchema, getCatalogInputSchema, getLayoutInputSchema, previewLayoutChangesInputSchema, previewSimulationChangesInputSchema, runSimulationInputSchema } from '../core/agent-tools/agent-contracts'

export const WEBMCP_TOOL_NAMES = [
  'get_workspace_guide', 'get_layout', 'get_component_catalog', 'analyze_layout',
  'preview_layout_changes', 'apply_layout_changes', 'get_simulation_guide',
  'preview_simulation_changes', 'apply_simulation_changes', 'run_simulation',
] as const

export type WebMcpActivity = { id: string; tool: typeof WEBMCP_TOOL_NAMES[number]; status: 'running' | 'success' | 'error'; at: string; revision?: number; summary: string }
export type WebMcpToolDefinition = {
  name: typeof WEBMCP_TOOL_NAMES[number]
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint: boolean }
  execute(input: Record<string, unknown>, options: { signal: AbortSignal }): Promise<unknown>
}

const definitions: Array<{ name: typeof WEBMCP_TOOL_NAMES[number]; title: string; description: string; schema: ZodType; method: keyof AgentWorkspaceFacade; readOnly: boolean }> = [
  { name: 'get_workspace_guide', title: 'Get workspace guide', description: 'Read coordinate, unit, image-responsibility, workflow, and capability guidance before editing.', schema: emptyInputSchema, method: 'getWorkspaceGuide', readOnly: true },
  { name: 'get_layout', title: 'Get layout', description: 'Read the current revision, architecture, components, or full spatial document.', schema: getLayoutInputSchema, method: 'getLayout', readOnly: true },
  { name: 'get_component_catalog', title: 'Get component catalog', description: 'List component types, dimensions, capabilities, clearances, and visual presets available for structured adds.', schema: getCatalogInputSchema, method: 'getComponentCatalog', readOnly: true },
  { name: 'analyze_layout', title: 'Analyze layout', description: 'Read boundary, overlap, pillar, and clearance findings for the current revision.', schema: emptyInputSchema, method: 'analyzeLayout', readOnly: true },
  { name: 'preview_layout_changes', title: 'Preview layout changes', description: 'Validate an atomic drawing-change batch without modifying the shared canvas. Required before apply_layout_changes.', schema: previewLayoutChangesInputSchema, method: 'previewLayoutChanges', readOnly: true },
  { name: 'apply_layout_changes', title: 'Apply layout changes', description: 'Apply one previously previewed layout candidate as one undoable revision.', schema: applyPreviewInputSchema, method: 'applyLayoutChanges', readOnly: false },
  { name: 'get_simulation_guide', title: 'Get simulation guide', description: 'Read scenarios, editable parameters, staff roles, station capabilities, and simulation result definitions.', schema: emptyInputSchema, method: 'getSimulationGuide', readOnly: true },
  { name: 'preview_simulation_changes', title: 'Preview simulation changes', description: 'Validate scenario parameter changes without modifying the shared project. Required before apply_simulation_changes.', schema: previewSimulationChangesInputSchema, method: 'previewSimulationChanges', readOnly: true },
  { name: 'apply_simulation_changes', title: 'Apply simulation changes', description: 'Apply one previously previewed scenario candidate as one undoable revision and invalidate older runs.', schema: applyPreviewInputSchema, method: 'applySimulationChanges', readOnly: false },
  { name: 'run_simulation', title: 'Run simulation', description: 'Run the current-revision scenario and optionally open its exact animated result in the shared simulation workspace.', schema: runSimulationInputSchema, method: 'runSimulation', readOnly: false },
]

const invoke = (facade: AgentWorkspaceFacade, method: keyof AgentWorkspaceFacade, input: unknown) => {
  switch (method) {
    case 'getWorkspaceGuide': return facade.getWorkspaceGuide(input)
    case 'getLayout': return facade.getLayout(input)
    case 'getComponentCatalog': return facade.getComponentCatalog(input)
    case 'analyzeLayout': return facade.analyzeLayout(input)
    case 'previewLayoutChanges': return facade.previewLayoutChanges(input)
    case 'applyLayoutChanges': return facade.applyLayoutChanges(input)
    case 'getSimulationGuide': return facade.getSimulationGuide(input)
    case 'previewSimulationChanges': return facade.previewSimulationChanges(input)
    case 'applySimulationChanges': return facade.applySimulationChanges(input)
    case 'runSimulation': return facade.runSimulation(input)
  }
}

export function createWebMcpToolDefinitions(facade: AgentWorkspaceFacade, onActivity: (activity: WebMcpActivity) => void): WebMcpToolDefinition[] {
  return definitions.map((definition) => ({
    name: definition.name, title: definition.title, description: definition.description,
    inputSchema: z.toJSONSchema(definition.schema) as Record<string, unknown>,
    annotations: { readOnlyHint: definition.readOnly },
    async execute(input, { signal }) {
      if (signal.aborted) throw signal.reason
      const id = crypto.randomUUID()
      onActivity({ id, tool: definition.name, status: 'running', at: new Date().toISOString(), summary: definition.title })
      try {
        const result = invoke(facade, definition.method, input)
        if (signal.aborted) throw signal.reason
        onActivity({ id, tool: definition.name, status: result.ok ? 'success' : 'error', at: new Date().toISOString(), revision: result.revision, summary: result.ok ? `${definition.title} completed` : `${definition.title}: ${result.code}` })
        return result
      } catch (error) {
        onActivity({ id, tool: definition.name, status: 'error', at: new Date().toISOString(), summary: `${definition.title} failed` })
        throw error
      }
    },
  }))
}
```

- [ ] **Step 4: Run the focused tests and production typecheck**

Run: `npm test -- src/webmcp/tool-definitions.test.ts && npm run build`

Expected: PASS and all generated root schemas have `additionalProperties: false`.

- [ ] **Step 5: Commit tool definitions**

```bash
git add src/webmcp/tool-definitions.ts src/webmcp/tool-definitions.test.ts
git commit -m "feat: define WebMCP site tools"
```

---

### Task 6: Browser Registration Lifecycle and Fallback

**Files:**
- Create: `src/webmcp/model-context.d.ts`
- Create: `src/webmcp/register-webmcp.ts`
- Create: `src/webmcp/register-webmcp.test.ts`

**Interfaces:**
- Consumes: `WebMcpToolDefinition` and the draft `Document.modelContext` imperative API.
- Produces: `WebMcpRegistrationState` and `registerWebMcpTools(document, tools, onState): () => void`.

- [ ] **Step 1: Write failing registration, teardown, and partial-failure tests**

```ts
// src/webmcp/register-webmcp.test.ts
import { describe, expect, it, vi } from 'vitest'
import { registerWebMcpTools } from './register-webmcp'

const tool = (name: string) => ({ name, title: name, description: `${name} description`, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: vi.fn() }) as never

describe('registerWebMcpTools', () => {
  it('reports unsupported without throwing', async () => {
    const onState = vi.fn()
    const dispose = registerWebMcpTools(document, [tool('read_layout')], onState)
    await Promise.resolve()
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ status: 'unavailable', registered: [] }))
    dispose()
  })

  it('registers with abort signals and unregisters all tools on dispose', async () => {
    const signals: AbortSignal[] = []
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: vi.fn(async (_tool, options) => { signals.push(options.signal) }) } })
    const onState = vi.fn()
    const dispose = registerWebMcpTools(document, [tool('one'), tool('two')], onState)
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'available', registered: ['one', 'two'] })))
    dispose()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    delete (document as Document & { modelContext?: unknown }).modelContext
  })

  it('reports partial registration without disabling successful tools', async () => {
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: vi.fn(async (candidate) => { if (candidate.name === 'two') throw new DOMException('Denied', 'NotAllowedError') }) } })
    const onState = vi.fn()
    const dispose = registerWebMcpTools(document, [tool('one'), tool('two')], onState)
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'partial', registered: ['one'], failed: [{ name: 'two', reason: 'NotAllowedError' }] })))
    dispose()
    delete (document as Document & { modelContext?: unknown }).modelContext
  })
})
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `npm test -- src/webmcp/register-webmcp.test.ts`

Expected: FAIL because `register-webmcp.ts` does not exist.

- [ ] **Step 3: Add exact local draft API declarations**

```ts
// src/webmcp/model-context.d.ts
import type { WebMcpToolDefinition } from './tool-definitions'

declare global {
  interface ModelContext {
    registerTool(tool: WebMcpToolDefinition, options?: { signal?: AbortSignal; exposedTo?: string[] }): Promise<void>
  }
  interface Document { readonly modelContext?: ModelContext }
}

export {}
```

- [ ] **Step 4: Implement feature detection and AbortSignal cleanup**

```ts
// src/webmcp/register-webmcp.ts
import type { WebMcpToolDefinition } from './tool-definitions'

export type WebMcpRegistrationState = {
  status: 'registering' | 'available' | 'partial' | 'unavailable'
  registered: string[]
  failed: Array<{ name: string; reason: string }>
}

export function registerWebMcpTools(target: Document, tools: readonly WebMcpToolDefinition[], onState: (state: WebMcpRegistrationState) => void): () => void {
  const modelContext = target.modelContext
  if (typeof modelContext?.registerTool !== 'function') {
    queueMicrotask(() => onState({ status: 'unavailable', registered: [], failed: [] }))
    return () => undefined
  }
  const controller = new AbortController()
  onState({ status: 'registering', registered: [], failed: [] })
  void Promise.all(tools.map(async (tool) => {
    try {
      await modelContext.registerTool(tool, { signal: controller.signal })
      return { ok: true as const, name: tool.name }
    } catch (error) {
      if (controller.signal.aborted) return { ok: false as const, name: tool.name, reason: 'AbortError', ignored: true }
      return { ok: false as const, name: tool.name, reason: error instanceof DOMException ? error.name : 'RegistrationError', ignored: false }
    }
  })).then((results) => {
    if (controller.signal.aborted) return
    const registered = results.filter((result) => result.ok).map((result) => result.name)
    const failed = results.filter((result) => !result.ok && !result.ignored).map((result) => ({ name: result.name, reason: result.reason }))
    onState({ status: failed.length === 0 ? 'available' : registered.length ? 'partial' : 'unavailable', registered, failed })
  })
  return () => controller.abort(new DOMException('WebMCP provider unmounted', 'AbortError'))
}
```

- [ ] **Step 5: Run registration tests twice to exercise cleanup stability**

Run: `npm test -- src/webmcp/register-webmcp.test.ts && npm test -- src/webmcp/register-webmcp.test.ts`

Expected: PASS both times with no unhandled promise rejection.

- [ ] **Step 6: Commit the browser adapter**

```bash
git add src/webmcp/model-context.d.ts src/webmcp/register-webmcp.ts src/webmcp/register-webmcp.test.ts
git commit -m "feat: register WebMCP tools safely"
```

---

### Task 7: Shared Agent-Triggered Simulation Playback

**Files:**
- Modify: `src/features/simulation/useSimulationSession.ts`
- Modify: `src/features/simulation/use-simulation-session.test.tsx`
- Modify: `src/features/simulation/SimulationWorkspace.tsx`
- Modify: `src/features/simulation/simulation-workspace.test.tsx`

**Interfaces:**
- Consumes: `SimulationPresentationRequest` containing the exact already-computed `SimulationResult`.
- Produces: `SimulationSession.loadRun(result, options)`, optional `SimulationWorkspace.launchRequest`, and an App-level `presentSimulation(request)` callback.

- [ ] **Step 1: Write a failing exact-result loading test**

Append to `src/features/simulation/use-simulation-session.test.tsx`:

```ts
it('loads an agent-computed result without running the engine again', () => {
  const project = createSeedProject()
  const run = vi.fn(runSimulation)
  const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
  const external = runSimulation(input)
  const { result } = renderHook(() => useSimulationSession({ input, run }))
  act(() => result.current.loadRun(external, { playing: true, speed: 10 }))
  expect(result.current.result).toBe(external)
  expect(result.current.playing).toBe(true)
  expect(result.current.speed).toBe(10)
  expect(run).not.toHaveBeenCalled()
})
```

Add to `src/features/simulation/simulation-workspace.test.tsx` a render with `launchRequest={{ id: 'agent-run-1', scenarioId: 'dinner-peak', revision: 0, speed: 10, result }}` and assert the live service HUD appears, playback speed is `10`, and `onLaunchConsumed('agent-run-1')` is called once.

- [ ] **Step 2: Run simulation-session and workspace tests and verify missing props/methods**

Run: `npm test -- src/features/simulation/use-simulation-session.test.tsx src/features/simulation/simulation-workspace.test.tsx`

Expected: FAIL because `loadRun` and launch props do not exist.

- [ ] **Step 3: Add exact-result loading to the session hook**

```ts
// src/features/simulation/useSimulationSession.ts
// Add to SimulationSession:
loadRun(result: SimulationResult, options?: { playing?: boolean; speed?: number }): void

// Add to returned object:
loadRun: (nextResult, options = {}) => {
  setResult(nextResult)
  setElapsedSeconds(0)
  setSpeed(options.speed ?? 25)
  setPlaying(options.playing ?? true)
},
```

- [ ] **Step 4: Consume a launch request exactly once in SimulationWorkspace**

Extend props:

```ts
type Props = {
  store?: ProjectStore
  run?: (input: SimulationInput) => SimulationResult
  threeRenderer?: ComponentType<SimulationThreeSceneProps>
  launchRequest?: SimulationPresentationRequest | null
  onLaunchConsumed?(id: string): void
}
```

Keep the launched scenario selected after App clears the one-shot request, then add an effect after the session is created:

```ts
const [presentedScenarioId, setPresentedScenarioId] = useState<string | null>(null)
const scenarioId = launchRequest?.scenarioId ?? presentedScenarioId ?? project.activeScenarioId
const scenario = project.scenarios.find((value) => value.id === scenarioId) ?? project.scenarios[0]
const consumedLaunch = useRef<string | null>(null)
useEffect(() => {
  if (!launchRequest || consumedLaunch.current === launchRequest.id) return
  if (launchRequest.revision !== store.getState().revision) return
  consumedLaunch.current = launchRequest.id
  setPresentedScenarioId(launchRequest.scenarioId)
  session.loadRun(launchRequest.result, { playing: true, speed: launchRequest.speed })
  onLaunchConsumed?.(launchRequest.id)
}, [launchRequest, onLaunchConsumed, session.loadRun, store])
```

Memoize `loadRun` with `useCallback` before placing it in the effect dependency list so rerenders do not retrigger the effect.

- [ ] **Step 5: Run simulation regression tests**

Run: `npm test -- src/features/simulation/use-simulation-session.test.tsx src/features/simulation/simulation-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit shared simulation presentation**

```bash
git add src/features/simulation/useSimulationSession.ts src/features/simulation/use-simulation-session.test.tsx src/features/simulation/SimulationWorkspace.tsx src/features/simulation/simulation-workspace.test.tsx
git commit -m "feat: share agent simulation playback"
```

---

### Task 8: WebMCP Provider and Human Guidance Panel

**Files:**
- Create: `src/webmcp/WebMcpProvider.tsx`
- Create: `src/webmcp/WebMcpProvider.test.tsx`
- Create: `src/webmcp/AgentToolsPanel.tsx`
- Create: `src/webmcp/AgentToolsPanel.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `projectStore`, `createApplicationService`, `createAgentWorkspaceFacade`, `kitchenCapabilityManifest`, `createWebMcpToolDefinitions`, `registerWebMcpTools`, and App's `presentSimulation` callback.
- Produces: `WebMcpProvider`, `useWebMcp()`, and `AgentToolsPanel`.

- [ ] **Step 1: Write failing provider and panel tests**

```tsx
// src/webmcp/WebMcpProvider.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WebMcpProvider, useWebMcp } from './WebMcpProvider'

function Probe() {
  const state = useWebMcp()
  return <div data-testid="status">{state.registration.status}:{state.registration.registered.length}</div>
}

it('registers once per mounted provider and exposes status', async () => {
  const registerTool = vi.fn(async () => undefined)
  Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })
  const { unmount } = render(<WebMcpProvider onPresentSimulation={vi.fn()}><Probe /></WebMcpProvider>)
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('available:10'))
  expect(registerTool).toHaveBeenCalledTimes(10)
  unmount()
  expect(registerTool.mock.calls.every((call) => call[1].signal.aborted)).toBe(true)
  delete (document as Document & { modelContext?: unknown }).modelContext
})
```

```tsx
// src/webmcp/AgentToolsPanel.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentToolsPanel } from './AgentToolsPanel'

it('explains the external-agent workflow and copies a starter prompt', async () => {
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<AgentToolsPanel open onClose={() => undefined} state={{ registration: { status: 'unavailable', registered: [], failed: [] }, activities: [] }} />)
  expect(screen.getByRole('dialog', { name: /AI layout tools/i })).toHaveTextContent(/your AI processes the image/i)
  expect(screen.getByRole('dialog')).toHaveTextContent(/move.*resize.*simulation parameters/i)
  await userEvent.click(screen.getByRole('button', { name: /Copy agent prompt/i }))
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/get_workspace_guide.*preview_layout_changes.*run_simulation/s))
})
```

- [ ] **Step 2: Run focused tests and verify components are missing**

Run: `npm test -- src/webmcp/WebMcpProvider.test.tsx src/webmcp/AgentToolsPanel.test.tsx`

Expected: FAIL with missing-module errors.

- [ ] **Step 3: Implement the provider with stable composition**

```tsx
// src/webmcp/WebMcpProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createAgentWorkspaceFacade, type SimulationPresentationRequest } from '../core/agent-tools/agent-workspace-facade'
import { createApplicationService } from '../core/application/application-service'
import { kitchenCapabilityManifest } from '../domain/kitchen-capability-manifest'
import { runSimulation } from '../simulation/engine'
import { projectStore, type ProjectStore } from '../state/project-store'
import { registerWebMcpTools, type WebMcpRegistrationState } from './register-webmcp'
import { createWebMcpToolDefinitions, type WebMcpActivity } from './tool-definitions'

export type WebMcpUiState = { registration: WebMcpRegistrationState; activities: WebMcpActivity[] }
const initial: WebMcpUiState = { registration: { status: 'registering', registered: [], failed: [] }, activities: [] }
const Context = createContext<WebMcpUiState>(initial)

export function WebMcpProvider({ children, store = projectStore, onPresentSimulation }: { children: ReactNode; store?: ProjectStore; onPresentSimulation(request: SimulationPresentationRequest): void }) {
  const [state, setState] = useState(initial)
  const tools = useMemo(() => {
    const service = createApplicationService({ store, runSimulation })
    const facade = createAgentWorkspaceFacade({ store, service, manifest: kitchenCapabilityManifest, presentSimulation: onPresentSimulation })
    return createWebMcpToolDefinitions(facade, (activity) => setState((current) => ({ ...current, activities: [activity, ...current.activities.filter((entry) => entry.id !== activity.id)].slice(0, 12) })))
  }, [onPresentSimulation, store])
  useEffect(() => registerWebMcpTools(document, tools, (registration) => setState((current) => ({ ...current, registration }))), [tools])
  return <Context.Provider value={state}>{children}</Context.Provider>
}

export const useWebMcp = () => useContext(Context)
```

App must pass a `useCallback`-stable `onPresentSimulation`, so ordinary project edits never recreate definitions or registrations.

- [ ] **Step 4: Implement the accessible guidance panel**

```tsx
// src/webmcp/AgentToolsPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { WEBMCP_TOOL_NAMES } from './tool-definitions'
import type { WebMcpUiState } from './WebMcpProvider'

export const AGENT_STARTER_PROMPT = `Inspect my attached reference image or written instructions. Your AI processes the image; this site does not. Call get_workspace_guide, get_component_catalog, and get_layout before editing. Translate measurements into millimetres, call preview_layout_changes, then apply_layout_changes and analyze_layout. For operational changes, call get_simulation_guide, preview_simulation_changes, apply_simulation_changes, and run_simulation. Ask me about dimensions you cannot infer safely.`

export function AgentToolsPanel({ open, onClose, state }: { open: boolean; onClose(): void; state: WebMcpUiState }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); opener.current?.focus() }
  }, [onClose, open])
  if (!open) return null
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(AGENT_STARTER_PROMPT)
      setCopyStatus('Prompt copied')
    } catch { setCopyStatus('Copy unavailable — select the prompt from the user guide') }
  }
  return <div className="agent-tools-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="agent-tools-panel" role="dialog" aria-modal="true" aria-labelledby="agent-tools-title">
      <header><div><span className="eyebrow">WebMCP site tools</span><h2 id="agent-tools-title">AI layout tools</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Close AI tools">×</button></header>
      <div className={`agent-status ${state.registration.status}`}><strong>{state.registration.status === 'available' ? 'Ready for a compatible AI' : state.registration.status === 'partial' ? 'Some tools available' : state.registration.status === 'registering' ? 'Registering tools' : 'WebMCP unavailable in this browser'}</strong><span>{state.registration.registered.length} of {WEBMCP_TOOL_NAMES.length} tools registered</span></div>
      <p><strong>Your AI processes the image and your instructions.</strong> Manta Raja receives structured dimensions and actions, then provides the live drawing, 3D kitchen, walkthrough, diagnostics, and service simulation.</p>
      <div className="agent-examples"><span>“Move the fryer beside the range.”</span><span>“Resize this counter to 1200 × 700 mm.”</span><span>“Use 64 covers and three CDPs, then run the live simulation.”</span></div>
      <button className="primary-button" type="button" onClick={() => void copy()}>Copy agent prompt</button>
      <span role="status">{copyStatus}</span>
      <details open><summary>Available tools</summary><ul>{WEBMCP_TOOL_NAMES.map((name) => <li key={name}><code>{name}</code><small>{name.startsWith('apply_') ? 'Writes one previewed revision' : 'Reads, previews, or computes'}</small></li>)}</ul></details>
      <details><summary>Recent activity</summary>{state.activities.length ? <ol>{state.activities.map((entry) => <li key={entry.id}><strong>{entry.tool}</strong><span>{entry.summary}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time></li>)}</ol> : <p>No agent calls in this page session.</p>}</details>
      {state.registration.status === 'unavailable' && <p className="agent-help">Use a browser and AI client with WebMCP site-tools support. The normal editor remains fully available.</p>}
    </section>
  </div>
}
```

Extend the panel test with `const onClose = vi.fn()`, rerender the panel with that callback, press `{Escape}`, assert `onClose` was called, and assert the close button receives initial focus. Do not use native `<dialog>` because jsdom and browser support differ.

- [ ] **Step 5: Compose provider and top-bar entry in App**

Split the existing component into a provider-owning `App` and a context-consuming `AppContent` without moving workspace state outside the application:

```tsx
export function App() {
  const [view, setView] = useState<WorkspaceView>('plan')
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [simulationLaunch, setSimulationLaunch] = useState<SimulationPresentationRequest | null>(null)
  const presentSimulation = useCallback((request: SimulationPresentationRequest) => {
    setSimulationLaunch(request)
    setView('simulate')
  }, [])
  return <WebMcpProvider onPresentSimulation={presentSimulation}>
    <AppContent
      view={view} onView={setView}
      agentPanelOpen={agentPanelOpen} onAgentPanel={setAgentPanelOpen}
      simulationLaunch={simulationLaunch}
      onLaunchConsumed={(id) => setSimulationLaunch((current) => current?.id === id ? null : current)}
    />
  </WebMcpProvider>
}

function AppContent({ view, onView, agentPanelOpen, onAgentPanel, simulationLaunch, onLaunchConsumed }: {
  view: WorkspaceView; onView(view: WorkspaceView): void
  agentPanelOpen: boolean; onAgentPanel(open: boolean): void
  simulationLaunch: SimulationPresentationRequest | null; onLaunchConsumed(id: string): void
}) {
  const webMcp = useWebMcp()
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">MR</span>
        <div><h1>Manta Raja Kitchen Lab</h1><p>Metric kitchen planning and service simulation</p></div>
      </div>
      <ProjectExchange />
      <button type="button" className="agent-tools-trigger" aria-expanded={agentPanelOpen} onClick={() => onAgentPanel(true)}>AI tools</button>
      <nav aria-label="Workspace views" className="view-switcher">
        {(Object.keys(VIEW_LABELS) as WorkspaceView[]).map((next) => <button key={next} type="button" aria-pressed={view === next} onClick={() => onView(next)}>{VIEW_LABELS[next]}</button>)}
      </nav>
    </header>
    <ErrorBoundary><Suspense fallback={<section className="workspace-placeholder">Loading workspace…</section>}>
      {view === 'plan' && <PlanWorkspace />}
      {view === 'scene' && <SceneWorkspace />}
      {view === 'split' && <section className="split-workspace"><PlanWorkspace compact /><SceneWorkspace compact /></section>}
      {view === 'simulate' && <SimulationWorkspace launchRequest={simulationLaunch} onLaunchConsumed={onLaunchConsumed} />}
      {view === 'compare' && <CompareWorkspace />}
    </Suspense></ErrorBoundary>
    <AgentToolsPanel open={agentPanelOpen} onClose={() => onAgentPanel(false)} state={webMcp} />
  </main>
}
```

Extend `src/app/App.test.tsx`:

```tsx
it('keeps AI guidance available when WebMCP is unsupported', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'AI tools' }))
  expect(screen.getByRole('dialog', { name: /AI layout tools/i })).toHaveTextContent(/WebMCP unavailable/i)
  expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument()
})
```

- [ ] **Step 6: Add responsive panel styles**

Append this focused block to `src/app/styles.css`:

```css
.agent-tools-trigger { border: 1px solid #bd684f; border-radius: 8px; padding: 8px 11px; color: #8f432f; background: #fff6f1; font-size: 9px; font-weight: 850; }
.agent-tools-backdrop { position: fixed; z-index: 100; inset: 0; display: flex; justify-content: flex-end; background: rgba(27,34,31,.42); backdrop-filter: blur(2px); }
.agent-tools-panel { width: min(440px, 100vw); height: 100%; overflow-y: auto; padding: 20px; color: var(--charcoal); background: var(--paper); box-shadow: -18px 0 44px rgba(25,32,29,.2); }
.agent-tools-panel > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #ddd6cb; padding-bottom: 13px; }
.agent-tools-panel h2 { margin: 3px 0 0; font-size: 20px; }.agent-tools-panel > header button { width: 34px; height: 34px; border: 1px solid #d8d1c5; border-radius: 8px; background: white; font-size: 20px; }
.agent-status { display: grid; gap: 3px; margin: 14px 0; border-left: 4px solid #9d968b; padding: 10px 12px; background: #efebe4; }.agent-status.available { border-color: #4f8276; background: #e8f1ed; }.agent-status.partial { border-color: #c58a28; background: #f8f0dc; }.agent-status.unavailable { border-color: #b64e3b; background: #f8e6df; }.agent-status span { color: #6f6a61; font-size: 9px; }
.agent-tools-panel > p, .agent-tools-panel details { font-size: 10px; line-height: 1.55; }.agent-examples { display: grid; gap: 6px; margin: 13px 0; }.agent-examples span { border: 1px solid #ded7cc; border-radius: 7px; padding: 8px; background: white; font-size: 9px; }
.agent-tools-panel details { margin-top: 14px; border-top: 1px solid #ddd6cb; padding-top: 12px; }.agent-tools-panel summary { font-weight: 850; cursor: pointer; }.agent-tools-panel ul, .agent-tools-panel ol { display: grid; gap: 5px; padding: 0; list-style: none; }.agent-tools-panel li { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; border-radius: 6px; padding: 7px 8px; background: #f3f0e9; }.agent-tools-panel li span { grid-column: 1 / -1; }.agent-tools-panel li small, .agent-tools-panel time { color: #7b756c; font-size: 8px; }.agent-help { border-left: 3px solid #b64e3b; padding-left: 9px; }
@media (max-width: 760px) { .agent-tools-panel { width: 100vw; }.agent-tools-trigger { min-height: 44px; } }
```

Do not modify unrelated workspace selectors.

- [ ] **Step 7: Run provider, panel, App, and scene synchronization tests**

Run: `npm test -- src/webmcp/WebMcpProvider.test.tsx src/webmcp/AgentToolsPanel.test.tsx src/app/App.test.tsx src/features/scene/scene-sync.test.tsx`

Expected: PASS with no duplicate registration warning or renderer remount.

- [ ] **Step 8: Commit the visible WebMCP experience**

```bash
git add src/webmcp/WebMcpProvider.tsx src/webmcp/WebMcpProvider.test.tsx src/webmcp/AgentToolsPanel.tsx src/webmcp/AgentToolsPanel.test.tsx src/app/App.tsx src/app/App.test.tsx src/app/styles.css
git commit -m "feat: add WebMCP guidance experience"
```

---

### Task 9: Browser-Level Site Tool Workflow and Documentation

**Files:**
- Create: `e2e/webmcp.spec.ts`
- Modify: `docs/user-guide.md`

**Interfaces:**
- Consumes: all ten registered WebMCP definitions and the existing Plan, 3D, and Simulate views.
- Produces: authoritative end-to-end evidence for discovery, drawing modification, safety, simulation editing/run, live playback, fallback, and renderer persistence.

- [ ] **Step 1: Add the WebMCP browser shim and failing discovery workflow**

```ts
// e2e/webmcp.spec.ts
import { expect, test } from '@playwright/test'

const installWebMcpShim = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    const tools = new Map<string, { name: string; execute(input: Record<string, unknown>, options: { signal: AbortSignal }): Promise<unknown> }>()
    Object.defineProperty(window, '__webMcpTools', { value: tools })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {
      async registerTool(tool: { name: string; execute(input: Record<string, unknown>, options: { signal: AbortSignal }): Promise<unknown> }, options: { signal: AbortSignal }) {
        tools.set(tool.name, tool)
        options.signal.addEventListener('abort', () => tools.delete(tool.name), { once: true })
      },
    } })
    localStorage.clear()
  })
}

const callTool = async (page: import('@playwright/test').Page, name: string, input: Record<string, unknown>) => page.evaluate(async ({ name, input }) => {
  const tools = (window as unknown as { __webMcpTools: Map<string, { execute(input: Record<string, unknown>, options: { signal: AbortSignal }): Promise<unknown> }> }).__webMcpTools
  return tools.get(name)!.execute(input, { signal: new AbortController().signal })
}, { name, input })

test('discovers tools and applies follow-up drawing instructions without resetting 3D', async ({ page }) => {
  await installWebMcpShim(page)
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __webMcpTools: Map<string, unknown> }).__webMcpTools.size)).toBe(10)
  const guide = await callTool(page, 'get_workspace_guide', {}) as { ok: boolean; revision: number }
  expect(guide).toMatchObject({ ok: true, revision: 0 })
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await page.evaluate(() => { (window as unknown as { __sceneCanvas: Element | null }).__sceneCanvas = document.querySelector('[data-testid="kitchen-scene"] canvas') })
  const preview = await callTool(page, 'preview_layout_changes', { expectedRevision: 0, operations: [{ op: 'move_components', ids: ['tandoor'], anchor: { xMm: 2200, yMm: 900 } }] }) as { ok: true; data: { previewToken: string } }
  expect(preview.ok).toBe(true)
  const applied = await callTool(page, 'apply_layout_changes', { previewToken: preview.data.previewToken }) as { ok: boolean; revision: number }
  expect(applied).toMatchObject({ ok: true, revision: 1 })
  await expect(page.getByRole('button', { name: /Select Tandoor in 3D/i })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __sceneCanvas: Element | null }).__sceneCanvas === document.querySelector('[data-testid="kitchen-scene"] canvas'))).toBe(true)
  await page.getByRole('button', { name: 'Walk kitchen' }).click()
  await expect(page.getByRole('button', { name: 'Walk kitchen' })).toHaveAttribute('aria-pressed', 'true')
  const followUp = await callTool(page, 'preview_layout_changes', { expectedRevision: 1, operations: [{ op: 'rotate_components', ids: ['tandoor'], deltaDeg: 90 }, { op: 'set_dimensions_locked', id: 'tandoor', locked: false }, { op: 'resize_component', id: 'tandoor', dimensions: { widthMm: 800, depthMm: 700 } }] }) as { ok: true; data: { previewToken: string } }
  await callTool(page, 'apply_layout_changes', { previewToken: followUp.data.previewToken })
  await expect(page.getByRole('button', { name: 'Walk kitchen' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => (window as unknown as { __sceneCanvas: Element | null }).__sceneCanvas === document.querySelector('[data-testid="kitchen-scene"] canvas'))).toBe(true)
  const item = await callTool(page, 'get_layout', { view: 'components', ids: ['tandoor'] }) as { data: { components: Array<{ rotationDeg: number; widthMm: number }> } }
  expect(item.data.components[0]).toMatchObject({ rotationDeg: 90, widthMm: 800 })
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: /Select Tandoor/i }).click()
  await expect(page.getByLabel(/^X position \(mm\)$/i)).toHaveValue('2200')
  await expect(page.getByLabel(/^Width \(mm\)$/i)).toHaveValue('800')
})
```

- [ ] **Step 2: Run the browser test and verify it fails before integration is complete**

Run: `npx playwright test e2e/webmcp.spec.ts --project=chromium`

Expected before Tasks 1–8: FAIL because no tools are registered. After Tasks 1–8: the drawing test passes.

- [ ] **Step 3: Add stale-token and simulation workflow tests**

```ts
test('rejects stale/replayed previews and opens the configured live simulation', async ({ page }) => {
  await installWebMcpShim(page)
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __webMcpTools: Map<string, unknown> }).__webMcpTools.size)).toBe(10)
  const scenarioPreview = await callTool(page, 'preview_simulation_changes', {
    scenarioId: 'dinner-peak', expectedRevision: 0,
    patch: { covers: 64, staff: [{ role: 'head-chef', count: 1 }, { role: 'sous-chef', count: 1 }, { role: 'cdp', count: 3 }, { role: 'busser-washer', count: 1 }] },
  }) as { ok: true; data: { previewToken: string } }
  expect(await callTool(page, 'apply_simulation_changes', { previewToken: scenarioPreview.data.previewToken })).toMatchObject({ ok: true, revision: 1 })
  expect(await callTool(page, 'apply_simulation_changes', { previewToken: scenarioPreview.data.previewToken })).toMatchObject({ ok: false, code: 'invalid-preview-token' })
  expect(await callTool(page, 'preview_layout_changes', { expectedRevision: 0, operations: [{ op: 'move_components', ids: ['tandoor'], anchor: { xMm: 2200, yMm: 900 } }] })).toMatchObject({ ok: false, code: 'stale-revision', revision: 1 })
  const result = await callTool(page, 'run_simulation', { scenarioId: 'dinner-peak', expectedRevision: 1, presentation: 'open-live-simulation', playbackSpeed: 10 }) as { ok: boolean; data: { assumptions: { covers: number }; metrics: { totalOrders: number } } }
  expect(result.ok).toBe(true)
  expect(result.data.assumptions.covers).toBe(64)
  await expect(page.getByLabel(/Live service status/i)).toBeVisible()
  await expect(page.getByLabel(/Simulation time/i)).toBeVisible()
  await expect(page.getByText(/64 covers over 60 minutes/i)).toBeVisible()
})

test('retains the complete human editor when WebMCP is absent', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: 'AI tools' }).click()
  await expect(page.getByRole('dialog', { name: /AI layout tools/i })).toContainText(/WebMCP unavailable/i)
  await page.getByRole('button', { name: /Close AI tools/i }).click()
  await expect(page.getByRole('button', { name: /Select Tandoor/i })).toBeVisible()
})
```

- [ ] **Step 4: Document the user and agent workflow**

Add this section to `docs/user-guide.md`:

```md
## AI-assisted layouts with WebMCP

Open **AI tools** to check availability and copy a starter prompt. Attach reference images to your chosen compatible AI, not to Manta Raja. Your AI interprets the image and your instructions; this application receives only structured measurements and operations and supplies the live plan, 3D kitchen, walkthrough, diagnostics, and simulation.

The recommended sequence is `get_workspace_guide` → `get_component_catalog` and `get_layout` → `preview_layout_changes` → `apply_layout_changes` → `analyze_layout`. The agent can then handle follow-up requests such as moving, resizing, rotating, adding, or removing exact components without rebuilding unrelated drawing state.

For service assumptions, use `get_simulation_guide` → `preview_simulation_changes` → `apply_simulation_changes` → `run_simulation`. Editable values include covers, duration, arrival pattern, cooked-to-order ratio, seed, staff, checks, task durations, and station capacities. `results-only` returns a report; `open-live-simulation` opens the same animated chef simulation seen by a person.

Every write is previewed, revision checked, and saved as one undo step. If another person changes the project first, the agent must reread the layout after a `stale-revision` response. Preview tokens are single-use and expire after ten minutes.

The ten tools are `get_workspace_guide`, `get_layout`, `get_component_catalog`, `analyze_layout`, `preview_layout_changes`, `apply_layout_changes`, `get_simulation_guide`, `preview_simulation_changes`, `apply_simulation_changes`, and `run_simulation`.

When site tools are unavailable, the human editor remains fully functional. For local Chrome development, enable `chrome://flags/#enable-webmcp-testing`; this is a development flag, not a production requirement. The app uses top-level imperative JavaScript tools because the current ChatGPT built-in browser does not discover declarative or iframe tools.
```

- [ ] **Step 5: Run the full verification gate**

Run: `npm test`

Expected: every Vitest file passes, including all new contract, facade, lifecycle, provider, panel, simulation, and regression tests.

Run: `npm run lint`

Expected: ESLint exits 0 with no ignored type or hook errors.

Run: `npm run build`

Expected: `tsc -b` and Vite production build exit 0.

Run: `npm run e2e`

Expected: all existing kitchen tests and all new WebMCP browser tests pass in Chromium, with no uncaught registration, WebGL, or promise errors.

- [ ] **Step 6: Perform the acceptance audit against the approved spec**

Inspect the ten acceptance criteria in `docs/superpowers/specs/2026-09-01-webmcp-spatial-agent-tools-design.md`. For each criterion, record the implementing file and authoritative unit/browser test in the implementation session notes. Specifically verify that no dependency, route, source file, tool input, or browser request introduces image ingestion, a model call, an API key, or a network MCP server.

Run: `rg -n "openai|anthropic|gemini|api[_-]?key|base64|imageData|uploadUrl|mcp/server|EventSource|WebSocket" src package.json`

Expected: no newly introduced inference, credential, image-payload, or MCP-server code; existing incidental strings must be manually explained.

- [ ] **Step 7: Commit browser coverage and documentation**

```bash
git add e2e/webmcp.spec.ts docs/user-guide.md
git commit -m "test: verify WebMCP spatial workflows"
```

---

## Implementation Completion Gate

The work is complete only when all of the following are simultaneously true:

- The top-level page registers exactly ten site tools through the imperative WebMCP API.
- A real handler sequence can read, preview, apply, and verify an initial drawing and a follow-up drawing change.
- Layout and simulation previews are side-effect free; applies are single-use, stale-safe, atomic, and one-step undoable.
- The agent can update every supported scenario field and run the revised scenario.
- `open-live-simulation` displays the exact computed result in the existing animated worker simulation without a duplicate engine run.
- Tool-driven component edits preserve the existing Three.js canvas identity and camera session.
- The AI tools panel clearly assigns image/language interpretation to the external agent and rendering/simulation to the app.
- Unsupported browsers retain every human editing, 3D, walk, simulation, comparison, import, and export capability.
- The adapter imports no React, Zustand, Konva, React Three Fiber, or Three.js modules; those dependencies remain behind injected application interfaces.
- Unit tests, lint, production build, and the complete Playwright suite all pass from the final committed tree.

## Primary References

- OpenAI Site Tools documentation: `https://learn.chatgpt.com/docs/webmcp`
- WebMCP draft imperative API: `https://webmachinelearning.github.io/webmcp/`
- Chrome WebMCP developer guide: `https://developer.chrome.com/docs/ai/webmcp`
