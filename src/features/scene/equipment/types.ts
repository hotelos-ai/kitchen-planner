import type { EquipmentItem } from '../../../domain/project'

export type EquipmentVisualProps = {
  item: EquipmentItem
  widthM: number
  depthM: number
  heightM: number
}

export type EquipmentVisualDescriptor = { preset: string; parts: string[] }
