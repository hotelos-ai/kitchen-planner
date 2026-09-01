# Tool-Ready Spatial Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a domain-neutral, JSON-safe command and query core that the current kitchen UI and a future WebMCP adapter can use without duplicating mutation logic.

**Architecture:** Generic spatial types live under `src/core/spatial`; kitchen types specialize them without changing persisted schema version 1. A pure application service validates commands, checks document revisions, supports dry runs, and returns structured results. Zustand preserves its existing ergonomic actions, but those actions delegate to the same command executor that future tools will call.

**Tech Stack:** TypeScript 6, Zod 4, Zustand 5, Vitest 4, existing React 19 application.

## Global Constraints

- Keep persisted `schemaVersion: 1` and preserve import/export compatibility.
- Store all canonical dimensions in millimetres.
- Commands and queries accept and return JSON-safe values only.
- Core modules must not import React, DOM, Konva, Three.js, or browser globals.
- Every mutation reports a revision, changed IDs, stable error codes, and warnings.
- Dry runs must never mutate the document or increment the revision.
- Existing UI store methods remain available while delegating to the command service.
- Kitchen-specific categories and capabilities remain in the kitchen domain module.

---

## File Structure

- `src/core/spatial/types.ts`: generic spatial primitives, placed items, architectures, projects, and envelopes.
- `src/core/commands/layout-command.ts`: command schemas and inferred command types.
- `src/core/commands/execute-layout-command.ts`: pure command executor and structured results.
- `src/core/queries/layout-query.ts`: JSON-safe read-only query schemas and executor.
- `src/core/index.ts`: public core exports for UI and future adapters.
- `src/domain/project.ts`: kitchen specialization of generic spatial types.
- `src/domain/spatial-adapter.ts`: maps schema-v1 `equipment` collections to the core's domain-neutral `items` contract.
- `src/state/project-store.ts`: Zustand adapter delegating mutations to the command executor.

### Task 1: Extract Generic Spatial Types

**Files:**
- Create: `src/core/spatial/types.ts`
- Create: `src/domain/spatial-adapter.ts`
- Modify: `src/domain/project.ts`
- Test: `src/core/spatial/types.test.ts`

**Interfaces:**
- Produces: `SpatialItem`, `SpatialArchitecture`, `SpatialVariant<TItem>`, `SpatialProject<TItem, TScenario>`, and `ProjectEnvelope<TProject>`.
- Preserves: `EquipmentItem`, `Architecture`, `LayoutVariant`, and `KitchenProject` public names.

- [ ] **Step 1: Write the failing type/runtime test**

```ts
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import type { EquipmentItem, KitchenProject } from '../../domain/project'
import type { ProjectEnvelope, SpatialItem, SpatialProject } from './types'

describe('generic spatial types', () => {
  it('accepts the kitchen document without changing its serialized shape', () => {
    const project = createSeedProject()
    const envelope: ProjectEnvelope<KitchenProject> = { revision: 0, project }
    const spatial: SpatialProject<EquipmentItem, KitchenProject['scenarios'][number]> = kitchenSpatialAdapter.read(project)
    expect(spatial.variants[0].items.some((item) => item.id === 'tandoor')).toBe(true)
    expect(envelope.revision).toBe(0)
    expect(JSON.parse(JSON.stringify(project))).toEqual(project)
    expectTypeOf<EquipmentItem>().toMatchTypeOf<SpatialItem>()
  })
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npm test -- src/core/spatial/types.test.ts`

Expected: FAIL because `src/core/spatial/types.ts` does not exist.

- [ ] **Step 3: Add the generic types and specialize them from the kitchen domain**

Create `src/core/spatial/types.ts` with these public contracts:

