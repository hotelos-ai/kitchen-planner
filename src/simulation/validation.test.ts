import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createCatalogEquipmentItem, getCatalogEntry } from '../domain/catalog/kitchen-catalog'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { physicalStationCapacity, simulationValidationWarnings, validateSimulationInput } from './validation'

describe('simulation input validation', () => {
  it('derives physical station capacity from the selected catalog preset', () => {
    const entry = getCatalogEntry('prep-work-table')!
    const preset = entry.physicalConfigurations.at(-1)!
    const item = createCatalogEquipmentItem({ catalogId: entry.catalogId, componentId: 'configured-prep', position: { xMm: 0, yMm: 0 }, configurationId: preset.id })

    expect(physicalStationCapacity(item)).toBe(Math.max(1, preset.capacity.workPositions))
  })

  it('accepts the seeded scenario', () => {
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

  it('rejects unknown roles and non-positive or fractional role counts', () => {
    const project = createSeedProject()
    project.scenarios[0].staff = [
      { role: 'head-chef', count: 1.5 },
      { role: 'busser-washer', count: 0 },
      { role: 'mystery-role', count: 1 },
    ] as typeof project.scenarios[0]['staff']

    const errors = validateSimulationInput({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    expect(errors).toContainEqual(expect.objectContaining({ code: 'scenario-staff-count-invalid' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'scenario-staff-role-invalid', itemIds: ['mystery-role'] }))
  })

  it('rejects unknown, malformed, and physically impossible station capacities', () => {
    const project = createSeedProject()
    project.scenarios[0].stationCapacities = {
      missing: 1,
      dishwasher: 1.5,
      'six-burner': 3,
    }

    const errors = validateSimulationInput({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    expect(errors.filter((error) => error.code === 'station-capacity-invalid')).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemIds: ['missing'] }),
      expect.objectContaining({ itemIds: ['dishwasher'] }),
    ]))
    expect(errors).toContainEqual(expect.objectContaining({
      code: 'station-capacity-exceeds-physical', itemIds: ['six-burner'], requiredCapacity: 2, actualCapacity: 3,
    }))
  })

  it('rejects unknown, non-finite, non-positive, and reversed task duration ranges', () => {
    const project = createSeedProject()
    project.scenarios[0].taskDurations = {
      'food-prep': { minSeconds: 90, maxSeconds: 30 },
      'dish-wash': { minSeconds: 0, maxSeconds: Number.POSITIVE_INFINITY },
      mystery: { minSeconds: 1, maxSeconds: 2 },
    } as typeof project.scenarios[0]['taskDurations']

    const errors = validateSimulationInput({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    expect(errors).toContainEqual(expect.objectContaining({ code: 'task-duration-range-invalid', itemIds: ['food-prep'] }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'task-duration-range-invalid', itemIds: ['dish-wash'] }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'task-duration-capability-invalid', itemIds: ['mystery'] }))
  })

  it('warns but does not block when a required station approach is obstructed', () => {
    const project = createSeedProject()
    const equipment = structuredClone(project.variants[0].equipment)
    const tandoor = equipment.find((item) => item.id === 'tandoor')!
    const blocker = equipment.find((item) => item.id === 'mixer')!
    blocker.widthMm = 2400
    blocker.depthMm = 2400
    blocker.xMm = tandoor.xMm - 850
    blocker.yMm = tandoor.yMm - 850

    const errors = validateSimulationInput({ architecture: project.architecture, equipment, scenario: project.scenarios[0] })
    const warnings = simulationValidationWarnings({ architecture: project.architecture, equipment, scenario: project.scenarios[0] })
    expect(errors).not.toContainEqual(expect.objectContaining({ code: 'station-approach-blocked' }))
    expect(warnings).toContainEqual(expect.objectContaining({ code: 'route-station-unreachable', severity: 'warning', itemIds: expect.arrayContaining(['tandoor']) }))
  })
})
