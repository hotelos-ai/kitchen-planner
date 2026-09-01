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
})