```ts
export type Millimetres = number
export type DisplayUnit = 'mm' | 'cm' | 'in' | 'ft'
export type PointMm = { x: Millimetres; y: Millimetres }

export interface SpatialRect {
  id: string
  xMm: Millimetres
  yMm: Millimetres
  widthMm: Millimetres
  depthMm: Millimetres
}

export interface SpatialItem extends SpatialRect {
  label: string
  heightMm: Millimetres
  rotationDeg: number
  dimensionsLocked: boolean
  movable: boolean
  removable: boolean
  visualPreset?: string
  tags?: readonly string[]
}

export interface SpatialOpening {
  id: string
  label: string
  kind: string
  wall: 'top' | 'right' | 'bottom' | 'left'
  offsetMm: Millimetres
  widthMm: Millimetres
  sillHeightMm?: Millimetres
  heightMm?: Millimetres
  flow?: string
  swingDepthMm?: Millimetres
}

export interface SpatialZone extends SpatialRect {
  label: string
}

export interface SpatialArchitecture<TOpening extends SpatialOpening = SpatialOpening, TZone extends SpatialZone = SpatialZone> {
  widthMm: Millimetres
  depthMm: Millimetres
  wallHeightMm: Millimetres
  roomPolygon: PointMm[]
  openings: TOpening[]
  pillars: SpatialRect[]
  storageZones: TZone[]
  locked: boolean
}

export interface SpatialVariant<TItem extends SpatialItem> {
  id: string
  name: string
  parentId?: string
  items: TItem[]
  createdAt: string
  updatedAt: string
}

export interface SpatialProject<TItem extends SpatialItem, TScenario, TArchitecture extends SpatialArchitecture = SpatialArchitecture> {
  schemaVersion: number
  id: string
  name: string
  displayUnit: DisplayUnit
  snapMm: Millimetres
  architecture: TArchitecture
  variants: SpatialVariant<TItem>[]
  scenarios: TScenario[]
  activeVariantId: string
  activeScenarioId: string
}

export interface ProjectEnvelope<TProject> {
  revision: number
  project: TProject
}

export interface SpatialDocumentAdapter<TProject, TItem extends SpatialItem, TScenario> {
  read(project: TProject): SpatialProject<TItem, TScenario>
  write(spatial: SpatialProject<TItem, TScenario>, source: TProject): TProject
  validateItem(value: unknown): { success: true; data: TItem } | { success: false; issues: unknown }
}
```

Update `src/domain/project.ts` to import and re-export `DisplayUnit`, `Millimetres`, `PointMm`, and to define kitchen interfaces as extensions of these primitives. Implement `kitchenSpatialAdapter` so `read` maps each schema-v1 `variant.equipment` array to `variant.items`, `write` maps it back, and `validateItem` uses `equipmentSchema`. Keep all existing serialized property names unchanged.

- [ ] **Step 4: Run core and schema compatibility tests**

Run: `npm test -- src/core/spatial/types.test.ts src/domain/project-schema.test.ts src/domain/seed-project.test.ts`

Expected: all tests PASS with no snapshot or schema changes.

- [ ] **Step 5: Commit the generic type boundary**

```bash
git add src/core/spatial/types.ts src/core/spatial/types.test.ts src/domain/project.ts src/domain/spatial-adapter.ts
git commit -m "refactor: extract generic spatial types"
```

### Task 2: Define Validated Layout Commands

**Files:**
- Create: `src/core/commands/layout-command.ts`
- Create: `src/core/commands/layout-command.test.ts`

**Interfaces:**
- Consumes: domain-neutral points, identifiers, and JSON object payloads.
- Produces: `layoutCommandSchema` and `LayoutCommand`; domain adapters validate item payloads later.

- [ ] **Step 1: Write failing schema tests for safe commands**

```ts
import { describe, expect, it } from 'vitest'
import { layoutCommandSchema } from './layout-command'

describe('layout command schema', () => {
  it('accepts exact serializable commands and rejects arbitrary property paths', () => {
    expect(layoutCommandSchema.parse({ type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 } })).toEqual({
      type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 },
    })
    expect(() => layoutCommandSchema.parse({ type: 'set-property', path: '__proto__.admin', value: true })).toThrow()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/core/commands/layout-command.test.ts`

Expected: FAIL because `layoutCommandSchema` does not exist.

- [ ] **Step 3: Export reusable item schemas and create the discriminated union**

Export `equipmentSchema` from `src/domain/project-schema.ts`. Create `src/core/commands/layout-command.ts`:

