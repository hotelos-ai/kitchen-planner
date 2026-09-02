import { describe, expect, it } from 'vitest'
import { APPEARANCE_SKINS, appearanceSkinSchema } from './appearance-skins'

describe('appearance skins', () => {
  it('exports strict, unique, parsed visual-only metadata', () => {
    expect(Object.isFrozen(APPEARANCE_SKINS)).toBe(true)
    expect(APPEARANCE_SKINS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(APPEARANCE_SKINS.map((skin) => skin.skinId)).size).toBe(APPEARANCE_SKINS.length)
    APPEARANCE_SKINS.forEach((skin) => {
      expect(appearanceSkinSchema.safeParse(skin).success, skin.skinId).toBe(true)
      expect(skin.roughness).toBeGreaterThanOrEqual(0)
      expect(skin.roughness).toBeLessThanOrEqual(1)
      expect(skin.metalness).toBeGreaterThanOrEqual(0)
      expect(skin.metalness).toBeLessThanOrEqual(1)
    })
  })

  it('cannot encode dimensions, capabilities, capacity, clearance, or placement', () => {
    const skin = APPEARANCE_SKINS[0]
    const physicalFields = {
      dimensions: { widthMm: 900 },
      capabilities: ['fryer-cook'],
      capacity: { concurrentUnits: 4 },
      clearance: { frontMm: 1000 },
      placementRules: { requiresWall: true },
    }
    Object.entries(physicalFields).forEach(([field, value]) => {
      expect(appearanceSkinSchema.safeParse({ ...skin, [field]: value }).success, field).toBe(false)
    })
  })
})
