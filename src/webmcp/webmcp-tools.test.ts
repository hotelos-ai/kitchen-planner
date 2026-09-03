import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { projectSchema } from '../domain/project-schema'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getActiveItem, getActiveVariant, getWorkspaceFacade } from '../state/project-store'
import { createSimulationRunStore, selectSimulationRun } from '../state/simulation-run-store'
import { kitchenCapabilityManifest } from './capability-manifest'
import type { WebMcpToolDefinition } from './model-context'
import { createWebMcpTools } from './webmcp-tools'

type Envelope = { ok: boolean; revision?: number; code?: string; message?: string } & Record<string, unknown>

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const runStore = createSimulationRunStore()
  const tools = createWebMcpTools({
    store,
    getFacade: () => getWorkspaceFacade(store),
    manifest: kitchenCapabilityManifest,
    runStore,
  })
  const byName = (name: string): WebMcpToolDefinition => {
    const tool = tools.find((candidate) => candidate.name === name)
    if (!tool) throw new Error(`Missing tool ${name}`)
    return tool
  }
  const call = async (name: string, input: unknown): Promise<Envelope> => byName(name).execute(input) as Promise<Envelope>
  return { store, runStore, tools, byName, call }
}

const collectObjectSchemas = (schema: unknown, found: unknown[] = []): unknown[] => {
  if (schema !== null && typeof schema === 'object') {
    const record = schema as Record<string, unknown>
    if (record.type === 'object') found.push(record)
    for (const value of Object.values(record)) {
      if (value !== null && typeof value === 'object') collectObjectSchemas(value, found)
      if (Array.isArray(value)) value.forEach((item) => collectObjectSchemas(item, found))
    }
  }
  return found
}

