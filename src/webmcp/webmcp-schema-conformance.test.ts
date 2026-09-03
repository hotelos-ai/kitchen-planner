import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import { createSimulationRunStore } from '../state/simulation-run-store'
import { WEBMCP_ERROR_TAXONOMY } from './error-taxonomy'
import type { WebMcpToolDefinition } from './model-context'
import { createWebMcpTools } from './webmcp-tools'

type SchemaNode = Record<string, unknown>
type Envelope = { ok: boolean; revision: number; code?: string } & Record<string, unknown>

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const runStore = createSimulationRunStore()
  const tools = createWebMcpTools({ store, getFacade: () => getWorkspaceFacade(store), runStore })
  const byName = (name: string): WebMcpToolDefinition => {
    const tool = tools.find((candidate) => candidate.name === name)
    if (!tool) throw new Error(`Missing tool ${name}`)
    return tool
  }
  const call = async (name: string, input: unknown): Promise<Envelope> =>
    Promise.resolve(byName(name).execute(input)) as Promise<Envelope>
  return { store, tools, call }
}

const expectedTopLevelRequired: Record<string, readonly string[]> = {
  get_workspace_guide: [],
  get_component_catalog: [],
  get_layout: [],
  analyze_layout: [],
  suggest_component_placement: ['catalogId'],
  get_simulation_guide: [],
  get_app_state: [],
  set_app_view: [],
  select_components: [],
  focus_camera: ['target'],
  check_operational_essentials: [],
  preview_layout_changes: ['expectedRevision', 'operations'],
  apply_layout_changes: [],
  step_workspace_history: ['direction'],
  run_simulation: [],
  get_simulation_result: [],
  export_project: [],
  import_project: ['projectJson', 'expectedRevision'],
  manage_checkpoints: ['action'],
  share_results: [],
  compare_layouts: ['baselineVariantId', 'candidateVariantId'],
  run_auto_layout: [],
  get_auto_layout_run: ['runId'],
  cancel_auto_layout_run: ['runId'],
  adopt_auto_layout_candidate: ['runId', 'resultId', 'expectedRevision', 'newVariantId', 'name'],
  edit_architecture: ['expectedRevision', 'operations'],
}

const expectedStableErrorCodes = [
  'aborted', 'auto-layout-active', 'auto-layout-failed', 'auto-layout-not-configured',
  'baseline-mismatch', 'batch-operation-failed', 'cancelled', 'checkpoint-failed', 'comparison-failed',
  'download-unavailable', 'duplicate-id', 'empty-batch', 'expired-preview-token',
  'export-failed', 'idempotency-conflict', 'import-failed', 'internal-error',
  'invalid-baseline', 'invalid-candidate', 'invalid-input', 'invalid-manifest', 'invalid-operation', 'invalid-preview-token',
  'invalid-project', 'invalid-room-geometry', 'invalid-scenarios', 'last-variant', 'locked-architecture',
  'locked-architecture-element', 'locked-component', 'missing-architecture-element',
  'missing-checkpoint', 'missing-component', 'missing-scenario', 'missing-simulation-result',
  'missing-variant', 'preview-document-mismatch', 'preview-kind-mismatch',
  'preview-revision-changed', 'result-consumed', 'result-not-finalist',
  'result-not-serializable', 'result-too-large', 'room-polygon-required', 'run-not-active',
  'run-not-complete', 'run-not-found', 'same-variant', 'share-failed', 'simulation-failed',
  'simulation-not-configured', 'stale-document', 'stale-revision', 'unknown-catalog-entry', 'unknown-component',
  'unsupported-operation', 'used-preview-token', 'worker-error', 'wrong-document', 'wrong-run-revision',
] as const

const visitSchema = (value: unknown, path: string, visit: (schema: SchemaNode, path: string) => void): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return
  const schema = value as SchemaNode
  visit(schema, path)
  for (const [key, child] of Object.entries(schema)) {
    if (Array.isArray(child)) child.forEach((entry, index) => visitSchema(entry, `${path}.${key}[${index}]`, visit))
    else visitSchema(child, `${path}.${key}`, visit)
  }
}

const wrongValueFor = (schema: SchemaNode): unknown => {
  if (schema.const !== undefined) return `not-${String(schema.const)}`
  if (schema.enum !== undefined) return '__not_in_declared_enum__'
  switch (schema.type) {
    case 'object': return 'not-an-object'
    case 'array': return 'not-an-array'
    case 'string': return 17
    case 'number':
    case 'integer': return 'not-a-number'
    case 'boolean': return 'not-a-boolean'
    default: return null
  }
}

const sparseInputAt = (path: readonly (string | number)[], value: unknown): unknown => {
  let result = value
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index]
    result = typeof segment === 'number' ? [result] : { [segment]: result }
  }
  return result
}

const schemaFuzzInputs = (schema: SchemaNode): unknown[] => {
  const cases: unknown[] = [null, true, 'unexpected', ['not', 'an', 'object'], { __unknownProperty: true }]
  const walk = (value: unknown, path: readonly (string | number)[]): void => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return
    const node = value as SchemaNode
    if (path.length > 0) cases.push(sparseInputAt(path, wrongValueFor(node)))
    const properties = node.properties
    if (properties !== null && typeof properties === 'object' && !Array.isArray(properties)) {
      for (const [key, child] of Object.entries(properties as Record<string, unknown>)) walk(child, [...path, key])
    }
    if (node.items !== undefined) walk(node.items, [...path, 0])
    for (const combinator of ['allOf', 'anyOf', 'oneOf']) {
      const branches = node[combinator]
      if (Array.isArray(branches)) branches.forEach((branch) => walk(branch, path))
    }
  }
  walk(schema, [])
  return [...new Map(cases.map((input) => [JSON.stringify(input), input])).values()]
}

