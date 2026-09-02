import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../seed-project'
import { evaluateOperationalRequirements, OPERATIONAL_REQUIREMENTS } from './operational-requirements'

const inputFromSeed = () => {
  const project = createSeedProject()
  return {
    architecture: project.variants[0].architecture,
    equipment: project.variants[0].equipment,
    scenario: project.scenarios[0],
    layoutConstraints: project.variants[0].layoutConstraints,
  }
}

describe('operational requirement registry', () => {
  it('publishes unique stable definitions and professional-review boundaries', () => {
    expect(Object.isFrozen(OPERATIONAL_REQUIREMENTS)).toBe(true)
    expect(new Set(OPERATIONAL_REQUIREMENTS.map((requirement) => requirement.code)).size).toBe(OPERATIONAL_REQUIREMENTS.length)

    const results = evaluateOperationalRequirements(inputFromSeed())
    const professional = results.filter((result) => result.severity === 'professional-review')
    expect(professional.map((result) => result.code)).toEqual(expect.arrayContaining([
      'professional-fire-review', 'professional-ventilation-review', 'professional-hygiene-review', 'professional-accessibility-review',
      'professional-gas-review', 'professional-electrical-review', 'professional-drainage-review',
      'professional-grease-review', 'professional-local-authority-review',
    ]))
    professional.forEach((result) => {
      expect(result.source).toBe('professional-judgment')
      expect(result.reason).toMatch(/qualified professional|professional review/i)
      expect(result.reason).not.toMatch(/\bcertified\b|\bcompliant\b/i)
    })
  })

  it('reports task-chain stations including dirty and clean landing with count, capacity, and remedies', () => {
    const input = inputFromSeed()
    input.equipment = input.equipment.filter((item) => !item.capabilities.includes('dirty-landing') && !item.capabilities.includes('hand-wash'))

    const results = evaluateOperationalRequirements(input)

    expect(results).toContainEqual(expect.objectContaining({
      code: 'station-dirty-landing', severity: 'blocker', scope: 'equipment', capability: 'dirty-landing',
      requiredCount: 1, actualCount: 0, requiredCapacity: 1, actualCapacity: 0,
      recommendedCatalogIds: expect.arrayContaining(['wash-dirty-landing']), itemIds: [],
    }))
    expect(results).toContainEqual(expect.objectContaining({
      code: 'station-hand-wash', severity: 'blocker', capability: 'hand-wash', recommendedCatalogIds: ['sanitation-hand-sink'],
    }))
  })

  it('checks entry/service flows, staff roles and station capacity', () => {
    const input = inputFromSeed()
    input.architecture = {
      ...input.architecture,
      openings: input.architecture.openings.filter((opening) => opening.flow !== 'entry' && opening.flow !== 'dirty-in'),
    }
    input.scenario = {
      ...input.scenario,
      staff: [{ role: 'head-chef', count: 1 }, { role: 'busser-washer', count: 0 }],
      stationCapacities: { ...input.scenario.stationCapacities, dishwasher: 0 },
    }

    const results = evaluateOperationalRequirements(input)

    expect(results).toContainEqual(expect.objectContaining({ code: 'flow-staff-entry', severity: 'blocker', scope: 'architecture', requiredCount: 1, actualCount: 0 }))
    expect(results).toContainEqual(expect.objectContaining({ code: 'flow-dirty-return', severity: 'blocker', scope: 'architecture' }))
    expect(results).toContainEqual(expect.objectContaining({ code: 'staff-warewashing', severity: 'blocker', scope: 'staff', requiredCount: 1, actualCount: 0 }))
    expect(results).toContainEqual(expect.objectContaining({ code: 'station-capacity-invalid', severity: 'blocker', scope: 'scenario', itemIds: ['dishwasher'], requiredCapacity: 1, actualCapacity: 0 }))
  })

  it('evaluates modeled clearance and explicit no-go constraints', () => {
    const input = inputFromSeed()
    const tandoor = input.equipment.find((item) => item.id === 'tandoor')!
    const blocker = input.equipment.find((item) => item.id === 'working-table')!
    input.equipment = input.equipment.map((item) => item.id === blocker.id ? { ...item, xMm: tandoor.xMm, yMm: tandoor.yMm + tandoor.depthMm } : item)
    input.layoutConstraints = {
      noGoZones: [{ id: 'protected-riser', xMm: tandoor.xMm, yMm: tandoor.yMm, widthMm: tandoor.widthMm, depthMm: tandoor.depthMm }],
    }

    const results = evaluateOperationalRequirements(input)

    expect(results).toContainEqual(expect.objectContaining({ code: 'clearance-obstructed', severity: 'warning', source: 'modeled-clearance', itemIds: expect.arrayContaining(['tandoor', blocker.id]) }))
    expect(results).toContainEqual(expect.objectContaining({ code: 'no-go-overlap', severity: 'blocker', source: 'user-constraint', itemIds: ['tandoor'] }))
  })
})
