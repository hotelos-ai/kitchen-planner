import { physicalConfigurationDetails } from './equipment-configurations'
import type { EquipmentItem } from './project'
import { getCatalogEntry } from './catalog/kitchen-catalog'

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
    const spacing = item.catalogId === 'storage-wall-shelf' ? 280 : 300
    return Array.from({ length: count }, (_, index) => Math.max(0, top - spacing * (count - index - 1)))
  }

  const mobile = configuration.mobile
  const bottom = mobile ? 100 : 40
  const top = Math.max(bottom, item.heightMm - 40)
  if (count === 1) return [top]
  return Array.from({ length: count }, (_, index) => Math.round(bottom + (top - bottom) * (index / (count - 1))))
}

export function shelfElevationsMmForItem(item: EquipmentItem): number[] {
  const defaults = defaultShelfElevationsMm(item)
  return defaults.map((fallback, index) => {
    const custom = item.shelfElevationsMm?.[index]
    return Number.isFinite(custom) && custom !== undefined && custom >= 0 ? custom : fallback
  })
}
