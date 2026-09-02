import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createProjectStore, getActiveItem, getVariantItem } from './project-store'

describe('project store', () => {
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
    expect(store.getState()).toMatchObject({ revision: 1, past: [{ name: 'Manta Raja Kitchen Lab' }], future: [] })
    expect(store.getState().project).toMatchObject({ name: 'Atomic candidate' })
    expect(getActiveItem(store.getState(), 'tandoor').xMm).toBe(2200)

    store.getState().undo()
    expect(store.getState().project.name).toBe('Manta Raja Kitchen Lab')
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
})
