import { describe, expect, it } from 'vitest'
import { rectangularArchitecture } from './blank-project'
import { doorSwingGeometry } from './opening-geometry'

describe('door swing geometry', () => {
  it('supports either hinge and inward or outward opening paths', () => {
    const architecture = rectangularArchitecture(4_000, 3_000)
    const door = architecture.openings[0]
    const inwardStart = doorSwingGeometry(architecture, door)!
    const outwardEnd = doorSwingGeometry(architecture, {
      ...door,
      swingHinge: 'end',
      swingDirection: 'outward',
    })!

    expect(inwardStart.hinge).toEqual({ x: 2_450, y: 3_000 })
    expect(inwardStart.openEnd.y).toBeLessThan(3_000)
    expect(outwardEnd.hinge).toEqual({ x: 1_550, y: 3_000 })
    expect(outwardEnd.openEnd.y).toBeGreaterThan(3_000)
  })
})
