import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { canonicalLayoutHash, canonicalLayoutSnapshot } from './canonical-layout'

describe('canonical layout hash', () => {
  it('deduplicates ordering and insignificant floating noise while retaining physical changes', () => {
    const variant = createSeedProject().variants[0]
    const reordered = { ...variant, equipment: [...variant.equipment].reverse().map((item) => ({ ...item, xMm: item.xMm + .00001 })) }
    expect(canonicalLayoutSnapshot(reordered)).toBe(canonicalLayoutSnapshot(variant))
    expect(canonicalLayoutHash(reordered)).toBe(canonicalLayoutHash(variant))
    reordered.equipment[0].appearanceSkinId = 'appearance-only-change'
    expect(canonicalLayoutHash(reordered)).toBe(canonicalLayoutHash(variant))
    reordered.equipment[0].xMm += 100
    expect(canonicalLayoutHash(reordered)).not.toBe(canonicalLayoutHash(variant))
  })

  it('canonicalizes unordered architecture collections and physical layout constraints', () => {
    const variant = structuredClone(createSeedProject().variants[0])
    const reordered = structuredClone(variant)
    reordered.architecture.openings.reverse()
    reordered.architecture.pillars.reverse()
    reordered.architecture.storageZones.reverse()
    expect(canonicalLayoutHash(reordered)).toBe(canonicalLayoutHash(variant))

    variant.layoutConstraints = { minimumAisleMm: 800, noGoZones: [] }
    expect(canonicalLayoutHash(variant)).not.toBe(canonicalLayoutHash(reordered))
  })
})