```ts
import { z } from 'zod'
const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const idsSchema = z.array(z.string().min(1)).min(1)
const jsonObjectSchema = z.record(z.string(), z.unknown())

export const layoutCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move-items'), ids: idsSchema, anchor: pointSchema }).strict(),
  z.object({ type: z.literal('nudge-items'), ids: idsSchema, delta: pointSchema }).strict(),
  z.object({ type: z.literal('rotate-items'), ids: idsSchema, deltaDeg: z.number().finite() }).strict(),
  z.object({ type: z.literal('resize-item'), id: z.string().min(1), widthMm: z.number().positive(), depthMm: z.number().positive() }).strict(),
  z.object({ type: z.literal('update-item'), id: z.string().min(1), patch: jsonObjectSchema }).strict(),
  z.object({ type: z.literal('add-item'), item: jsonObjectSchema }).strict(),
  z.object({ type: z.literal('duplicate-item'), id: z.string().min(1), duplicateId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('remove-items'), ids: idsSchema }).strict(),
  z.object({ type: z.literal('set-display-unit'), unit: z.enum(['mm', 'cm', 'in', 'ft']) }).strict(),
  z.object({ type: z.literal('set-snap'), intervalMm: z.number().positive().finite() }).strict(),
  z.object({ type: z.literal('set-architecture-lock'), locked: z.boolean() }).strict(),
  z.object({ type: z.literal('create-variant'), id: z.string().min(1), name: z.string().min(1), now: z.string().datetime() }).strict(),
  z.object({ type: z.literal('activate-variant'), id: z.string().min(1) }).strict(),
  z.object({ type: z.literal('rename-variant'), id: z.string().min(1), name: z.string().min(1) }).strict(),
  z.object({ type: z.literal('remove-variant'), id: z.string().min(1) }).strict(),
])

export type LayoutCommand = z.infer<typeof layoutCommandSchema>
```

- [ ] **Step 4: Run the command and project-schema tests**

Run: `npm test -- src/core/commands/layout-command.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit command schemas**

```bash
git add src/core/commands/layout-command.ts src/core/commands/layout-command.test.ts
git commit -m "feat: define validated layout commands"
```

### Task 3: Implement the Pure Revisioned Command Executor

**Files:**
- Create: `src/core/commands/execute-layout-command.ts`
- Test: `src/core/commands/execute-layout-command.test.ts`

**Interfaces:**
- Consumes: `LayoutCommand`, `ProjectEnvelope<TProject>`, and `SpatialDocumentAdapter<TProject, TItem, TScenario>`.
- Produces: generic `executeLayoutCommand(input): CommandResult<TProject>`.

- [ ] **Step 1: Write failing behavior tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import { executeLayoutCommand } from './execute-layout-command'

describe('executeLayoutCommand', () => {
  it('returns a new revision and changed IDs without mutating input', () => {
    const project = createSeedProject()
    const result = executeLayoutCommand({
      envelope: { project, revision: 7 },
      adapter: kitchenSpatialAdapter,
      expectedRevision: 7,
      command: { type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 } },
    })
    expect(result).toMatchObject({ ok: true, revision: 8, changedIds: ['tandoor'] })
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')?.xMm).toBe(2400)
    if (result.ok) expect(result.project.variants[0].equipment.find((item) => item.id === 'tandoor')?.xMm).toBe(2300)
  })

  it('supports dry run and stale revision errors', () => {
    const envelope = { project: createSeedProject(), revision: 2 }
    const dry = executeLayoutCommand({ envelope, adapter: kitchenSpatialAdapter, dryRun: true, command: { type: 'remove-items', ids: ['tandoor'] } })
    expect(dry).toMatchObject({ ok: true, revision: 2, dryRun: true, changedIds: ['tandoor'] })
    expect(executeLayoutCommand({ envelope, adapter: kitchenSpatialAdapter, expectedRevision: 1, command: { type: 'remove-items', ids: ['tandoor'] } })).toMatchObject({
      ok: false, code: 'stale-revision', revision: 2,
    })
  })
})
```

- [ ] **Step 2: Run the executor test and verify it fails**

Run: `npm test -- src/core/commands/execute-layout-command.test.ts`

Expected: FAIL because the executor is missing.

- [ ] **Step 3: Implement parsing, revision checks, immutable mutation, and structured failures**

Use these exact public result contracts:

```ts
export type CommandErrorCode = 'invalid-command' | 'stale-revision' | 'missing-item' | 'locked-item' | 'missing-variant' | 'last-variant'

export type CommandResult<TProject> =
  | { ok: true; project: TProject; revision: number; changedIds: string[]; warnings: string[]; dryRun: boolean }
  | { ok: false; code: CommandErrorCode; message: string; revision: number; issues?: unknown }

export function executeLayoutCommand<TProject, TItem extends SpatialItem, TScenario>(input: {
  envelope: ProjectEnvelope<TProject>
  adapter: SpatialDocumentAdapter<TProject, TItem, TScenario>
  command: unknown
  expectedRevision?: number
  dryRun?: boolean
}): CommandResult<TProject>
```

