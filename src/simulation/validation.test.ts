import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { validateSimulationInput } from './validation'

describe('simulation input validation', () => {
  it('accepts the seeded Manta Raja scenario', () => {
    const project = createSeedProject()
    expect(validateSimulationInput({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })).toEqual([])
  })

  it('links missing entry and cooking capability errors to their source', () => {
    const project = createSeedProject()
    project.architecture.openings = project.architecture.openings.filter((opening) => opening.id !== 'd2')
    const equipment = project.variants[0].equipment.filter((item) => item.category !== 'cooking')
    const errors = validateSimulationInput({ architecture: project.architecture, equipment, scenario: project.scenarios[0] })
    expect(errors).toContainEqual(expect.objectContaining({ code: 'missing-entry' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'missing-capability', capability: 'cooking' }))
  })
})