describe('webmcp tools', () => {
  beforeEach(() => appStateStore.getState().reset())

  it('exposes a stable, uniquely named toolset with strict top-level schemas', () => {
    const { tools } = setup()
    const names = tools.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.additionalProperties).toBe(false)
    }
    expect(names).toEqual(expect.arrayContaining([
      'get_workspace_guide', 'get_component_catalog', 'get_layout', 'analyze_layout',
      'suggest_component_placement', 'get_simulation_guide', 'export_project',
      'get_app_state', 'set_app_view', 'select_components', 'check_operational_essentials',
      'preview_layout_changes', 'apply_layout_changes', 'run_simulation', 'get_simulation_result', 'step_workspace_history',
    ]))
  })

  it('marks every property-enumerating schema node additionalProperties:false', () => {
    const { tools } = setup()
    for (const tool of tools) {
      const objectSchemas = collectObjectSchemas(tool.inputSchema)
      for (const schema of objectSchemas) {
        const record = schema as Record<string, unknown>
        if (record.properties !== undefined) expect(record.additionalProperties).toBe(false)
      }
    }
  })

  it('rejects unknown input fields with invalid-input and never mutates the store', async () => {
    const { store, call } = setup()
    const before = store.getState().revision
    const result = await call('get_workspace_guide', { surprise: true })
    expect(result).toMatchObject({ ok: false, code: 'invalid-input', revision: before })
    expect(store.getState().revision).toBe(before)
  })

  it('describes the coordinate system, tools, and image policy in the workspace guide', async () => {
    const { call } = setup()
    const guide = await call('get_workspace_guide', {})
    expect(guide.ok).toBe(true)
    expect(guide.coordinateSystem).toMatchObject({ unit: expect.stringContaining('millimetres'), componentAnchor: expect.stringContaining('top-left') })
    expect(guide.referenceImagePolicy).toMatch(/never receives/)
    expect(guide.agentWorkflow).toEqual(expect.arrayContaining([expect.stringContaining('preview_layout_changes')]))
    const toolNames = (guide.tools as { name: string }[]).map((tool) => tool.name)
    expect(toolNames).toContain('apply_layout_changes')
    expect(guide.room).toMatchObject({ polygonVertices: expect.any(Number), openings: expect.any(Number) })
  })

  it('filters the component catalog', async () => {
    const { call } = setup()
    const all = await call('get_component_catalog', {})
    const cooking = await call('get_component_catalog', { category: 'cooking-hot-line' })
    expect(all.ok).toBe(true)
    expect(cooking.ok).toBe(true)
    expect((cooking.entries as unknown[]).length).toBeGreaterThan(0)
    expect((cooking.entries as unknown[]).length).toBeLessThan((all.entries as unknown[]).length)
  })

  it('returns cloned layout data and defaults to the active variant', async () => {
    const { store, call } = setup()
    const summary = await call('get_layout', {})
    expect(summary.ok).toBe(true)
    const components = summary.components as { id: string; xMm: number }[]
    expect(components.length).toBe(getActiveVariant(store.getState()).equipment.length)
    const component = components[0]
    component.xMm = -999_999
    expect(getActiveVariant(store.getState()).equipment[0].xMm).not.toBe(-999_999)
    const full = await call('get_layout', { view: 'full' })
    expect(full).toMatchObject({ ok: true, view: 'full' })
    const architecture = await call('get_layout', { view: 'architecture' })
    expect(architecture).toMatchObject({ ok: true, view: 'architecture' })
    const missing = await call('get_layout', { variantId: 'does-not-exist' })
    expect(missing).toMatchObject({ ok: false, code: 'missing-variant' })
  })

  it('analyzes the layout with remediation text', async () => {
    const { call } = setup()
    const analysis = await call('analyze_layout', {})
    expect(analysis).toMatchObject({ ok: true })
    expect(analysis.certification).toMatch(/not a regulatory certification/i)
    expect(Array.isArray(analysis.findings)).toBe(true)
  })

  it('reads and navigates app state without changing the document revision', async () => {
    const { store, call } = setup()
    const revision = store.getState().revision
    const initial = await call('get_app_state', {})
    expect(initial).toMatchObject({
      ok: true,
      revision,
      stage: 'space',
      view: 'plan',
      overlay: null,
      selectedIds: [],
      canUndo: false,
      canRedo: false,
    })

    const navigated = await call('set_app_view', { stage: 'simulate', view: 'scene', overlay: 'compare' })
    expect(navigated).toMatchObject({ ok: true, revision, stage: 'simulate', view: 'scene', overlay: 'compare' })
    expect(store.getState().revision).toBe(revision)
    expect(appStateStore.getState()).toMatchObject({ stage: 'simulate', view: 'scene', overlay: 'compare' })

    const closed = await call('set_app_view', { overlay: null })
    expect(closed).toMatchObject({ ok: true, stage: 'simulate', view: 'scene', overlay: null })
    expect(await call('set_app_view', {})).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await call('set_app_view', { drawer: 'catalog' })).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('selects only active-layout components in replace, add, toggle, and clear modes', async () => {
    const { store, call } = setup()
    const revision = store.getState().revision

    expect(await call('select_components', { componentIds: ['tandoor'] })).toMatchObject({
      ok: true,
      revision,
      selectedIds: ['tandoor'],
    })
    expect(await call('select_components', { componentIds: ['two-door-fridge'], mode: 'add' })).toMatchObject({
      ok: true,
      selectedIds: ['tandoor', 'two-door-fridge'],
    })
    expect(await call('select_components', { componentIds: ['tandoor', 'six-burner'], mode: 'toggle' })).toMatchObject({
      ok: true,
      selectedIds: ['two-door-fridge', 'six-burner'],
    })
    expect(await call('select_components', { mode: 'clear' })).toMatchObject({ ok: true, selectedIds: [] })
    expect(store.getState().revision).toBe(revision)
  })

  it('rejects unknown component IDs before mutating selection or app navigation', async () => {
    const { store, call } = setup()
    store.getState().selectItems(['tandoor'])
    appStateStore.getState().setOverlay('compare')
    const result = await call('select_components', {
      componentIds: ['six-burner', 'not-in-active-layout'],
      mode: 'replace',
      reveal: 'scene',
    })
    expect(result).toMatchObject({
      ok: false,
      code: 'unknown-component',
      details: { missingComponentIds: ['not-in-active-layout'] },
    })
    expect(store.getState().selectedIds).toEqual(['tandoor'])
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', view: 'plan', overlay: 'compare' })
  })

  it('reveals selected components in plan, scene, or split view', async () => {
    const { call } = setup()
    appStateStore.getState().setOverlay('auto-layout')
    const result = await call('select_components', { componentIds: ['tandoor'], mode: 'replace', reveal: 'both' })
    expect(result).toMatchObject({
      ok: true,
      selectedIds: ['tandoor'],
      stage: 'equipment',
      view: 'split',
      overlay: null,
    })
    expect(appStateStore.getState()).toMatchObject({ stage: 'equipment', view: 'split', overlay: null })
  })

  it('checks operational essentials for an explicit layout and scenario', async () => {
    const { store, call } = setup()
    const state = store.getState()
    const result = await call('check_operational_essentials', {
      variantId: state.project.activeVariantId,
      scenarioId: state.project.activeScenarioId,
    })
    expect(result).toMatchObject({
      ok: true,
      revision: state.revision,
      variantId: state.project.activeVariantId,
      scenarioId: state.project.activeScenarioId,
      ready: expect.any(Boolean),
      status: expect.stringMatching(/^(blocked|ready|ready-with-warnings)$/),
      counts: {
        total: expect.any(Number),
        blockers: expect.any(Number),
        warnings: expect.any(Number),
        professionalReview: expect.any(Number),
      },
      requirements: expect.any(Array),
    })
    expect(result.certification).toMatch(/not a regulatory certification/i)
    expect(await call('check_operational_essentials', { variantId: 'missing' })).toMatchObject({ ok: false, code: 'missing-variant' })
    expect(await call('check_operational_essentials', { scenarioId: 'missing' })).toMatchObject({ ok: false, code: 'missing-scenario' })
  })

  it('previews and applies a multi-operation batch as one revision', async () => {
    const { store, call } = setup()
    const state = store.getState()
    const variantId = state.project.activeVariantId
    const item = getActiveItem(state, 'tandoor')
    const preview = await call('preview_layout_changes', {
      expectedRevision: state.revision,
      operations: [
        { type: 'move_components', variantId, componentIds: ['tandoor'], anchor: { xMm: item.xMm + 200, yMm: item.yMm } },
        { type: 'update_component', variantId, componentId: 'tandoor', patch: { notes: 'agent-adjusted' } },
      ],
      intent: 'Agent test batch',
    })
    expect(preview).toMatchObject({ ok: true, revision: state.revision, changedIds: ['tandoor'] })
    expect(preview.previewToken).toEqual(expect.any(String))
    expect(store.getState().revision).toBe(state.revision)

    const applied = await call('apply_layout_changes', { previewToken: preview.previewToken as string })
    expect(applied).toMatchObject({ ok: true, revision: state.revision + 1, changedIds: ['tandoor'], intent: 'Agent test batch' })
    expect(store.getState().past).toHaveLength(1)
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: item.xMm + 200, notes: 'agent-adjusted' })
  })

  it('directly applies an idempotent batch exactly once', async () => {
    const { store, call } = setup()
    const before = store.getState()
    const input = {
      expectedRevision: before.revision,
      operations: [{
        type: 'nudge_components',
        variantId: before.project.activeVariantId,
        componentIds: ['tandoor'],
        delta: { xMm: 50, yMm: 0 },
      }],
      intent: 'Make room beside the tandoor',
      idempotencyKey: 'direct-tandoor-nudge-1',
    }
    const first = await call('apply_layout_changes', input)
    expect(first).toMatchObject({ ok: true, revision: before.revision + 1, replayed: false })
    const xAfterFirst = getActiveItem(store.getState(), 'tandoor').xMm

    const replay = await call('apply_layout_changes', input)
    expect(replay).toMatchObject({ ok: true, revision: before.revision + 1, originalRevision: before.revision + 1, replayed: true })
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(xAfterFirst)
    expect(store.getState().past).toHaveLength(1)

    const conflict = await call('apply_layout_changes', {
      ...input,
      operations: [{
        type: 'nudge_components',
        variantId: before.project.activeVariantId,
        componentIds: ['tandoor'],
        delta: { xMm: 100, yMm: 0 },
      }],
    })
    expect(conflict).toMatchObject({ ok: false, code: 'idempotency-conflict' })
  })

  it('rejects invalid operations and stale revisions with structured errors', async () => {
    const { store, call } = setup()
    const state = store.getState()
    const badOperation = await call('preview_layout_changes', {
      expectedRevision: state.revision,
      operations: [{ type: 'move_components', variantId: state.project.activeVariantId, componentIds: ['tandoor'], anchor: { xMm: 1, yMm: 2 }, rogue: true }],
    })
    expect(badOperation).toMatchObject({ ok: false, code: 'invalid-input', revision: state.revision })
    const stale = await call('preview_layout_changes', {
      expectedRevision: state.revision + 5,
      operations: [{ type: 'move_components', variantId: state.project.activeVariantId, componentIds: ['tandoor'], anchor: { xMm: 1, yMm: 2 } }],
    })
    expect(stale).toMatchObject({ ok: false, code: 'stale-revision' })
  })

  it('fails tokens that are garbage, reused, or invalidated by concurrent edits', async () => {
    const { store, call } = setup()
    const garbage = await call('apply_layout_changes', { previewToken: 'not-a-token' })
    expect(garbage).toMatchObject({ ok: false, code: 'invalid-preview-token' })
    expect(garbage.recovery).toEqual(expect.any(String))

    const state = store.getState()
    const variantId = state.project.activeVariantId
    const preview = await call('preview_layout_changes', {
      expectedRevision: state.revision,
      operations: [{ type: 'nudge_components', variantId, componentIds: ['tandoor'], delta: { xMm: 50, yMm: 0 } }],
    })
    expect(preview.ok).toBe(true)
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    const stale = await call('apply_layout_changes', { previewToken: preview.previewToken as string })
    expect(stale).toMatchObject({ ok: false, code: 'preview-revision-changed', revision: state.revision + 1 })
  })

  it('runs the simulation without changing the document revision', async () => {
    const { store, runStore, call } = setup()
    const before = store.getState().revision
    const result = await call('run_simulation', {})
    expect(result).toMatchObject({ ok: true, revision: before, outputMode: 'metrics-only' })
    expect(result.assumptions).toEqual(expect.any(String))
    const scenario = result.scenario as { seed: number }
    expect(scenario.seed).toEqual(expect.any(Number))
    const retained = selectSimulationRun(
      runStore.getState(),
      store.getState().project.activeVariantId,
      store.getState().project.activeScenarioId,
    )
    expect(retained).not.toBeNull()
    expect(retained?.result.frames.length).toBeGreaterThan(0)
    expect((result.result as Record<string, unknown>).frames).toBeUndefined()
    expect(store.getState().revision).toBe(before)
    const missing = await call('run_simulation', { scenarioId: 'nope' })
    expect(missing).toMatchObject({ ok: false, code: 'missing-scenario' })
  })

  it('reads retained metrics, findings, stations, and orders without rerunning and reports staleness', async () => {
    const { store, runStore, call } = setup()
    const missing = await call('get_simulation_result', {})
    expect(missing).toMatchObject({ ok: false, code: 'missing-simulation-result' })

    await call('run_simulation', { seed: 8080, playback: 'none', navigateTo: false })
    const key = {
      variantId: store.getState().project.activeVariantId,
      scenarioId: store.getState().project.activeScenarioId,
    }
    const retained = selectSimulationRun(runStore.getState(), key.variantId, key.scenarioId)!
    const metrics = await call('get_simulation_result', { include: 'metrics' })
    const findings = await call('get_simulation_result', { include: 'findings' })
    const stations = await call('get_simulation_result', { include: 'stations' })
    const orders = await call('get_simulation_result', { include: 'orders' })

    expect(metrics).toMatchObject({ ok: true, seed: 8080, ranAtRevision: 0, metrics: retained.result.metrics })
    expect(findings).toMatchObject({ ok: true, findings: expect.any(Array) })
    expect(stations).toMatchObject({ ok: true, stations: expect.any(Array) })
    expect((stations.stations as unknown[]).length).toBeGreaterThan(0)
    expect(orders).toMatchObject({ ok: true, orders: retained.result.orders })
    expect(selectSimulationRun(runStore.getState(), key.variantId, key.scenarioId)?.result).toBe(retained.result)

    store.getState().nudgeItems(['tandoor'], { x: 50, y: 0 })
    expect(await call('get_simulation_result', {})).toMatchObject({
      ok: true,
      ranAtRevision: 0,
      staleAtRevision: 1,
    })
  })

  it('exports a project JSON that round-trips through the project schema', async () => {
    const { call } = setup()
    const exported = await call('export_project', {})
    expect(exported.ok).toBe(true)
    expect(exported.filename).toMatch(/rev-\d+\.json$/)
    const parsed = projectSchema.safeParse(JSON.parse(exported.projectJson as string))
    expect(parsed.success).toBe(true)
  })

  it('undoes and redoes workspace steps', async () => {
    const { store, call } = setup()
    const emptyRedo = await call('step_workspace_history', { direction: 'redo' })
    expect(emptyRedo).toMatchObject({ ok: true, stepped: false })
    const emptyUndo = await call('step_workspace_history', { direction: 'undo' })
    expect(emptyUndo).toMatchObject({ ok: true, stepped: false })
    const start = store.getState().revision
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    const undone = await call('step_workspace_history', { direction: 'undo' })
    expect(undone).toMatchObject({ ok: true, stepped: true, revision: start + 2 })
    const redone = await call('step_workspace_history', { direction: 'redo' })
    expect(redone).toMatchObject({ ok: true, stepped: true })
  })

  it('converts thrown dependencies into error envelopes instead of exceptions', async () => {
    const store = createProjectStore(createSeedProject())
    const tools = createWebMcpTools({
      store,
      getFacade: () => { throw new Error('facade exploded') },
      manifest: kitchenCapabilityManifest,
    })
    const catalog = tools.find((tool) => tool.name === 'get_component_catalog')!
    const result = await catalog.execute({}) as Envelope
    expect(result).toMatchObject({ ok: false, code: 'internal-error' })
    expect(result.message).toBe('facade exploded')
  })
})
