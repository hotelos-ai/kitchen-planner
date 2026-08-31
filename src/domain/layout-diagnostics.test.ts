import { describe, expect, it } from 'vitest'
import { analyzeLayout } from './layout-diagnostics'
import { createSeedProject } from './seed-project'

describe('layout diagnostics', () => {
  it('flags equipment outside the room and overlapping another footprint', () => {
    const project = createSeedProject()
    const equipment = structuredClone(project.variants[0].equipment)
    equipment.find((item) => item.id === 'mixer')!.xMm = -300
    const duplicate = { ...structuredClone(equipment.find((item) => item.id === 'tandoor')!), id: 'second-tandoor', label: 'Second tandoor' }
    equipment.push(duplicate)
    const issues = analyzeLayout(project.architecture, equipment)
    expect(issues).toContainEqual(expect.objectContaining({ code: 'outside-room', itemIds: ['mixer'] }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'equipment-overlap', itemIds: expect.arrayContaining(['tandoor', 'second-tandoor']) }))
  })

  it('recognizes the confirmed tandoor-to-pillar contact as touching, not overlap', () => {
    const project = createSeedProject()
    const issues = analyzeLayout(project.architecture, project.variants[0].equipment)
    expect(issues.some((issue) => issue.code === 'pillar-overlap' && issue.itemIds.includes('tandoor'))).toBe(false)
  })
})
