import { describe, expect, it } from 'vitest'
import { createCatalogEquipmentItem } from '../../domain/catalog/kitchen-catalog'
import { createSeedProject } from '../../domain/seed-project'
import { elevatedShelfOffsetMm, overshelfPostGeometry } from './equipment-elevation'

describe('elevated equipment placement', () => {
  it('places a table overshelf above an overlapping table instead of in front of it', () => {
    const table = {
      ...(createSeedProject().variants[0].equipment.find((item) => item.id === 'prep-table')
        ?? createSeedProject().variants[0].equipment.find((item) => item.category === 'prep')!),
      heightMm: 900,
    }
    const shelf = createCatalogEquipmentItem({
      catalogId: 'storage-overshelf',
      componentId: 'table-overshelf',
      position: { xMm: table.xMm, yMm: table.yMm },
    })
    const naturalBottomMm = 1_450 - shelf.heightMm

    expect(naturalBottomMm).toBeLessThan(table.heightMm)
    expect(naturalBottomMm + elevatedShelfOffsetMm(shelf, [table, shelf])).toBe(table.heightMm)
  })

  it('does not move elevated storage that already clears the equipment below', () => {
    const table = createSeedProject().variants[0].equipment.find((item) => item.category === 'prep')!
    const overhead = createCatalogEquipmentItem({
      catalogId: 'storage-overhead-rack',
      componentId: 'overhead-rack',
      position: { xMm: table.xMm, yMm: table.yMm },
    })

    expect(elevatedShelfOffsetMm(overhead, [table, overhead])).toBe(0)
  })

  it('does not infer vertical stacking from plan order for floor-mounted racks', () => {
    const table = createSeedProject().variants[0].equipment.find((item) => item.category === 'prep')!
    const rack = {
      ...createCatalogEquipmentItem({
        catalogId: 'storage-freestanding-shelving',
        componentId: 'floor-rack',
        position: { xMm: table.xMm, yMm: table.yMm },
      }),
      planLayerOrder: 999,
    }

    expect(elevatedShelfOffsetMm(rack, [table, rack])).toBe(0)
  })

  it('keeps overshelf support posts within the finite configured assembly height', () => {
    const shelf = createCatalogEquipmentItem({
      catalogId: 'storage-overshelf',
      componentId: 'finite-overshelf',
      position: { xMm: 0, yMm: 0 },
    })

    expect(overshelfPostGeometry(shelf)).toEqual({ bottomM: .75, heightM: .7 })
  })
})
