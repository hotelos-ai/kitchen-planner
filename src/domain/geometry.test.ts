import { describe, expect, it } from 'vitest'
import type { EquipmentItem, PointMm } from './project'
import { normalizeRotation, polygonsOverlap, rotateInPlace, rotatedFootprint, snapMm } from './geometry'

const item = (overrides: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: 'station',
  label: 'Station',
  category: 'prep',
  widthMm: 1200,
  depthMm: 700,
  heightMm: 850,
  xMm: 100,
  yMm: 200,
  rotationDeg: 0,
  dimensionsLocked: true,
  movable: true,
  removable: true,
  capabilities: [],
  ...overrides,
})

describe('metric geometry', () => {
  it('snaps source-grid movement to 100 millimetres', () => {
    expect(snapMm(1249, 100)).toBe(1200)
    expect(snapMm(1251, 100)).toBe(1300)
  })

  it('normalizes clockwise and counter-clockwise rotations', () => {
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(450)).toBe(90)
  })

  it('returns the footprint corners for an unrotated item', () => {
    expect(rotatedFootprint(item())).toEqual([
      { x: 100, y: 200 },
      { x: 1300, y: 200 },
      { x: 1300, y: 900 },
      { x: 100, y: 900 },
    ])
  })

  it('keeps the footprint center fixed while rotating', () => {
    const source = item()
    const rotated = { ...source, ...rotateInPlace(source, 90) }
    const center = (points: PointMm[]) => ({
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    })

    expect(rotated.rotationDeg).toBe(90)
    expect(center(rotatedFootprint(rotated))).toEqual(center(rotatedFootprint(source)))
    expect({ ...rotated, ...rotateInPlace(rotated, -90) }).toMatchObject({ xMm: source.xMm, yMm: source.yMm, rotationDeg: 0 })
  })

  it('treats touching edges as clear but detects area overlap', () => {
    const first: PointMm[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
    const touching: PointMm[] = [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }]
    const overlapping: PointMm[] = [{ x: 90, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 90, y: 100 }]
    expect(polygonsOverlap(first, touching)).toBe(false)
    expect(polygonsOverlap(first, overlapping)).toBe(true)
  })
})
