import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { configureWorkspaceAutoLayout, createProjectStore, getActiveItem, getActiveVariant, getVariantItem, getWorkspaceFacade } from './project-store'

describe('project store', () => {
  it('exposes the same domain-backed catalog, placement, requirements, and simulation facade used by the UI', () => {
    const store = createProjectStore(createSeedProject())
    const facade = getWorkspaceFacade(store)

    expect(facade.getComponentCatalog({ category: 'storage' }).length).toBeGreaterThan(5)
    expect(facade.suggestPlacement({ variantId: 'baseline-trace', catalogId: 'storage-wall-shelf' })).not.toBeNull()
    expect(facade.getLayoutRequirements({ variantId: 'baseline-trace', scenarioId: 'dinner-peak' }).length).toBeGreaterThan(0)
    expect(facade.runSimulation({ variantId: 'baseline-trace', scenarioId: 'dinner-peak', seed: 7, outputMode: 'metrics-only' })).toMatchObject({ seed: 7 })
  })
  it('routes UI and future-agent auto-layout calls through the store-bound public facade', async () => {
    const store = createProjectStore(createSeedProject())
    const run = vi.fn(async (input) => input)
    const cancel = vi.fn((input) => input)
    configureWorkspaceAutoLayout(store, { run, cancel })
    const facade = getWorkspaceFacade(store)

    await expect(facade.runAutoLayout({ variantId: 'baseline-trace', experiment: { seeds: [3, 5] } })).resolves.toEqual({ variantId: 'baseline-trace', experiment: { seeds: [3, 5] } })
    expect(facade.cancelRun({ runId: 'run-1' })).toEqual({ runId: 'run-1' })
    expect(run).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledWith({ runId: 'run-1' })
  })
  it('routes UI helpers and future-agent calls through identical facade semantics', () => {
    const uiStore = createProjectStore(createSeedProject())
    const toolStore = createProjectStore(createSeedProject())
    uiStore.getState().moveItems(['tandoor'], { x: 2300, y: 900 })
    const result = getWorkspaceFacade(toolStore).applyOperations([{
      type: 'move_components',
      variantId: 'baseline-trace',
      componentIds: ['tandoor'],
      anchor: { xMm: 2300, yMm: 900 },
    }], 'Move components')
    expect(result.ok).toBe(true)
    expect(toolStore.getState().project).toEqual(uiStore.getState().project)
    expect(toolStore.getState().revision).toBe(1)
    expect('executeCommand' in toolStore.getState()).toBe(false)
  })

  it('does not change state while previewing through the public facade', () => {
    const store = createProjectStore(createSeedProject())
    const before = store.getState().project
    const result = getWorkspaceFacade(store).previewLayoutChanges({
      expectedRevision: 0,
      operations: [{ type: 'remove_components', variantId: 'baseline-trace', componentIds: ['tandoor'] }],
      intent: 'Preview removal',
    })
    expect(result).toMatchObject({ ok: true, revision: 0 })
    expect(store.getState().project).toBe(before)
  })

  it('moves selected equipment on the metric grid and supports undo and redo', () => {
    const store = createProjectStore(createSeedProject())
    store.getState().selectItems(['tandoor'])
    store.getState().moveItems(['tandoor'], { x: 2461, y: 951 })
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: 2500, yMm: 1000 })
    store.getState().undo()
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900 })
    store.getState().redo()
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ xMm: 2500, yMm: 1000 })
  })

  it('does not resize a locked item until it is unlocked', () => {
    const store = createProjectStore(createSeedProject())
    store.getState().setDimensionsLocked('tandoor', true)
    store.getState().resizeItem('tandoor', { widthMm: 900, depthMm: 900 })
    expect(getActiveItem(store.getState(), 'tandoor').widthMm).toBe(700)
    store.getState().setDimensionsLocked('tandoor', false)
    store.getState().resizeItem('tandoor', { widthMm: 900, depthMm: 800 })
    expect(getActiveItem(store.getState(), 'tandoor')).toMatchObject({ widthMm: 900, depthMm: 800 })
  })

  it('routes component locks and appearance skins through atomic workspace operations', () => {
    const store = createProjectStore(createSeedProject())

    store.getState().setComponentLocked('tandoor', true)
    expect(store.getState().project.variants[0].layoutConstraints?.lockedComponentIds).toContain('tandoor')

    store.getState().setAppearanceSkin('tandoor', 'stainless-worn')
    expect(getActiveItem(store.getState(), 'tandoor').appearanceSkinId).toBe('stainless-worn')
    expect(store.getState()).toMatchObject({ revision: 2 })
    expect(store.getState().past).toHaveLength(2)
  })

  it('adds architectural catalog entries to variant architecture rather than equipment', () => {
    const project = createSeedProject()
    project.variants[0].architecture.locked = false
    project.architecture.locked = false
    const store = createProjectStore(project)
    const beforeEquipment = store.getState().project.variants[0].equipment.length

    expect(store.getState().addCatalogItem('architecture-service-window', { xMm: 1200, yMm: 0 })).toMatch(/^architecture-service-window-/)
    expect(store.getState().addCatalogItem('architecture-pillar', { xMm: 1800, yMm: 2200 })).toMatch(/^architecture-pillar-/)

    const variant = getActiveVariant(store.getState())
    expect(variant.equipment).toHaveLength(beforeEquipment)
    expect(variant.architecture.openings.at(-1)).toMatchObject({ kind: 'service-window', segmentIndex: 0, flow: 'clean-out' })
    expect(variant.architecture.pillars.at(-1)).toMatchObject({ xMm: 1800, yMm: 2200 })
  })

  it('adds, duplicates, removes, and restores equipment', () => {
    const store = createProjectStore(createSeedProject())
    const customId = store.getState().addCustomItem({ label: 'Rice warmer', widthMm: 600, depthMm: 600 })
    const duplicateId = store.getState().duplicateItem(customId)
    expect(getActiveItem(store.getState(), duplicateId).label).toBe('Rice warmer copy')
    store.getState().removeItems([duplicateId])
    expect(() => getActiveItem(store.getState(), duplicateId)).toThrow(/missing/i)
    store.getState().undo()
    expect(getActiveItem(store.getState(), duplicateId).label).toBe('Rice warmer copy')
  })

  it('adds a catalog component through one public workspace transaction', () => {
    const project = createSeedProject()
    project.variants[0].equipment = []
    const store = createProjectStore(project)

    const id = store.getState().addCatalogItem('prep-work-table', { xMm: 100, yMm: 200 })

    expect(id).toBeTruthy()
    expect(getActiveItem(store.getState(), id!)).toMatchObject({
      catalogId: 'prep-work-table',
      configurationPreset: 'work-table-open-base',
      xMm: 100,
      yMm: 200,
    })
    expect(store.getState()).toMatchObject({ revision: 1, selectedIds: [id] })
    expect(store.getState().past).toHaveLength(1)
  })

  it('duplicates a variant without mutating its parent', () => {
    const store = createProjectStore(createSeedProject())
    const childId = store.getState().createVariant('Hot line option')
    store.getState().activateVariant(childId)
    store.getState().moveItems(['tandoor'], { x: 2600, y: 900 })
    expect(getVariantItem(store.getState(), 'baseline-trace', 'tandoor').xMm).toBe(2400)
    expect(getVariantItem(store.getState(), childId, 'tandoor').xMm).toBe(2600)
  })

  it('changes display units without changing stored geometry', () => {
    const store = createProjectStore(createSeedProject())
    const before = structuredClone(getActiveItem(store.getState(), 'six-burner'))
    store.getState().setDisplayUnit('ft')
    store.getState().setDisplayUnit('mm')
    expect(getActiveItem(store.getState(), 'six-burner')).toEqual(before)
  })

  it('applies a configuration as one revision while preserving placement and selection', () => {
    const store = createProjectStore(createSeedProject())
    store.getState().selectItems(['two-door-fridge'])
    const before = getActiveItem(store.getState(), 'two-door-fridge')

    expect(store.getState().applyEquipmentConfiguration('two-door-fridge', 'cold-chest-freezer')).toBe(true)
    expect(getActiveItem(store.getState(), 'two-door-fridge')).toMatchObject({
      xMm: before.xMm,
      yMm: before.yMm,
      rotationDeg: before.rotationDeg,
      widthMm: 1200,
      depthMm: 700,
      heightMm: 850,
      visualPreset: 'chest-freezer',
      configurationPreset: 'cold-chest-freezer',
    })
    expect(store.getState()).toMatchObject({ revision: 1, selectedIds: ['two-door-fridge'] })
    expect(store.getState().past).toHaveLength(1)

    store.getState().undo()
    expect(getActiveItem(store.getState(), 'two-door-fridge')).toEqual(before)
  })

  it('refuses incompatible configurations without creating history', () => {
    const store = createProjectStore(createSeedProject())
    expect(store.getState().applyEquipmentConfiguration('two-door-fridge', 'hot-tandoor')).toBe(false)
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('commits a validated candidate as one revision and one undo checkpoint', () => {
    const store = createProjectStore(createSeedProject())
    const { documentId } = store.getState()
    const candidate = structuredClone(store.getState().project)
    candidate.name = 'Atomic candidate'
    candidate.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm = 2200

    expect(store.getState().commitProjectCandidate(candidate, 0, documentId)).toEqual({ ok: true, revision: 1 })
    expect(store.getState()).toMatchObject({ revision: 1, past: [{ name: 'Kitchen 1' }], future: [] })
    expect(store.getState().project).toMatchObject({ name: 'Atomic candidate' })
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2200)

    store.getState().undo()
    expect(store.getState().project.name).toBe('Kitchen 1')
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2400)
  })

  it('rejects stale, wrong-document, and invalid candidate commits', () => {
    const store = createProjectStore(createSeedProject())
    const candidate = structuredClone(store.getState().project)
    const documentId = store.getState().documentId

    expect(store.getState().commitProjectCandidate(candidate, 1, documentId)).toMatchObject({ ok: false, code: 'stale-revision', revision: 0 })
    expect(store.getState().commitProjectCandidate(candidate, 0, 'different-document')).toMatchObject({ ok: false, code: 'wrong-document', revision: 0 })

    const invalid = structuredClone(candidate) as unknown as Record<string, unknown>
    invalid.activeVariantId = 'missing'
    expect(store.getState().commitProjectCandidate(invalid, 0, documentId)).toMatchObject({ ok: false, code: 'invalid-project', revision: 0 })
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('rotates document identity on replacement even for the same project id', () => {
    const store = createProjectStore(createSeedProject())
    const previousDocumentId = store.getState().documentId
    store.getState().replaceProject(createSeedProject())
    expect(store.getState().documentId).not.toBe(previousDocumentId)
    expect(store.getState()).toMatchObject({ revision: 0, past: [], future: [] })
  })

  it('adopts one transient auto-layout result as one parented variant and cleans its resolver entry', () => {
    const store = createProjectStore(createSeedProject())
    const candidate = structuredClone(store.getState().project.variants[0])
    candidate.equipment.find((item) => item.id === 'tandoor')!.xMm += 200
    candidate.adoptedExperimentManifest = {
      id: 'experiment-1',
      baselineVariantId: 'baseline-trace',
      finalistId: 'fastest',
      createdAt: '2026-09-02T00:00:00.000Z',
      scenarioIds: ['dinner-peak'],
      seeds: [3, 5],
      confirmationSeeds: [101],
      permissions: { placement: true, equipmentRedesign: false, architecture: false },
      budget: { maxDurationMs: 10_000, maxEvaluations: 30 },
      objective: 'fastest-service',
      resultHash: 'candidate-fastest',
      resultMetrics: { p90WaitSeconds: 720 },
    }

    const result = store.getState().adoptAutoLayoutCandidate({
      expectedDocumentId: store.getState().documentId,
      expectedRevision: 0,
      runId: 'experiment-1',
      resultId: 'fastest',
      baselineVariantId: 'baseline-trace',
      newVariantId: 'layout-fastest',
      name: 'Fastest service',
      candidate,
    })

    expect(result).toMatchObject({ ok: true, revision: 1 })
    expect(store.getState()).toMatchObject({ revision: 1 })
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().project.variants).toHaveLength(2)
    expect(store.getState().project.variants[1]).toMatchObject({
      id: 'layout-fastest',
      name: 'Fastest service',
      parentId: 'baseline-trace',
      adoptedExperimentManifest: candidate.adoptedExperimentManifest,
    })

    const duplicateAdoption = store.getState().adoptAutoLayoutCandidate({
      expectedDocumentId: store.getState().documentId,
      expectedRevision: 1,
      runId: 'experiment-1',
      resultId: 'fastest',
      baselineVariantId: 'baseline-trace',
      newVariantId: 'layout-duplicate',
      name: 'Duplicate adoption',
      candidate,
    })
    expect(duplicateAdoption).toMatchObject({ ok: false, code: 'result-consumed', revision: 1 })

    const replay = store.getState().applyWorkspaceOperations([{
      type: 'adopt_auto_layout_result',
      variantId: 'baseline-trace',
      runId: 'experiment-1',
      resultId: 'fastest',
      newVariantId: 'layout-replay',
      name: 'Replay',
    }], 'Replay adopted result')
    expect(replay).toMatchObject({ ok: false, code: 'batch-operation-failed' })
    expect(store.getState()).toMatchObject({ revision: 1 })
    expect(store.getState().project.variants).toHaveLength(2)
  })

  it('rejects adopting an optimizer result after its bound document or revision changes', () => {
    const store = createProjectStore(createSeedProject())
    const candidate = structuredClone(store.getState().project.variants[0])
    const documentId = store.getState().documentId
    store.getState().rotateItems(['tandoor'], 90)

    expect(store.getState().adoptAutoLayoutCandidate({
      expectedDocumentId: documentId,
      expectedRevision: 0,
      runId: 'stale-run', resultId: 'result', baselineVariantId: candidate.id,
      newVariantId: 'stale-layout', name: 'Stale', candidate,
    })).toMatchObject({ ok: false, code: 'stale-revision', revision: 1 })
    expect(store.getState().project.variants).toHaveLength(1)

    store.getState().replaceProject(createSeedProject())
    expect(store.getState().adoptAutoLayoutCandidate({
      expectedDocumentId: documentId,
      expectedRevision: 0,
      runId: 'wrong-document', resultId: 'result', baselineVariantId: candidate.id,
      newVariantId: 'wrong-layout', name: 'Wrong', candidate,
    })).toMatchObject({ ok: false, code: 'wrong-document' })
    expect(store.getState().project.variants).toHaveLength(1)
  })
})

describe('architecture catalog adds', () => {
  it('adds a door opening to the shared floor plan from the catalog', () => {
    const store = createProjectStore(createSeedProject())
    const before = store.getState().project.variants[0].architecture.openings.length
    const id = store.getState().addCatalogItem('architecture-door', { xMm: 1950, yMm: 3300 })
    expect(id).not.toBeNull()
    expect(store.getState().project.variants[0].architecture.openings).toHaveLength(before + 1)
    expect(store.getState().project.variants[1]?.architecture.openings ?? store.getState().project.variants[0].architecture.openings).toHaveLength(before + 1)
  })

  it('adds a structural pillar even when the architecture is locked', () => {
    const store = createProjectStore(createSeedProject())
    const before = store.getState().project.variants[0].architecture.pillars.length
    const id = store.getState().addCatalogItem('architecture-pillar', { xMm: 1950, yMm: 3300 })
    expect(id).not.toBeNull()
    expect(store.getState().project.variants[0].architecture.pillars).toHaveLength(before + 1)
  })
})
