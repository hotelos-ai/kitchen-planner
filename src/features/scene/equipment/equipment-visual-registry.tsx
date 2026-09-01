/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from 'react'
import type { EquipmentItem } from '../../../domain/project'
import { BoxPart } from './parts'
import { PrepFridgeVisual, TwoDoorFridgeVisual, UprightFreezerVisual } from './ColdVisuals'
import { CanopyHoodVisual, FlatTopFryerVisual, SixBurnerVisual, TandoorVisual } from './HotLineVisuals'
import { LandingTableVisual, MixerVisual, OpenTableVisual } from './PrepVisuals'
import type { EquipmentVisualDescriptor, EquipmentVisualProps } from './types'
import { DishwasherVisual, DoubleSinkVisual, HandwashVisual, PreRinseVisual } from './WashVisuals'

export function GenericEquipmentVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  return <BoxPart position={[0, heightM / 2, 0]} size={[widthM, heightM, depthM]} color="#8b8173" />
}
GenericEquipmentVisual.displayName = 'GenericEquipmentVisual'

const registry = new Map<string, ComponentType<EquipmentVisualProps>>([
  ['flat-top-fryer', FlatTopFryerVisual], ['six-burner-range', SixBurnerVisual], ['tandoor', TandoorVisual],
  ['upright-freezer', UprightFreezerVisual], ['two-door-fridge', TwoDoorFridgeVisual], ['prep-fridge', PrepFridgeVisual],
  ['double-sink', DoubleSinkVisual], ['handwash-sink', HandwashVisual], ['pre-rinse-sink', PreRinseVisual], ['dishwasher', DishwasherVisual],
  ['open-table', OpenTableVisual], ['landing-table', LandingTableVisual], ['mixer', MixerVisual], ['canopy-hood', CanopyHoodVisual],
])

const descriptors: Record<string, string[]> = {
  'flat-top-fryer': ['griddle', 'fryer-well', 'fryer-basket', 'control-knob', 'rear-guard', 'under-storage'],
  'six-burner-range': ['burner', 'grate', 'control-knob', 'rear-guard'],
  tandoor: ['faceted-body', 'oven-mouth', 'protective-rim'],
  'upright-freezer': ['door', 'handle', 'hinge', 'vent', 'feet'],
  'two-door-fridge': ['two-doors', 'handle', 'hinge', 'vent', 'feet'],
  'prep-fridge': ['refrigerated-base', 'door', 'handle', 'worktop', 'ingredient-pan'],
  'double-sink': ['basin', 'faucet', 'backsplash', 'legs'],
  'handwash-sink': ['basin', 'faucet', 'backsplash'],
  'pre-rinse-sink': ['basin', 'faucet', 'backsplash', 'spray-riser', 'nozzle'],
  dishwasher: ['door', 'handle', 'control-panel', 'dish-rack'],
  'open-table': ['worktop', 'legs', 'undershelf'],
  'landing-table': ['worktop', 'legs', 'undershelf'],
  mixer: ['pedestal', 'bowl', 'mixer-head', 'beater'],
  'canopy-hood': ['canopy', 'baffle-filter', 'underside-light'],
}

export function registerEquipmentVisual(preset: string, component: ComponentType<EquipmentVisualProps>): void { registry.set(preset, component) }
export function getEquipmentVisual(item: EquipmentItem): ComponentType<EquipmentVisualProps> { return registry.get(item.visualPreset ?? '') ?? GenericEquipmentVisual }
export function equipmentVisualDescriptor(item: EquipmentItem): EquipmentVisualDescriptor {
  const preset = item.visualPreset ?? 'generic'
  return { preset, parts: [...(descriptors[preset] ?? ['body', 'footprint'])] }
}

export type { EquipmentVisualProps }