Parse with `layoutCommandSchema.safeParse`, project through `adapter.read`, clone only before mutation, use domain-neutral snap/rotation helpers, validate add/update payloads through `adapter.validateItem`, preserve `id`, `movable`, `removable`, and `dimensionsLocked` rules, then map through `adapter.write`. Return the input project/revision for successful dry runs.

- [ ] **Step 4: Run executor, geometry, and schema tests**

Run: `npm test -- src/core/commands/execute-layout-command.test.ts src/domain/geometry.test.ts src/domain/project-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the executor**

```bash
git add src/core/commands/execute-layout-command.ts src/core/commands/execute-layout-command.test.ts
git commit -m "feat: execute revisioned layout commands"
```

### Task 4: Add the JSON-Safe Query Service

**Files:**
- Create: `src/core/queries/layout-query.ts`
- Test: `src/core/queries/layout-query.test.ts`

**Interfaces:**
- Produces: `layoutQuerySchema`, `LayoutQuery`, and `executeLayoutQuery(envelope, adapter, query)`.
- Consumes: public geometry and diagnostic functions.

- [ ] **Step 1: Write failing query tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import { executeLayoutQuery } from './layout-query'

describe('executeLayoutQuery', () => {
  const envelope = { project: createSeedProject(), revision: 4 }

  it('returns concise JSON-safe item and capability data', () => {
    const result = executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'list-items', category: 'cooking' })
    expect(result).toMatchObject({ ok: true, revision: 4 })
    expect(JSON.stringify(result)).toContain('tandoor')
  })

  it('describes the supported command surface', () => {
    const result = executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'capabilities' })
    expect(result).toMatchObject({ ok: true, revision: 4 })
    expect(JSON.stringify(result)).toContain('move-items')
  })
})
```

- [ ] **Step 2: Run the query test and verify it fails**

Run: `npm test -- src/core/queries/layout-query.test.ts`

Expected: FAIL because the query service does not exist.

- [ ] **Step 3: Implement the discriminated query schema and executor**

Support these exact query inputs:

```ts
export type LayoutQuery =
  | { type: 'project-snapshot' }
  | { type: 'active-layout' }
  | { type: 'list-items'; category?: string; tag?: string }
  | { type: 'item'; id: string }
  | { type: 'architecture' }
  | { type: 'diagnostics' }
  | { type: 'capabilities' }
```

Read the domain-neutral view through `SpatialDocumentAdapter`. Return `{ ok: true, revision, data }` or `{ ok: false, revision, code: 'invalid-query' | 'missing-item', message }`. Clone returned document fragments so callers cannot mutate store state.

- [ ] **Step 4: Run query and diagnostic tests**

Run: `npm test -- src/core/queries/layout-query.test.ts src/domain/layout-diagnostics.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the query surface**

```bash
git add src/core/queries/layout-query.ts src/core/queries/layout-query.test.ts
git commit -m "feat: add spatial layout queries"
```

### Task 5: Adapt Zustand to the Shared Command Service

**Files:**
- Modify: `src/state/project-store.ts`
- Modify: `src/state/project-store.test.ts`
- Create: `src/core/index.ts`

**Interfaces:**
- Adds to `ProjectState`: `revision: number` and `executeCommand(command: unknown, options?: { dryRun?: boolean; expectedRevision?: number }): CommandResult<KitchenProject>`.
- Preserves all existing store action signatures.

- [ ] **Step 1: Add failing parity and dry-run tests**

```ts
it('routes UI actions and direct commands through identical semantics', () => {
  const uiStore = createProjectStore(createSeedProject())
  const toolStore = createProjectStore(createSeedProject())
  uiStore.getState().moveItems(['tandoor'], { x: 2300, y: 900 })
  const result = toolStore.getState().executeCommand({ type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 } })
  expect(result.ok).toBe(true)
  expect(toolStore.getState().project).toEqual(uiStore.getState().project)
  expect(toolStore.getState().revision).toBe(1)
})