describe('WebMCP schema and read-only conformance', () => {
  beforeEach(() => appStateStore.getState().reset())

  it('publishes structurally valid strict schemas with the complete unconditional required sets', () => {
    const { tools } = setup()
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(expectedTopLevelRequired).sort())

    for (const tool of tools) {
      const schema = tool.inputSchema as SchemaNode
      expect(schema.required ?? [], `${tool.name} required`).toEqual(expectedTopLevelRequired[tool.name])
      visitSchema(schema, tool.name, (node, path) => {
        if (node.type === 'object') {
          if (node.properties !== undefined) {
            expect(node.properties, `${path} properties`).toSatisfy((properties: unknown) => (
              properties !== null && typeof properties === 'object' && !Array.isArray(properties)
            ))
            expect(node.additionalProperties, `${path} additionalProperties`).toBe(false)
          }
          if (node.required !== undefined) {
            expect(Array.isArray(node.required), `${path} required array`).toBe(true)
            const required = node.required as unknown[]
            expect(required.every((key) => typeof key === 'string'), `${path} required strings`).toBe(true)
            expect(new Set(required).size, `${path} duplicate required keys`).toBe(required.length)
            const propertyKeys = new Set(Object.keys(node.properties as Record<string, unknown>))
            expect(required.every((key) => propertyKeys.has(key as string)), `${path} required keys declared in properties`).toBe(true)
          }
        }
        if (node.type === 'array') expect(node.items, `${path} array items`).toBeDefined()
        for (const combinator of ['allOf', 'anyOf', 'oneOf']) {
          if (node[combinator] !== undefined) expect(node[combinator], `${path} ${combinator}`).toSatisfy((branches: unknown) => Array.isArray(branches) && branches.length > 0)
        }
      })
    }
  })

  it('publishes the complete stable error taxonomy with actionable recovery for every code', async () => {
    const { call } = setup()
    const codes = WEBMCP_ERROR_TAXONOMY.map((entry) => entry.code)
    expect(codes).toEqual(expectedStableErrorCodes)
    expect(new Set(codes).size).toBe(codes.length)
    for (const entry of WEBMCP_ERROR_TAXONOMY) {
      expect(entry.recovery.length, entry.code).toBeGreaterThan(20)
      expect(entry.recovery, entry.code).toMatch(/[.!]$/)
    }

    const guide = await call('get_workspace_guide', {})
    expect(guide.errorCodeTaxonomy).toEqual(WEBMCP_ERROR_TAXONOMY)
  })

  it('never changes project revision when invoking every readOnlyHint tool with schema-valid input', async () => {
    const { store, tools, call } = setup()
    const variantId = store.getState().project.activeVariantId

    const simulation = await call('run_simulation', { playback: 'none', navigateTo: false })
    expect(simulation.ok).toBe(true)
    const autoLayout = await call('run_auto_layout', { maxCandidates: 1, maxDurationMs: 100, openOverlay: false })
    expect(autoLayout.ok).toBe(true)

    const validInputByName: Record<string, unknown> = {
      get_workspace_guide: {},
      get_component_catalog: { capability: 'range-cook' },
      get_layout: { view: 'summary' },
      analyze_layout: { variantId },
      suggest_component_placement: { catalogId: 'hot-six-burner-range', preferredPoint: { xMm: 0, yMm: 0 } },
      get_simulation_guide: {},
      get_app_state: {},
      check_operational_essentials: { variantId },
      preview_layout_changes: {
        expectedRevision: store.getState().revision,
        operations: [{ type: 'nudge_components', variantId, componentIds: ['tandoor'], delta: { xMm: 100, yMm: 0 } }],
      },
      get_simulation_result: { variantId, include: 'metrics' },
      get_auto_layout_run: { runId: autoLayout.runId },
    }
    const readOnlyTools = tools.filter((tool) => tool.annotations?.readOnlyHint === true)
    expect(readOnlyTools.map((tool) => tool.name).sort()).toEqual(Object.keys(validInputByName).sort())

    for (const tool of readOnlyTools) {
      const revision = store.getState().revision
      const result = await Promise.resolve(tool.execute(validInputByName[tool.name])) as Envelope
      expect(result.ok, `${tool.name} should succeed`).toBe(true)
      expect(result.revision, `${tool.name} response revision`).toBe(revision)
      expect(store.getState().revision, `${tool.name} mutated the project`).toBe(revision)
    }
  })

  it('fuzzes every registered schema at root and nested properties without throwing', async () => {
    const { tools } = setup()
    for (const tool of tools) {
      const malformedInputs = schemaFuzzInputs(tool.inputSchema as SchemaNode)
      expect(malformedInputs.length, `${tool.name} fuzz coverage`).toBeGreaterThanOrEqual(5)
      for (const input of malformedInputs) {
        const result = await Promise.resolve().then(() => tool.execute(input))
        expect(result).toBeDefined()
        const envelope = result as Envelope
        expect(envelope, `${tool.name} malformed result`).toMatchObject({ ok: false, code: 'invalid-input' })
      }
    }
  })
})
