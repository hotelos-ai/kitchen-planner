/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from 'react'
import type { EquipmentItem } from '../../../domain/project'
import { BoxPart } from './parts'
import { ChestFreezerVisual, PrepFridgeVisual, TwoDoorFridgeVisual, UndercounterFridgeVisual, UprightFreezerVisual } from './ColdVisuals'
import { CanopyHoodVisual, FlatTopFryerVisual, FlatTopVisual, FourBurnerVisual, FryerBankVisual, IslandHoodVisual, RangeOvenVisual, SixBurnerVisual, TandoorVisual } from './HotLineVisuals'
import { EnclosedBenchVisual, IngredientCounterVisual, LandingTableVisual, MixerVisual, OpenTableVisual } from './PrepVisuals'
import type { EquipmentVisualDescriptor, EquipmentVisualProps } from './types'
import { DishwasherVisual, DoubleSinkVisual, HandwashVisual, PassThroughDishwasherVisual, PreRinseVisual, SingleSinkVisual } from './WashVisuals'

export function GenericEquipmentVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  return <BoxPart position={[0, heightM / 2, 0]} size={[widthM, heightM, depthM]} color="#8b8173" />
}
GenericEquipmentVisual.displayName = 'GenericEquipmentVisual'

const registry = new Map<string, ComponentType<EquipmentVisualProps>>([
  ['flat-top-fryer', FlatTopFryerVisual], ['flat-top', FlatTopVisual], ['fryer-bank', FryerBankVisual],
  ['four-burner-range', FourBurnerVisual], ['six-burner-range', SixBurnerVisual], ['range-oven', RangeOvenVisual], ['tandoor', TandoorVisual],
  ['upright-freezer', UprightFreezerVisual], ['two-door-fridge', TwoDoorFridgeVisual], ['undercounter-fridge', UndercounterFridgeVisual], ['prep-fridge', PrepFridgeVisual], ['chest-freezer', ChestFreezerVisual],
  ['double-sink', DoubleSinkVisual], ['single-sink', SingleSinkVisual], ['handwash-sink', HandwashVisual], ['pre-rinse-sink', PreRinseVisual], ['dishwasher', DishwasherVisual], ['pass-through-dishwasher', PassThroughDishwasherVisual],
  ['open-table', OpenTableVisual], ['enclosed-bench', EnclosedBenchVisual], ['ingredient-counter', IngredientCounterVisual], ['landing-table', LandingTableVisual], ['mixer', MixerVisual],
  ['canopy-hood', CanopyHoodVisual], ['island-hood', IslandHoodVisual],
])

const descriptors: Record<string, string[]> = {
  'flat-top-fryer': ['griddle', 'fryer-well', 'fryer-basket', 'control-knob', 'rear-guard', 'under-storage'],
  'flat-top': ['griddle', 'grease-tray', 'control-knob', 'rear-guard', 'under-storage'],
  'fryer-bank': ['fryer-well', 'basket', 'control-knob', 'drain-valve'],
  'four-burner-range': ['burner', 'grate', 'control-knob', 'rear-guard'],
  'six-burner-range': ['burner', 'grate', 'control-knob', 'rear-guard'],
  'range-oven': ['burner', 'grate', 'control-knob', 'oven-door', 'glass-panel'],
  tandoor: ['faceted-body', 'oven-mouth', 'protective-rim'],
  'upright-freezer': ['door', 'handle', 'hinge', 'vent', 'feet'],
  'two-door-fridge': ['two-doors', 'handle', 'hinge', 'vent', 'feet'],
  'undercounter-fridge': ['countertop', 'door', 'seal', 'handle', 'compressor-vent'],
  'prep-fridge': ['refrigerated-base', 'door', 'handle', 'worktop', 'ingredient-pan'],
  'chest-freezer': ['top-lid', 'hinge', 'handle', 'compressor-vent'],
  'double-sink': ['basin', 'faucet', 'backsplash', 'legs'],
  'single-sink': ['basin', 'faucet', 'backsplash', 'legs'],
  'handwash-sink': ['basin', 'faucet', 'backsplash'],
  'pre-rinse-sink': ['basin', 'faucet', 'backsplash', 'spray-riser', 'nozzle'],
  dishwasher: ['door', 'handle', 'control-panel', 'dish-rack'],
  'pass-through-dishwasher': ['hood-door', 'rack', 'control-panel', 'lift-handle', 'rear-body'],
  'open-table': ['worktop', 'legs', 'undershelf'],
  'enclosed-bench': ['worktop', 'sliding-door', 'plinth'],
  'ingredient-counter': ['worktop', 'sliding-door', 'ingredient-pan', 'raised-rail'],
  'landing-table': ['worktop', 'legs', 'undershelf'],
  mixer: ['pedestal', 'bowl', 'mixer-head', 'beater'],
  'canopy-hood': ['canopy', 'baffle-filter', 'underside-light'],
  'island-hood': ['canopy', 'baffle-filter', 'underside-light', 'suspension-rod'],
}

export function registerEquipmentVisual(preset: string, component: ComponentType<EquipmentVisualProps>): void { registry.set(preset, component) }
export function getEquipmentVisual(item: EquipmentItem): ComponentType<EquipmentVisualProps> { return registry.get(item.visualPreset ?? '') ?? GenericEquipmentVisual }
export function equipmentVisualDescriptor(item: EquipmentItem): EquipmentVisualDescriptor {
  const preset = item.visualPreset ?? 'generic'
  return { preset, parts: [...(descriptors[preset] ?? ['body', 'footprint'])] }
}

export type { EquipmentVisualProps }
