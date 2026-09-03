import { describe, expect, it } from 'vitest'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { applyAutomaticPlanFixes } from './auto-fix-orchestrator'

describe('automatic plan fix orchestrator', () => {
  it('returns immediately without rearranging a ready plan for advisory clearance warnings', () => {
    const project = createSeedProject()
    const before = structuredClone(project.variants[0].equipment)
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)

    expect(result.status).toBe('success')
    expect(result.applied).toBe(false)
    expect(result.after.blockers).toBe(0)
    expect(result.after.layoutErrors).toBe(0)
    expect(result.after.layoutWarnings).toBeGreaterThan(0)
    expect(store.getState().project.variants[0].equipment).toEqual(before)
    expect(store.getState().past).toHaveLength(0)
  })

  it('adds missing essentials and fixes top-left anchored overlaps in one undoable batch', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.equipment = variant.equipment.filter((item) => !item.capabilities.includes('hand-wash'))
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    const range = variant.equipment.find((item) => item.id === 'six-burner')!
    table.xMm = range.xMm
    table.yMm = range.yMm
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)
    const next = store.getState().project.variants[0]

    expect(result.applied).toBe(true)
    expect(result.addedCount).toBe(1)
    expect(result.movedCount).toBeGreaterThan(0)
    expect(next.equipment.some((item) => item.capabilities.includes('hand-wash'))).toBe(true)
    expect(analyzeLayout(next.architecture, next.equipment, { layoutConstraints: next.layoutConstraints })
      .some((issue) => issue.code === 'equipment-overlap')).toBe(false)
    expect(store.getState().past).toHaveLength(1)

    store.getState().undo()
    const restored = store.getState().project.variants[0]
    expect(restored.equipment.some((item) => item.capabilities.includes('hand-wash'))).toBe(false)
    expect(restored.equipment.find((item) => item.id === 'working-table')).toMatchObject({ xMm: range.xMm, yMm: range.yMm })
  })

  it('never moves a locked component while resolving its collision', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    const range = variant.equipment.find((item) => item.id === 'six-burner')!
    const originalRange = { xMm: range.xMm, yMm: range.yMm }
    table.xMm = range.xMm
    table.yMm = range.yMm
    variant.layoutConstraints = { lockedComponentIds: ['six-burner'] }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)
    const next = store.getState().project.variants[0]

    expect(result.applied).toBe(true)
    expect(next.equipment.find((item) => item.id === 'six-burner')).toMatchObject(originalRange)
    expect(next.equipment.find((item) => item.id === 'working-table')).not.toMatchObject(originalRange)
  })

  it('moves unlocked equipment out of explicit no-go zones', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    variant.layoutConstraints = {
      noGoZones: [{ id: 'keep-clear', xMm: table.xMm, yMm: table.yMm, widthMm: table.widthMm, depthMm: table.depthMm }],
    }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)
    const moved = store.getState().project.variants[0].equipment.find((item) => item.id === 'working-table')!

    expect(result.applied).toBe(true)
    expect({ xMm: moved.xMm, yMm: moved.yMm }).not.toEqual({ xMm: table.xMm, yMm: table.yMm })
  })

  it('returns a clear failure and leaves history untouched when only locked conflicts remain', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    const range = variant.equipment.find((item) => item.id === 'six-burner')!
    table.xMm = range.xMm
    table.yMm = range.yMm
    variant.layoutConstraints = { lockedComponentIds: variant.equipment.map((item) => item.id) }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)

    expect(result.status).toBe('failure')
    expect(result.applied).toBe(false)
    expect(result.message).toMatch(/No safe automatic fix/i)
    expect(result.remaining.length).toBeGreaterThan(0)
    expect(store.getState().past).toHaveLength(0)
  })

  it('adds required flow openings across layouts when shared architecture is editable', () => {
    const project = createSeedProject()
    project.variants[0].architecture.locked = false
    project.variants[0].architecture.openings = []
    project.variants[0].equipment = []
    project.architecture = structuredClone(project.variants[0].architecture)
    project.variants.push({
      ...structuredClone(project.variants[0]),
      id: 'alternate-layout',
      name: 'Alternate layout',
    })
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)

    expect(result.applied).toBe(true)
    expect(result.architectureAdjusted).toBe(true)
    expect(store.getState().past).toHaveLength(1)
    store.getState().project.variants.forEach((variant) => {
      expect(variant.architecture.openings.map((opening) => opening.flow)).toEqual(expect.arrayContaining([
        'entry', 'clean-out', 'dirty-in',
      ]))
      const sorted = [...variant.architecture.openings].sort((left, right) =>
        (left.segmentIndex ?? 0) - (right.segmentIndex ?? 0) || left.offsetMm - right.offsetMm)
      sorted.forEach((opening, index) => {
        const next = sorted[index + 1]
        if (next?.segmentIndex === opening.segmentIndex) expect(opening.offsetMm + opening.widthMm).toBeLessThanOrEqual(next.offsetMm - 200)
      })
    })
  })

  it('leaves required openings unresolved when architecture is locked', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.architecture.openings = []
    variant.layoutConstraints = { lockedComponentIds: variant.equipment.map((item) => item.id) }
    project.architecture = structuredClone(variant.architecture)
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)

    expect(result.status).toBe('failure')
    expect(result.applied).toBe(false)
    expect(result.remaining).toEqual(expect.arrayContaining([expect.stringMatching(/staff entry/i)]))
    expect(store.getState().project.variants[0].architecture.openings).toHaveLength(0)
  })

  it('repairs simulation scenario counts and capacities in the same operation', () => {
    const project = createSeedProject()
    project.scenarios[0].covers = 0
    project.scenarios[0].staff = []
    project.scenarios[0].stationCapacities = { missing: 4, 'six-burner': 99 }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store)
    const scenario = store.getState().project.scenarios[0]

    expect(result.applied).toBe(true)
    expect(result.scenarioAdjusted).toBe(true)
    expect(scenario.covers).toBe(1)
    expect(scenario.staff).toEqual(expect.arrayContaining([
      { role: 'head-chef', count: 1 },
      { role: 'busser-washer', count: 1 },
    ]))
    expect(scenario.stationCapacities).not.toHaveProperty('missing')
    expect(scenario.stationCapacities?.['six-burner']).toBeLessThan(99)
    expect(store.getState().past).toHaveLength(1)
  })

  it('moves equipment without changing architecture when that strategy is selected', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    table.xMm = 4200
    const originalArchitecture = structuredClone(variant.architecture)
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store, { strategy: 'equipment' })
    const next = store.getState().project.variants[0]

    expect(result.strategy).toBe('equipment')
    expect(result.movedCount).toBeGreaterThan(0)
    expect(result.architectureAdjusted).toBe(false)
    expect(next.architecture).toEqual(originalArchitecture)
    expect(next.equipment.find((item) => item.id === table.id)?.xMm).not.toBe(4200)
    expect(analyzeLayout(next.architecture, next.equipment, { layoutConstraints: next.layoutConstraints })
      .some((issue) => issue.code === 'outside-room')).toBe(false)
  })

  it('adjusts editable architecture without moving existing equipment when layout strategy is selected', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.architecture.locked = false
    project.architecture.locked = false
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    table.xMm = 4200
    const originalPositions = Object.fromEntries(variant.equipment.map((item) => [item.id, { xMm: item.xMm, yMm: item.yMm }]))
    const originalWidth = variant.architecture.widthMm
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store, 'layout')
    const next = store.getState().project.variants[0]

    expect(result.strategy).toBe('layout')
    expect(result.movedCount).toBe(0)
    expect(result.architectureAdjusted).toBe(true)
    expect(next.architecture.widthMm).toBeGreaterThan(originalWidth)
    expect(Object.fromEntries(next.equipment.map((item) => [item.id, { xMm: item.xMm, yMm: item.yMm }]))).toEqual(originalPositions)
    expect(analyzeLayout(next.architecture, next.equipment, { layoutConstraints: next.layoutConstraints })
      .some((issue) => issue.code === 'outside-room')).toBe(false)
  })

  it('expands an editable room into negative coordinates without moving equipment', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.architecture.locked = false
    project.architecture.locked = false
    const mixer = variant.equipment.find((item) => item.id === 'mixer')!
    mixer.xMm = -500
    const originalPosition = { xMm: mixer.xMm, yMm: mixer.yMm }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store, { strategy: 'layout' })
    const next = store.getState().project.variants[0]

    expect(result.applied).toBe(true)
    expect(result.architectureAdjusted).toBe(true)
    expect(next.equipment.find((item) => item.id === mixer.id)).toMatchObject(originalPosition)
    expect(Math.min(...next.architecture.roomPolygon.map((point) => point.x))).toBeLessThanOrEqual(-500)
    expect(analyzeLayout(next.architecture, next.equipment, { layoutConstraints: next.layoutConstraints })
      .some((issue) => issue.id === 'outside-mixer')).toBe(false)
  })

  it('reports partial completion when the chosen strategy cannot move locked conflicts', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const table = variant.equipment.find((item) => item.id === 'working-table')!
    const range = variant.equipment.find((item) => item.id === 'six-burner')!
    table.xMm = range.xMm
    table.yMm = range.yMm
    variant.equipment = variant.equipment.filter((item) => !item.capabilities.includes('hand-wash'))
    variant.layoutConstraints = { lockedComponentIds: [table.id, range.id] }
    const store = createProjectStore(project)

    const result = applyAutomaticPlanFixes(store, { strategy: 'equipment' })

    expect(result.status).toBe('partial')
    expect(result.applied).toBe(true)
    expect(result.addedCount).toBe(1)
    expect(result.after.layoutErrors).toBeGreaterThan(0)
    expect(result.message).toMatch(/still need a decision/i)
  })
})
