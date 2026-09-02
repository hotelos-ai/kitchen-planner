import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem } from '../../state/project-store'
import { createWorkspaceFacade } from './workspace-facade'

const operations = [
  { type: 'move_components', variantId: 'baseline-trace', componentIds: ['tandoor'], anchor: { xMm: 2200, yMm: 1000 } },
  { type: 'rotate_components', variantId: 'baseline-trace', componentIds: ['tandoor'], deltaDeg: 90 },
] as const

describe('workspace facade', () => {
  it('previews without mutation and applies once as one revision and undo checkpoint', () => {
    const store = createProjectStore(createSeedProject())
    const facade = createWorkspaceFacade({ store })
    const before = store.getState().project

    const preview = facade.previewLayoutChanges({ expectedRevision: 0, operations, intent: 'Move and turn tandoor' })
    expect(preview).toMatchObject({ ok: true, revision: 0, changedIds: ['tandoor'] })
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
    expect(store.getState().project).toBe(before)
    if (!preview.ok) throw new Error(preview.message)

    const applied = facade.applyLayoutChanges({ previewToken: preview.previewToken })
    expect(applied).toMatchObject({ ok: true, revision: 1, changedIds: ['tandoor'] })
    expect(store.getState().past).toHaveLength(1)
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: 2200, yMm: 1000, rotationDeg: 90 })
    expect(facade.applyLayoutChanges({ previewToken: preview.previewToken })).toMatchObject({ ok: false, code: 'used-preview-token', revision: 1 })

    store.getState().undo()
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900, rotationDeg: 0 })
  })

  it('rejects previews after competing edits and project replacement', () => {
    const store = createProjectStore(createSeedProject())
    const facade = createWorkspaceFacade({ store })
    const first = facade.previewLayoutChanges({ expectedRevision: 0, operations })
    if (!first.ok) throw new Error(first.message)
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    expect(facade.applyLayoutChanges({ previewToken: first.previewToken })).toMatchObject({ ok: false, code: 'preview-revision-changed', revision: 1 })

    const second = facade.previewLayoutChanges({ expectedRevision: 1, operations })
    if (!second.ok) throw new Error(second.message)
    store.getState().replaceProject(createSeedProject())
    expect(facade.applyLayoutChanges({ previewToken: second.previewToken })).toMatchObject({ ok: false, code: 'preview-document-mismatch', revision: 0 })
  })

  it('produces identical projects for convenience UI and simulated-agent callers', () => {
    const uiStore = createProjectStore(createSeedProject())
    const agentStore = createProjectStore(createSeedProject())
    const ui = createWorkspaceFacade({ store: uiStore })
    const agent = createWorkspaceFacade({ store: agentStore })

    expect(ui.applyOperations(operations, 'UI gesture')).toMatchObject({ ok: true, revision: 1 })
    const preview = agent.previewLayoutChanges({ expectedRevision: 0, operations, intent: 'Agent request' })
    if (!preview.ok) throw new Error(preview.message)
    expect(agent.applyLayoutChanges({ previewToken: preview.previewToken })).toMatchObject({ ok: true, revision: 1 })

    expect(agentStore.getState().project).toEqual(uiStore.getState().project)
    expect(agentStore.getState().past).toHaveLength(1)
    expect(uiStore.getState().past).toHaveLength(1)
  })

  it('rejects malformed operations and stale expected revisions', () => {
    const facade = createWorkspaceFacade({ store: createProjectStore(createSeedProject()) })
    expect(facade.previewLayoutChanges({ expectedRevision: 1, operations })).toMatchObject({ ok: false, code: 'stale-revision', revision: 0 })
    expect(facade.previewLayoutChanges({ expectedRevision: 0, operations: [{ ...operations[0], surprise: true }] })).toMatchObject({ ok: false, code: 'invalid-operation', revision: 0 })
  })

  it('returns a diagnostics delta for the explicitly targeted inactive layout', () => {
    const project = createSeedProject()
    const inactive = structuredClone(project.variants[0])
    inactive.id = 'inactive-layout'
    inactive.name = 'Inactive layout'
    project.variants.push(inactive)
    const facade = createWorkspaceFacade({ store: createProjectStore(project) })

    const preview = facade.previewLayoutChanges({ expectedRevision: 0, operations: [{
      type: 'move_components', variantId: inactive.id, componentIds: ['tandoor'], anchor: { xMm: -1000, yMm: -1000 },
    }] })

    expect(preview).toMatchObject({ ok: true, diagnostics: { added: [expect.objectContaining({ variantId: inactive.id, code: 'outside-room' })] } })
  })

  it('defaults workspace simulations to full output while allowing optimizer metrics-only requests', () => {
    const runSimulation = vi.fn((input) => input)
    const facade = createWorkspaceFacade({ store: createProjectStore(createSeedProject()), runSimulation })

    expect(facade.runSimulation({ variantId: 'baseline-trace', scenarioId: 'dinner-peak', seed: 7 })).toMatchObject({ outputMode: 'full' })
    expect(facade.runSimulation({ variantId: 'baseline-trace', scenarioId: 'dinner-peak', seed: 7, outputMode: 'metrics-only' })).toMatchObject({ outputMode: 'metrics-only' })
    expect(runSimulation).toHaveBeenNthCalledWith(1, expect.objectContaining({ outputMode: 'full' }))
    expect(runSimulation).toHaveBeenNthCalledWith(2, expect.objectContaining({ outputMode: 'metrics-only' }))
  })
})