it('does not change state for a dry run', () => {
  const store = createProjectStore(createSeedProject())
  const before = store.getState().project
  const result = store.getState().executeCommand({ type: 'remove-items', ids: ['tandoor'] }, { dryRun: true })
  expect(result).toMatchObject({ ok: true, dryRun: true, revision: 0 })
  expect(store.getState().project).toBe(before)
})
```

- [ ] **Step 2: Run store tests and verify the new API fails**

Run: `npm test -- src/state/project-store.test.ts`

Expected: FAIL because `revision` and `executeCommand` are missing.

- [ ] **Step 3: Implement the store adapter**

Add a private `dispatch(command, options)` that calls `executeLayoutCommand`, commits successful non-dry results with one history entry, updates `revision`, and returns the result. Replace the bodies of move, nudge, rotate, resize, update, remove, settings, and variant actions with command construction plus `dispatch`. Generate IDs and timestamps in the adapter before dispatching so the executor stays deterministic.

Selection-only actions remain local UI state. `replaceProject` resets `revision` to `0`; undo and redo increment revision because they change the active document.

Export public core contracts from `src/core/index.ts`:

```ts
export * from './spatial/types'
export * from './commands/layout-command'
export * from './commands/execute-layout-command'
export * from './queries/layout-query'
```

- [ ] **Step 4: Run all state, editor, import/export, and schema tests**

Run: `npm test -- src/state src/features/editor src/app/project-exchange.test.tsx src/domain/project-schema.test.ts`

Expected: PASS with existing UI behavior unchanged.

- [ ] **Step 5: Run lint and build**

Run: `npm run lint && npm run build`

Expected: both commands exit 0.

- [ ] **Step 6: Commit the shared application-service adapter**

```bash
git add src/core/index.ts src/state/project-store.ts src/state/project-store.test.ts
git commit -m "refactor: route layout edits through command service"
```

### Task 6: Publish a Tool-Ready Application Service

**Files:**
- Create: `src/core/application/application-service.ts`
- Create: `src/core/application/application-service.test.ts`
- Create: `src/core/application/types.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Produces: `createApplicationService({ store, runSimulation }): ApplicationService`.
- `ApplicationService` exposes `executeLayout`, `replaceProject`, `updateScenario`, `queryLayout`, and `runScenario` with JSON-safe inputs/results.

- [ ] **Step 1: Write failing UI/tool parity and simulation tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { createProjectStore } from '../../state/project-store'
import { createApplicationService } from './application-service'

describe('ApplicationService', () => {
  it('validates project replacement and exposes deterministic scenario runs', () => {
    const project = createSeedProject()
    const service = createApplicationService({ store: createProjectStore(project), runSimulation })
    expect(service.replaceProject({ project, expectedRevision: 0, dryRun: true })).toMatchObject({ ok: true, revision: 0, dryRun: true })
    const result = service.runScenario({ scenarioId: 'dinner-peak', expectedRevision: 0 })
    expect(result).toMatchObject({ ok: true, revision: 0 })
    if (result.ok) expect(result.data.metrics.totalOrders).toBeGreaterThan(0)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/core/application/application-service.test.ts`

Expected: FAIL because the application service is missing.

- [ ] **Step 3: Define exact JSON-safe service contracts**

Create `types.ts` with:

```ts
export type ServiceResult<T> =
  | { ok: true; revision: number; data: T; warnings: string[]; dryRun: boolean }
  | { ok: false; revision: number; code: string; message: string; issues?: unknown }

export interface ApplicationService {
  executeLayout(input: { command: unknown; expectedRevision?: number; dryRun?: boolean }): CommandResult<KitchenProject>
  replaceProject(input: { project: unknown; expectedRevision?: number; dryRun?: boolean }): ServiceResult<{ projectId: string }>
  updateScenario(input: { scenarioId: string; patch: unknown; expectedRevision?: number; dryRun?: boolean }): ServiceResult<{ scenarioId: string }>
  queryLayout(query: unknown): ReturnType<typeof executeLayoutQuery>
  runScenario(input: { scenarioId: string; expectedRevision?: number }): ServiceResult<SimulationResult>
}
```

- [ ] **Step 4: Implement the adapter without protocol dependencies**

Validate replacement projects with `projectSchema`; validate scenario patches with an exported partial `scenarioSchema`; reject stale revisions before work; delegate layout changes to `store.executeCommand`; call the injected deterministic simulator for `runScenario`. Do not import WebMCP, network, browser, or React modules.

Use this constructor signature:

```ts
export function createApplicationService(input: {
  store: ProjectStore
  runSimulation: (input: SimulationInput) => SimulationResult
}): ApplicationService
```

- [ ] **Step 5: Run application, state, simulation, and serialization tests**

Run: `npm test -- src/core/application src/state src/simulation src/domain/project-schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Export and commit the public service boundary**

Add these exports to `src/core/index.ts`:

```ts
export * from './application/types'
export * from './application/application-service'
```

Run: `npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

```bash
git add src/core src/domain/project-schema.ts
git commit -m "feat: expose tool-ready application service"
```
