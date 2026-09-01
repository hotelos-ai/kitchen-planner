import { describe, expect, it } from 'vitest'
import { createSeedProject } from './seed-project'
import {
  applyEquipmentConfiguration,
  EQUIPMENT_CONFIGURATIONS,
  inferEquipmentConfiguration,
  isEquipmentConfigurationModified,
  listCompatibleConfigurations,
} from './equipment-configurations'

describe('equipment configurations', () => {
  const item = createSeedProject().variants[0].equipment.find((value) => value.id === 'two-door-fridge')!

  it('offers the complete refrigeration family for a two-door fridge', () => {
    expect(listCompatibleConfigurations(item).map((value) => value.id)).toEqual([
      'cold-upright-single',
      'cold-upright-double',
      'cold-undercounter',
      'cold-prep-counter',
      'cold-chest-freezer',
    ])
  })

  it('offers all families when intentionally converting a custom component', () => {
    expect(listCompatibleConfigurations({ ...item, category: 'custom', configurationPreset: undefined })).toHaveLength(EQUIPMENT_CONFIGURATIONS.length)
  })

  it('applies a configuration while preserving placement, rotation, permissions, and notes', () => {
    const configured = applyEquipmentConfiguration({ ...item, rotationDeg: 90 }, 'cold-chest-freezer')
    expect(configured).toMatchObject({
      id: item.id,
      xMm: item.xMm,
      yMm: item.yMm,
      rotationDeg: 90,
      movable: item.movable,
      removable: item.removable,
      notes: item.notes,
      label: 'Chest freezer',
      category: 'cold',
      widthMm: 1200,
      depthMm: 700,
      heightMm: 850,
      capabilities: ['cold-retrieval'],
      visualPreset: 'chest-freezer',
      configurationPreset: 'cold-chest-freezer',
      dimensionsLocked: false,
    })
    expect(configured.clearance).toEqual({ kind: 'door-swing', frontMm: 700 })
  })

  it('infers known seed equipment and detects manual modification', () => {
    expect(inferEquipmentConfiguration(item)).toBe('cold-upright-double')
    expect(isEquipmentConfigurationModified({ ...item, configurationPreset: 'cold-upright-double' })).toBe(true)
    expect(isEquipmentConfigurationModified(applyEquipmentConfiguration(item, 'cold-upright-double'))).toBe(false)
    expect(isEquipmentConfigurationModified({
      ...applyEquipmentConfiguration(item, 'cold-upright-double'),
      widthMm: item.widthMm + 100,
    })).toBe(true)
  })

  it('rejects an incompatible or unknown configuration without mutating the item', () => {
    const before = structuredClone(item)
    expect(() => applyEquipmentConfiguration(item, 'hot-tandoor')).toThrow(/not compatible/i)
    expect(() => applyEquipmentConfiguration(item, 'missing-configuration')).toThrow(/unknown/i)
    expect(item).toEqual(before)
  })

  it('does not guess when a visual preset or capability match is ambiguous', () => {
    expect(inferEquipmentConfiguration({
      ...item,
      id: 'custom-landing',
      category: 'landing',
      configurationPreset: undefined,
      visualPreset: 'landing-table',
      capabilities: [],
    })).toBeUndefined()
  })
})
