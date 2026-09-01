import { describe, expect, it } from 'vitest'
import { advanceVerticalMotion, cameraRelativeRight, jumpVelocityForObstacle } from './walk-motion'

describe('walk motion', () => {
  it('maps camera forward to the conventional right vector', () => {
    expect(cameraRelativeRight({ x: 0, y: -1 })).toEqual({ x: 1, y: 0 })
    expect(cameraRelativeRight({ x: 1, y: 0 })).toEqual({ x: 0, y: 1 })
  })

  it('calculates enough impulse to clear low and tall equipment', () => {
    const low = jumpVelocityForObstacle({ obstacleTopMm: 850, supportHeightMm: 0 })
    const tall = jumpVelocityForObstacle({ obstacleTopMm: 1950, supportHeightMm: 0 })
    expect((low * low) / (2 * 9.81) * 1000).toBeGreaterThanOrEqual(1029)
    expect((tall * tall) / (2 * 9.81) * 1000).toBeGreaterThanOrEqual(2129)
    expect(tall).toBeGreaterThan(low)
  })

  it('lands while crossing a support top and falls after walking off it', () => {
    expect(advanceVerticalMotion(
      { footHeightMm: 900, velocityMps: -1, grounded: false },
      .1,
      850,
    )).toEqual({ footHeightMm: 850, velocityMps: 0, grounded: true })

    const falling = advanceVerticalMotion(
      { footHeightMm: 850, velocityMps: 0, grounded: true },
      .1,
      0,
    )
    expect(falling.grounded).toBe(false)
    expect(falling.footHeightMm).toBeLessThan(850)
  })

  it('never falls below the floor support', () => {
    expect(advanceVerticalMotion(
      { footHeightMm: 20, velocityMps: -4, grounded: false },
      .1,
      0,
    )).toEqual({ footHeightMm: 0, velocityMps: 0, grounded: true })
  })
})
