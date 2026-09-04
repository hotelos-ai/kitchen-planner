import { expect, it } from 'vitest'
import { createCatalogEquipmentItem } from './catalog/kitchen-catalog'
import { MIN_SHELF_VERTICAL_GAP_MM, shelfElevationsMmForItem, updateShelfElevationMm } from './shelf-elevations'

const rack = () => createCatalogEquipmentItem({
  catalogId: 'storage-freestanding-shelving',
  componentId: 'rack',
  configurationId: 'shelving-four-tier',
  position: { xMm: 0, yMm: 0 },
})

it('orders imported shelf elevations and keeps every deck physically separated', () => {
  const item = { ...rack(), shelfElevationsMm: [635, 305, 305, 120] }

  const elevations = shelfElevationsMmForItem(item)

  expect(elevations).toEqual([120, 305, 355, 635])
  expect(elevations.every((value, index) => index === 0 || value - elevations[index - 1] >= MIN_SHELF_VERTICAL_GAP_MM)).toBe(true)
})

it('constrains an edited shelf between the decks immediately below and above it', () => {
  const item = { ...rack(), shelfElevationsMm: [300, 600, 900, 1200] }

  expect(updateShelfElevationMm(item, 2, 400)).toEqual([300, 600, 650, 1200])
  expect(updateShelfElevationMm(item, 1, 1100)).toEqual([300, 850, 900, 1200])
})
