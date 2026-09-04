import { isFloorObstacle } from './catalog/floor-obstacle'
import type { EquipmentItem } from './project'

export type PlanLayerAction = 'front' | 'forward' | 'backward' | 'back'

const defaultLayer = (item: EquipmentItem) => {
  if (item.category === 'hood') return -1_000_000
  if (!isFloorObstacle(item)) return 1_000_000
  return 0
}

/** Returns items from the back of the plan to the front. The input array is not mutated. */
export function orderEquipmentForPlan(items: readonly EquipmentItem[]): EquipmentItem[] {
  return items
    .map((item, index) => ({ item, index, order: item.planLayerOrder ?? defaultLayer(item) }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ item }) => item)
}

/** Moves one item through the current visual stack and returns a normalized back-to-front stack. */
export function reorderEquipmentForPlan(
  items: readonly EquipmentItem[],
  itemId: string,
  action: PlanLayerAction,
): EquipmentItem[] {
  const ordered = orderEquipmentForPlan(items)
  const index = ordered.findIndex((item) => item.id === itemId)
  if (index < 0) return ordered
  const target = action === 'front'
    ? ordered.length - 1
    : action === 'back'
      ? 0
      : action === 'forward'
        ? Math.min(ordered.length - 1, index + 1)
        : Math.max(0, index - 1)
  if (target === index) return ordered
  const [item] = ordered.splice(index, 1)
  ordered.splice(target, 0, item)
  return ordered
}
