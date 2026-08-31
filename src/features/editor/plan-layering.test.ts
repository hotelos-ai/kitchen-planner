import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { orderEquipmentForPlan } from './EquipmentNode'

describe('plan equipment layering', () => {
  it('draws extraction hoods below the appliances they cover', () => {
    const equipment = createSeedProject().variants[0].equipment
    const ordered = orderEquipmentForPlan(equipment)
    const hoodIndex = ordered.findIndex((item) => item.category === 'hood')
    const coveredApplianceIndexes = ['flat-top-fryer', 'six-burner', 'tandoor'].map((id) =>
      ordered.findIndex((item) => item.id === id),
    )

    expect(hoodIndex).toBeGreaterThanOrEqual(0)
    expect(coveredApplianceIndexes.every((index) => index > hoodIndex)).toBe(true)
  })
})
