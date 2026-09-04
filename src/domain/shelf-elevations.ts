import { physicalConfigurationDetails } from './equipment-configurations'
import type { EquipmentItem } from './project'
import { getCatalogEntry } from './catalog/kitchen-catalog'

export const MIN_SHELF_VERTICAL_GAP_MM = 50
const MAX_SHELF_ELEVATION_MM = 20_000

function orderedNonOverlappingElevations(elevations: readonly number[]): number[] {
  const ordered = elevations
    .map((value) => Math.max(0, Math.min(MAX_SHELF_ELEVATION_MM, value)))
    .sort((left, right) => left - right)
  for (let index = 1; index < ordered.length; index += 1) {
    ordered[index] = Math.max(ordered[index], ordered[index - 1] + MIN_SHELF_VERTICAL_GAP_MM)
  }
  const overflow = Math.max(0, (ordered.at(-1) ?? 0) - MAX_SHELF_ELEVATION_MM)
  return overflow > 0 ? ordered.map((value) => value - overflow) : ordered
}

export function shelfTierCount(item: EquipmentItem): number {
  if (item.category !== 'storage') return 0
  const configuration = physicalConfigurationDetails(item)
  if (configuration.tierCount) return configuration.tierCount
  return item.catalogId ? getCatalogEntry(item.catalogId)?.physicalConfigurations[0]?.tierCount ?? 0 : 0
}

export function defaultShelfElevationsMm(item: EquipmentItem): number[] {
  const configuration = physicalConfigurationDetails(item)
  const count = shelfTierCount(item)
  if (count === 0) return []

  if (configuration.mounting === 'wall' || configuration.mounting === 'overhead') {
    const top = Math.max(450, configuration.elevationMm ?? item.heightMm)
    if (count === 1) return [top]
    const bottom = Math.max(0, top - item.heightMm)
    return Array.from({ length: count }, (_, index) => Math.round(bottom + (top - bottom) * (index / (count - 1))))
  }

  const mobile = configuration.mobile
  const bottom = mobile ? 100 : 40
  const top = Math.max(bottom, item.heightMm - 40)
  if (count === 1) return [top]
  return Array.from({ length: count }, (_, index) => Math.round(bottom + (top - bottom) * (index / (count - 1))))
}

export function shelfElevationsMmForItem(item: EquipmentItem): number[] {
  const defaults = defaultShelfElevationsMm(item)
  return orderedNonOverlappingElevations(defaults.map((fallback, index) => {
    const custom = item.shelfElevationsMm?.[index]
    return Number.isFinite(custom) && custom !== undefined && custom >= 0 ? custom : fallback
  }))
}

export function updateShelfElevationMm(item: EquipmentItem, index: number, nextElevationMm: number): number[] {
  const elevations = shelfElevationsMmForItem(item)
  if (index < 0 || index >= elevations.length) return elevations
  const minimum = index === 0 ? 0 : elevations[index - 1] + MIN_SHELF_VERTICAL_GAP_MM
  const maximum = index === elevations.length - 1
    ? MAX_SHELF_ELEVATION_MM
    : elevations[index + 1] - MIN_SHELF_VERTICAL_GAP_MM
  elevations[index] = Math.max(minimum, Math.min(maximum, nextElevationMm))
  return elevations
}
