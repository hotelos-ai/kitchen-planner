import { describe, expect, it } from 'vitest'
import { EQUIPMENT_CONFIGURATIONS } from '../../../domain/equipment-configurations'
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

  it('registers every catalog visual preset without a generic fallback', () => {
    const base = createSeedProject().variants[0].equipment[0]
    EQUIPMENT_CONFIGURATIONS.forEach((configuration) => {
      expect(getEquipmentVisual({ ...base, visualPreset: configuration.visualPreset }).displayName).not.toBe('GenericEquipmentVisual')
    })
  })
})
