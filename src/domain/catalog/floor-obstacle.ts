import type { EquipmentItem } from '../project'
import { getCatalogEntry } from './kitchen-catalog'

/** Returns whether an equipment item occupies navigable floor area. */
export function isFloorObstacle(item: EquipmentItem): boolean {
  if (item.category === 'hood') return false
  const entry = getCatalogEntry(item.catalogId ?? '')
  const mounting = entry?.placementRules.mounting
  if (mounting === 'overhead') return false
  if (mounting === 'wall' && (entry?.tags.includes('elevated') || entry?.category === 'ventilation-utilities')) return false
  return true
}
