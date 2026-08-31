import { describe, expect, it } from 'vitest'
import { buildNavGrid, findRoute } from './nav-grid'

const room = {
  architecture: {
    widthMm: 2000, depthMm: 2000, wallHeightMm: 2800,
    roomPolygon: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }],
    openings: [], storageZones: [], locked: true,
    pillars: [{ id: 'block', xMm: 900, yMm: 900, widthMm: 200, depthMm: 200 }],
  },
  equipment: [],
}

describe('navigation grid', () => {
  it('routes around equipment and fixed architecture', () => {
    const grid = buildNavGrid(room, 100)
    const route = findRoute(grid, { x: 100, y: 100 }, { x: 1900, y: 1900 })
    expect(route.every((point) => grid.isWalkable(point))).toBe(true)
    expect(route.some((point) => point.x > 900 && point.x < 1100 && point.y > 900 && point.y < 1100)).toBe(false)
  })

  it('reports an unreachable required station', () => {
    const blocked = structuredClone(room)
    blocked.architecture.pillars = [{ id: 'wall', xMm: 900, yMm: 0, widthMm: 200, depthMm: 2000 }]
    const grid = buildNavGrid(blocked, 100)
    expect(grid.isWalkable({ x: 950, y: 1050 })).toBe(false)
    expect(grid.isWalkable({ x: 1050, y: 1050 })).toBe(false)
    expect(() => findRoute(grid, { x: 100, y: 1000 }, { x: 1900, y: 1000 })).toThrow(/unreachable/i)
  })
})
