import { describe, expect, it } from 'vitest'
import type { Architecture, EquipmentItem } from '../../domain/project'
import { fixByBoundary, fixByRearranging, itemInsideRoom, parkOutside } from './auto-fix'

const architecture: Architecture = {
  widthMm: 3000,
  depthMm: 2000,
  wallHeightMm: 2800,
  roomPolygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }, { x: 0, y: 2000 }],
  openings: [],
  pillars: [],
  storageZones: [],
  locked: false,
}

const item = (id: string, xMm: number, yMm: number, widthMm = 600, depthMm = 600): EquipmentItem => ({
  id, label: id, category: 'prep', xMm, yMm, widthMm, depthMm, heightMm: 850, rotationDeg: 0,
  dimensionsLocked: false, movable: true, removable: true, capabilities: [], notes: '',
} as unknown as EquipmentItem)

describe('auto-fix', () => {
  it('pulls an outside item back inside the room', () => {
    const moves = fixByRearranging(architecture, [item('outside', 3200, 1000)], 100)
    expect(moves).toHaveLength(1)
    const moved = { ...item('outside', moves[0].xMm, moves[0].yMm) }
    expect(itemInsideRoom(moved, architecture)).toBe(true)
  })

  it('separates two overlapping items without moving the larger one far', () => {
    const big = item('big', 1000, 1000, 1200, 800)
    const small = item('small', 1200, 1000)
    const moves = fixByRearranging(architecture, [big, small], 100)
    const applied = [big, small].map((original) => {
      const move = moves.find((entry) => entry.id === original.id)
      return move ? { ...original, xMm: move.xMm, yMm: move.yMm } : original
    })
    const a = applied[0]; const b = applied[1]
    const overlap = a.xMm - a.widthMm / 2 < b.xMm + b.widthMm / 2 && b.xMm - b.widthMm / 2 < a.xMm + a.widthMm / 2
      && a.yMm - a.depthMm / 2 < b.yMm + b.depthMm / 2 && b.yMm - b.depthMm / 2 < a.yMm + a.depthMm / 2
    expect(overlap).toBe(false)
    expect(applied.every((entry) => itemInsideRoom(entry, architecture))).toBe(true)
  })

  it('leaves a clean layout untouched', () => {
    const moves = fixByRearranging(architecture, [item('fine', 800, 1000), item('fine2', 2000, 1000)], 100)
    expect(moves).toHaveLength(0)
  })

  it('expands the boundary to contain equipment that sticks out', () => {
    const next = fixByBoundary(architecture, [item('spill', 3400, 2600)], 100)
    expect(next.widthMm).toBeGreaterThanOrEqual(3700)
    expect(next.depthMm).toBeGreaterThanOrEqual(2900)
    expect(itemInsideRoom(item('spill', 3400, 2600), next)).toBe(true)
  })

  it('returns the architecture unchanged when everything already fits', () => {
    expect(fixByBoundary(architecture, [item('fine', 1000, 1000)], 100)).toBe(architecture)
  })
})

describe('parking outside the room', () => {
  it('stages newcomers to the right of the room in a racked column', () => {
    const moves = parkOutside(architecture, [item('a', 0, 0), item('b', 0, 0, 800, 400)], [], 100)
    expect(moves).toHaveLength(2)
    expect(moves[0].xMm).toBeGreaterThanOrEqual(architecture.widthMm)
    expect(moves[1].xMm).toBe(moves[0].xMm)
    expect(moves[1].yMm).toBeGreaterThan(moves[0].yMm)
    expect(moves[1].yMm - moves[0].yMm).toBeGreaterThanOrEqual(1000)
  })
})
