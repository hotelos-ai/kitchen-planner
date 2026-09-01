import { describe, expect, it } from 'vitest'
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
})
