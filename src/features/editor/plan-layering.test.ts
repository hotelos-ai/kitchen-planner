import { describe, expect, it } from 'vitest'
import { createCatalogEquipmentItem } from '../../domain/catalog/kitchen-catalog'
import { orderEquipmentForPlan, reorderEquipmentForPlan } from '../../domain/plan-layer-order'
import { createSeedProject } from '../../domain/seed-project'

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

  it('draws elevated shelves above floor equipment by default', () => {
    const floorItem = createSeedProject().variants[0].equipment.find((item) => item.id === 'six-burner')!
    const shelf = createCatalogEquipmentItem({
      catalogId: 'storage-wall-shelf',
      componentId: 'wall-shelf',
      position: { xMm: floorItem.xMm, yMm: floorItem.yMm },
    })

    expect(orderEquipmentForPlan([shelf, floorItem]).map((item) => item.id)).toEqual(['six-burner', 'wall-shelf'])
  })

  it('supports single-step and full-stack user ordering', () => {
    const equipment = createSeedProject().variants[0].equipment.slice(0, 3).map((item, index) => ({ ...item, planLayerOrder: index }))
    const middleId = equipment[1].id

    expect(reorderEquipmentForPlan(equipment, middleId, 'front').at(-1)?.id).toBe(middleId)
    expect(reorderEquipmentForPlan(equipment, middleId, 'back')[0]?.id).toBe(middleId)
    expect(reorderEquipmentForPlan(equipment, middleId, 'forward').map((item) => item.id)).toEqual([equipment[0].id, equipment[2].id, middleId])
    expect(reorderEquipmentForPlan(equipment, middleId, 'backward').map((item) => item.id)).toEqual([middleId, equipment[0].id, equipment[2].id])
  })
})
