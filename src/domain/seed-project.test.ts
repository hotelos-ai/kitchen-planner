import { describe, expect, it } from 'vitest'
import { projectSchema } from './project-schema'
import { createSeedProject } from './seed-project'

describe('Manta Raja seed project', () => {
  it('preserves the confirmed fixed relationships', () => {
    const project = createSeedProject()
    const items = project.variants[0].equipment
    const tandoor = items.find((item) => item.id === 'tandoor')!
    const freezer = items.find((item) => item.id === 'upright-freezer')!
    const pillar = project.architecture.pillars[0]
    const storage = project.architecture.storageZones[0]

    expect(tandoor.xMm + tandoor.widthMm).toBe(pillar.xMm)
    expect(storage.xMm + storage.widthMm).toBeLessThanOrEqual(freezer.xMm)
    expect(project.architecture.openings.find((opening) => opening.id === 'd6')).toMatchObject({ kind: 'sealed-opening', flow: 'closed' })
  })

  it('seeds every equipment group required by the sketch', () => {
    const ids = createSeedProject().variants[0].equipment.map((item) => item.id)
    expect(ids).toEqual(expect.arrayContaining([
      'flat-top-fryer', 'six-burner', 'tandoor', 'upright-freezer', 'fridge-clean-prep',
      'prep-fridge-counter', 'mixer', 'working-table', 'double-sink', 'two-door-fridge',
      'dirty-landing', 'pre-rinse-sink', 'dishwasher', 'clean-landing', 'handwash', 'hot-line-hood',
    ]))
  })

  it('provides a valid five-person 50-cover default service', () => {
    const project = createSeedProject()
    expect(projectSchema.safeParse(project).success).toBe(true)
    expect(project.scenarios[0]).toMatchObject({ covers: 50, durationMinutes: 60, seed: 20260831 })
    expect(project.scenarios[0].staff.reduce((total, assignment) => total + assignment.count, 0)).toBe(5)
  })
})
