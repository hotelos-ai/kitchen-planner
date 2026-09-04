/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from 'react'
import { KITCHEN_CATALOG } from '../../../domain/catalog/kitchen-catalog'
import type { EquipmentItem } from '../../../domain/project'
import { BoxPart } from './parts'
import { CatalogEquipmentVisual } from './CatalogVisuals'
import { ChestFreezerVisual, PrepFridgeVisual, TwoDoorFridgeVisual, UndercounterFridgeVisual, UprightFreezerVisual } from './ColdVisuals'
import { CanopyHoodVisual, FlatTopFryerVisual, FlatTopVisual, FourBurnerVisual, FryerBankVisual, IslandHoodVisual, RangeOvenVisual, SixBurnerVisual, TandoorVisual } from './HotLineVisuals'
import { EnclosedBenchVisual, IngredientCounterVisual, LandingTableVisual, MixerVisual, OpenTableVisual } from './PrepVisuals'
import { StorageBinVisual, StorageDishRackVisual, StorageDunnageVisual, StorageMobileRackVisual, StorageOverheadVisual, StorageOvershelfVisual, StoragePotRackVisual, StorageRackVisual, StorageTrayRackVisual, StorageWallShelfVisual } from './StorageVisuals'
import type { EquipmentVisualDescriptor, EquipmentVisualProps } from './types'
import { DishwasherVisual, DoubleSinkVisual, HandwashVisual, PassThroughDishwasherVisual, PreRinseVisual, SingleSinkVisual } from './WashVisuals'
import { WasteCompostBinVisual, WasteMobileBinVisual, WasteSortingStationVisual } from './WasteVisuals'

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
  ['storage-wall-shelf', StorageWallShelfVisual], ['storage-overshelf', StorageOvershelfVisual],
  ['storage-rack', StorageRackVisual], ['storage-mobile-rack', StorageMobileRackVisual],
  ['storage-dunnage', StorageDunnageVisual], ['storage-bin', StorageBinVisual],
  ['storage-pot-rack', StoragePotRackVisual], ['storage-dish-rack', StorageDishRackVisual],
  ['storage-tray-rack', StorageTrayRackVisual], ['storage-overhead', StorageOverheadVisual],
  ['waste-mobile-bin', WasteMobileBinVisual], ['waste-compost-bin', WasteCompostBinVisual], ['waste-sorting-station', WasteSortingStationVisual],
])

const catalogAliases = new Map<string, ComponentType<EquipmentVisualProps>>([
  ['range-six-burner', SixBurnerVisual], ['range-four-burner', FourBurnerVisual],
  ['fryer-twin-basket', FryerBankVisual], ['griddle-flat-top', FlatTopVisual], ['tandoor-round', TandoorVisual],
  ['cold-upright-fridge', UprightFreezerVisual], ['cold-upright-freezer', UprightFreezerVisual],
  ['cold-undercounter-fridge', UndercounterFridgeVisual], ['cold-prep-counter', PrepFridgeVisual], ['cold-chest-freezer', ChestFreezerVisual],
  ['prep-work-table', OpenTableVisual], ['prep-chef-table', EnclosedBenchVisual], ['prep-planetary-mixer', MixerVisual],
  ['wash-pre-rinse-sink', PreRinseVisual], ['wash-undercounter-dishwasher', DishwasherVisual], ['wash-hood-dishwasher', PassThroughDishwasherVisual],
  ['wash-dirty-landing', LandingTableVisual], ['wash-clean-landing', LandingTableVisual], ['sanitation-hand-sink', HandwashVisual],
  ['utility-canopy-hood', CanopyHoodVisual],
  ['storage-wall-shelf', StorageWallShelfVisual], ['storage-overshelf', StorageOvershelfVisual],
  ['storage-freestanding-shelf', StorageRackVisual], ['storage-mobile-rack', StorageMobileRackVisual],
  ['storage-dunnage-rack', StorageDunnageVisual], ['storage-ingredient-bins', StorageBinVisual],
  ['storage-pot-rack', StoragePotRackVisual], ['storage-dish-rack', StorageDishRackVisual],
  ['storage-tray-rack', StorageTrayRackVisual], ['storage-overhead-rack', StorageOverheadVisual],
  ['waste-mobile-bin', WasteMobileBinVisual], ['waste-compost-bin', WasteCompostBinVisual], ['waste-sorting-station', WasteSortingStationVisual],
])

KITCHEN_CATALOG.forEach((entry) => registry.set(entry.constructorKey, catalogAliases.get(entry.constructorKey) ?? CatalogEquipmentVisual))

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
  'storage-wall-shelf': ['elevated-shelf', 'wall-bracket', 'raised-lip'],
  'storage-overshelf': ['overshelf-deck', 'support-post', 'raised-lip'],
  'storage-rack': ['shelf-tier', 'upright-post', 'adjustable-foot'],
  'storage-mobile-rack': ['shelf-tier', 'upright-post', 'caster'],
  'storage-dunnage': ['raised-platform', 'support-rail', 'slat'],
  'storage-bin': ['ingredient-bin', 'hinged-lid', 'pull-handle'],
  'storage-pot-rack': ['pot-rail', 'hanging-hook', 'shelf-tier'],
  'storage-dish-rack': ['dish-divider', 'drain-tray', 'rack-frame'],
  'storage-tray-rack': ['tray-runner', 'upright-frame', 'shelf-tier'],
  'storage-overhead': ['overhead-deck', 'suspension-rod', 'raised-lip'],
  'waste-mobile-bin': ['lidded-bin', 'rear-handle', 'wheels'],
  'waste-compost-bin': ['food-waste-bin', 'colored-lid', 'foot-pedal'],
  'waste-sorting-station': ['three-bin-bank', 'color-coded-lids', 'front-openings'],
}

KITCHEN_CATALOG.forEach((entry) => {
  descriptors[entry.constructorKey] ??= [entry.familyId, entry.footprint.shape, ...entry.tags.slice(0, 3)]
})

export function registerEquipmentVisual(preset: string, component: ComponentType<EquipmentVisualProps>): void { registry.set(preset, component) }
export function getEquipmentVisual(item: EquipmentItem): ComponentType<EquipmentVisualProps> { return registry.get(item.visualPreset ?? '') ?? GenericEquipmentVisual }
export function equipmentVisualDescriptor(item: EquipmentItem): EquipmentVisualDescriptor {
  const preset = item.visualPreset ?? 'generic'
  return { preset, parts: [...(descriptors[preset] ?? ['body', 'footprint'])] }
}

export type { EquipmentVisualProps }
