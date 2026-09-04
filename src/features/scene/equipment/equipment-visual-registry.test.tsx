import { describe, expect, it } from 'vitest'
import { EQUIPMENT_CONFIGURATIONS } from '../../../domain/equipment-configurations'
import { KITCHEN_CATALOG, createCatalogEquipmentItem } from '../../../domain/catalog/kitchen-catalog'
import { createSeedProject } from '../../../domain/seed-project'
import { equipmentVisualDescriptor, getEquipmentVisual } from './equipment-visual-registry'

describe('equipment visual registry', () => {
  it('resolves explicit presets and a generic fallback', () => {
    const tandoor = createSeedProject().variants[0].equipment.find((item) => item.id === 'tandoor')!
    expect(tandoor.visualPreset).toBe('tandoor')
    expect(getEquipmentVisual(tandoor).displayName).toBe('TandoorVisual')
    expect(getEquipmentVisual({ ...tandoor, id: 'unknown', visualPreset: 'unregistered' }).displayName).toBe('GenericEquipmentVisual')
  })

  it.each([
    ['six-burner', ['burner', 'control-knob', 'rear-guard']],
    ['dishwasher', ['door', 'control-panel', 'dish-rack']],
    ['double-sink', ['basin', 'faucet', 'backsplash']],
    ['mixer', ['bowl', 'mixer-head', 'beater']],
  ])('%s exposes recognizable parts', (id, parts) => {
    const item = createSeedProject().variants[0].equipment.find((candidate) => candidate.id === id)!
    expect(equipmentVisualDescriptor(item).parts).toEqual(expect.arrayContaining(parts))
  })

  it.each([
    ['chest-freezer', 'ChestFreezerVisual', ['top-lid', 'hinge', 'handle', 'compressor-vent']],
    ['undercounter-fridge', 'UndercounterFridgeVisual', ['countertop', 'door', 'seal', 'handle']],
    ['four-burner-range', 'FourBurnerVisual', ['burner', 'grate', 'control-knob']],
    ['range-oven', 'RangeOvenVisual', ['burner', 'oven-door', 'control-knob']],
    ['flat-top', 'FlatTopVisual', ['griddle', 'grease-tray', 'control-knob']],
    ['fryer-bank', 'FryerBankVisual', ['fryer-well', 'basket', 'drain-valve']],
    ['enclosed-bench', 'EnclosedBenchVisual', ['worktop', 'sliding-door', 'plinth']],
    ['single-sink', 'SingleSinkVisual', ['basin', 'faucet', 'backsplash']],
    ['pass-through-dishwasher', 'PassThroughDishwasherVisual', ['hood-door', 'rack', 'control-panel']],
    ['island-hood', 'IslandHoodVisual', ['canopy', 'baffle-filter', 'underside-light']],
  ])('%s resolves a recognizable procedural model', (preset, displayName, parts) => {
    const item = { ...createSeedProject().variants[0].equipment[0], visualPreset: preset }
    expect(getEquipmentVisual(item).displayName).toBe(displayName)
    expect(equipmentVisualDescriptor(item).parts).toEqual(expect.arrayContaining(parts))
  })

  it.each([
    ['storage-wall-shelf', 'StorageWallShelfVisual', ['elevated-shelf', 'wall-bracket']],
    ['storage-overshelf', 'StorageOvershelfVisual', ['overshelf-deck', 'support-post']],
    ['storage-rack', 'StorageRackVisual', ['shelf-tier', 'upright-post']],
    ['storage-mobile-rack', 'StorageMobileRackVisual', ['shelf-tier', 'upright-post', 'caster']],
    ['storage-dunnage', 'StorageDunnageVisual', ['raised-platform', 'support-rail']],
    ['storage-bin', 'StorageBinVisual', ['ingredient-bin', 'hinged-lid']],
    ['storage-pot-rack', 'StoragePotRackVisual', ['pot-rail', 'hanging-hook']],
    ['storage-dish-rack', 'StorageDishRackVisual', ['dish-divider', 'drain-tray']],
    ['storage-tray-rack', 'StorageTrayRackVisual', ['tray-runner', 'upright-frame']],
    ['storage-overhead', 'StorageOverheadVisual', ['overhead-deck', 'suspension-rod']],
  ])('%s registers a modular storage constructor and descriptor', (preset, displayName, parts) => {
    const item = { ...createSeedProject().variants[0].equipment[0], category: 'storage' as const, visualPreset: preset }
    expect(getEquipmentVisual(item).displayName).toBe(displayName)
    expect(equipmentVisualDescriptor(item)).toEqual({ preset, parts: expect.arrayContaining(parts) })
  })

  it.each([
    ['waste-mobile-bin', 'waste-mobile-bin', 'WasteMobileBinVisual', ['lidded-bin', 'rear-handle', 'wheels']],
    ['waste-compost-bin', 'waste-compost-bin', 'WasteCompostBinVisual', ['food-waste-bin', 'colored-lid', 'foot-pedal']],
    ['waste-bin-station', 'waste-sorting-station', 'WasteSortingStationVisual', ['three-bin-bank', 'color-coded-lids', 'front-openings']],
  ])('%s registers a recognizable waste-bin model', (catalogId, preset, displayName, parts) => {
    const item = createCatalogEquipmentItem({ catalogId, componentId: catalogId, position: { xMm: 0, yMm: 0 } })
    expect(getEquipmentVisual(item).displayName).toBe(displayName)
    expect(equipmentVisualDescriptor(item)).toEqual({ preset, parts })
  })

  it('registers every catalog visual preset without a generic fallback', () => {
    const base = createSeedProject().variants[0].equipment[0]
    EQUIPMENT_CONFIGURATIONS.forEach((configuration) => {
      expect(getEquipmentVisual({ ...base, visualPreset: configuration.visualPreset }).displayName).not.toBe('GenericEquipmentVisual')
    })
  })

  it('provides a modular constructor and descriptor for every domain catalog entry', () => {
    KITCHEN_CATALOG.forEach((entry, index) => {
      const item = createCatalogEquipmentItem({
        catalogId: entry.catalogId,
        componentId: `catalog-${index}`,
        position: { xMm: 0, yMm: 0 },
      })
      expect(getEquipmentVisual(item).displayName, entry.constructorKey).not.toBe('GenericEquipmentVisual')
      expect(equipmentVisualDescriptor(item)).toMatchObject({ preset: entry.constructorKey })
      expect(equipmentVisualDescriptor(item).parts.length, entry.constructorKey).toBeGreaterThan(1)
    })
  })
})
