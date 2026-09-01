import { describe, expect, it } from 'vitest'
import { KITCHEN_MATERIALS, resolveKitchenMaterial } from './materials'

describe('kitchen PBR materials', () => {
  it('defines visibly distinct physical surfaces', () => {
    expect(KITCHEN_MATERIALS.brushedSteel).toMatchObject({ metalness: 0.88, roughness: 0.24 })
    expect(KITCHEN_MATERIALS.castIron).toMatchObject({ metalness: 0.5, roughness: 0.58 })
    expect(KITCHEN_MATERIALS.blackEnamel.clearcoat).toBeGreaterThan(0)
    expect(KITCHEN_MATERIALS.rubber.metalness).toBe(0)
    expect(KITCHEN_MATERIALS.glass).toMatchObject({ transparent: true, transmission: 0.72 })
    expect(new Set(Object.values(KITCHEN_MATERIALS).map((value) => value.color)).size).toBeGreaterThan(5)
  })

  it('keeps preset values when optional overrides are undefined', () => {
    expect(resolveKitchenMaterial('brushedSteel', { color: undefined, roughness: .4 })).toMatchObject({
      color: KITCHEN_MATERIALS.brushedSteel.color,
      metalness: KITCHEN_MATERIALS.brushedSteel.metalness,
      roughness: .4,
    })
  })
})
