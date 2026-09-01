import type { EquipmentItem } from '../../domain/project'

export type EquipmentSelectionDescriptor = {
  shape: 'cuboid'
  widthM: number
  depthM: number
  heightM: number
  ring: false
}

export function equipmentSelectionDescriptor(item: EquipmentItem): EquipmentSelectionDescriptor {
  return {
    shape: 'cuboid',
    widthM: item.widthMm / 1000,
    depthM: item.depthMm / 1000,
    heightM: item.heightMm / 1000,
    ring: false,
  }
}
