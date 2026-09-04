import type { EquipmentAccessFlow, EquipmentItem } from './project'

export const DEFAULT_DISHWASHER_ACCESS_FLOW: EquipmentAccessFlow = {
  inputFace: 'front',
  outputFace: 'front',
}

export function accessFlowForConfiguration(configurationId?: string): EquipmentAccessFlow | undefined {
  if (!configurationId) return undefined
  if (configurationId === 'hood-dishwasher-corner' || configurationId === 'wash-pass-through-dishwasher') {
    return { inputFace: 'front', outputFace: 'right' }
  }
  if (configurationId === 'hood-dishwasher-straight') {
    return { inputFace: 'front', outputFace: 'back' }
  }
  if (configurationId.includes('undercounter-dishwasher')) {
    return { ...DEFAULT_DISHWASHER_ACCESS_FLOW }
  }
  return undefined
}

export function equipmentAccessFlow(item: EquipmentItem): EquipmentAccessFlow | undefined {
  return item.accessFlow
    ?? accessFlowForConfiguration(item.configurationPreset)
    ?? (item.capabilities.includes('dish-wash') ? { ...DEFAULT_DISHWASHER_ACCESS_FLOW } : undefined)
}
