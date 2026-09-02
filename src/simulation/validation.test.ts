import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { validateSimulationInput } from './validation'

describe('simulation input validation', () => {
  it('accepts the seeded Manta Raja scenario', () => {
    const project = createSeedProject()
    expect(validateSimulationInput({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })).toEqual([])
  })

  it('links missing entry, dirty landing, and cooking capability blockers to their source', () => {
    const project = createSeedProject()
    project.architecture.openings = project.architecture.openings.filter((opening) => opening.id !== 'd2')
    const equipment = project.variants[0].equipment.filter((item) => item.category !== 'cooking' && !item.capabilities.includes('dirty-landing'))
    const errors = validateSimulationInput({ architecture: project.architecture, equipment, scenario: project.scenarios[0] })
    expect(errors).toContainEqual(expect.objectContaining({ code: 'flow-staff-entry', source: 'modeled-flow' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'station-cooking', capability: 'cooking' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'station-dirty-landing', capability: 'dirty-landing' }))
  })

  it('returns exactly the blocker projection of the shared registry', () => {
    const project = createSeedProject()
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment.filter((item) => !item.capabilities.includes('hand-wash')), scenario: { ...project.scenarios[0], staff: [{ role: 'head-chef' as const, count: 1 }] } }

    expect(validateSimulationInput(input)).toEqual(
      evaluateOperationalRequirements(input).filter((result) => result.severity === 'blocker'),
    )
  })
})
