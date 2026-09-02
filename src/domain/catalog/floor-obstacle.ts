import type { EquipmentItem } from '../project'
import { getCatalogEntry } from './kitchen-catalog'

const WALK_UNDER_CLEARANCE_MM = 1_400

/** Returns whether an equipment item occupies navigable floor area. */
export function isFloorObstacle(item: EquipmentItem): boolean {
  if (item.category === 'hood') return false
  const entry = item.catalogId ? getCatalogEntry(item.catalogId) : undefined
  const mounting = entry?.placementRules.mounting
  const preset = entry?.physicalConfigurations.find((candidate) => candidate.id === item.configurationPreset)
  if (preset) return (preset.elevationMm ?? 0) < WALK_UNDER_CLEARANCE_MM
  if (mounting === 'overhead') return false
  if (mounting === 'wall' && (entry?.tags.includes('elevated') || entry?.category === 'ventilation-utilities')) return false
  return true
}
