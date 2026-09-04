import { isFloorObstacle } from '../../domain/catalog/floor-obstacle'
import { polygonsOverlap, rotatedFootprint } from '../../domain/geometry'
import type { EquipmentItem } from '../../domain/project'
import { shelfElevationsMmForItem } from '../../domain/shelf-elevations'
import { physicalConfigurationDetails } from '../../domain/equipment-configurations'

const SUPPORT_GAP_MM = 50

export function isElevatedShelf(item: EquipmentItem): boolean {
  return item.category === 'storage' && !isFloorObstacle(item)
}

export function overshelfPostGeometry(item: EquipmentItem): { bottomM: number; heightM: number } {
  const elevationsM = shelfElevationsMmForItem(item).map((value) => value / 1000)
  const shelfTopM = Math.max(...elevationsM, .45)
  const assemblyHeightM = Math.max(.3, item.heightMm / 1000)
  const bottomM = Math.max(0, shelfTopM - assemblyHeightM)
  return { bottomM, heightM: Math.max(.08, shelfTopM - bottomM) }
}

/**
 * Lifts an elevated shelf just enough to clear the tallest floor item beneath it.
 * Plan draw order never changes physical depth; overlapping footprints represent
 * a vertical table/shelf arrangement for wall-mounted and overhead storage.
 */
export function elevatedShelfOffsetMm(item: EquipmentItem, equipment: readonly EquipmentItem[]): number {
  if (!isElevatedShelf(item)) return 0
  const itemFootprint = rotatedFootprint(item)
  const supportHeightMm = equipment
    .filter((candidate) => candidate.id !== item.id && isFloorObstacle(candidate))
    .filter((candidate) => polygonsOverlap(itemFootprint, rotatedFootprint(candidate)))
    .reduce((height, candidate) => Math.max(height, candidate.heightMm), 0)
  if (supportHeightMm === 0) return 0

  const shelfElevations = shelfElevationsMmForItem(item)
  const configurationElevationMm = physicalConfigurationDetails(item).elevationMm
  const naturalBottomMm = item.catalogId === 'storage-overshelf' && shelfElevations.length
    ? Math.max(0, Math.max(...shelfElevations) - item.heightMm)
    : shelfElevations.length
      ? Math.min(...shelfElevations)
      : configurationElevationMm ?? item.heightMm
  const supportGapMm = item.catalogId === 'storage-overshelf' ? 0 : SUPPORT_GAP_MM
  return Math.max(0, supportHeightMm + supportGapMm - naturalBottomMm)
}
