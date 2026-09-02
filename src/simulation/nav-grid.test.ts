import { describe, expect, it } from 'vitest'
import type { EquipmentItem } from '../domain/project'
import { buildNavGrid, findRoute, stationApproachPoints } from './nav-grid'

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

  it('closes bottlenecks narrower than the body diameter or user minimum aisle', () => {
    const bottleneck = structuredClone(room)
    bottleneck.architecture.widthMm = 2400
    bottleneck.architecture.roomPolygon = [{ x: 0, y: 0 }, { x: 2400, y: 0 }, { x: 2400, y: 2000 }, { x: 0, y: 2000 }]
    bottleneck.architecture.pillars = [
      { id: 'upper', xMm: 1050, yMm: 0, widthMm: 300, depthMm: 750 },
      { id: 'lower', xMm: 1050, yMm: 1250, widthMm: 300, depthMm: 750 },
    ]

    const narrowBody = buildNavGrid(bottleneck, 100, { bodyRadiusMm: 150 })
    expect(findRoute(narrowBody, { x: 500, y: 1000 }, { x: 1900, y: 1000 }).length).toBeGreaterThan(0)

    const standardBody = buildNavGrid(bottleneck, 100, { bodyRadiusMm: 260 })
    expect(() => findRoute(standardBody, { x: 500, y: 1000 }, { x: 1900, y: 1000 })).toThrow(/unreachable/i)

    const minimumAisle = buildNavGrid(bottleneck, 100, { bodyRadiusMm: 100, minimumAisleMm: 600 })
    expect(() => findRoute(minimumAisle, { x: 500, y: 1000 }, { x: 1900, y: 1000 })).toThrow(/unreachable/i)
  })

  it('blocks generic no-go zones and derives catalog approach faces through rotation', () => {
    const noGoGrid = buildNavGrid({
      ...room,
      layoutConstraints: { noGoZones: [{ id: 'protected-services', xMm: 700, yMm: 0, widthMm: 600, depthMm: 2000 }] },
    }, 100, { bodyRadiusMm: 100 })
    expect(() => findRoute(noGoGrid, { x: 300, y: 1000 }, { x: 1700, y: 1000 })).toThrow(/unreachable/i)

    const item: EquipmentItem = {
      id: 'rotated-range', catalogId: 'hot-six-burner-range', label: 'Rotated range', category: 'cooking',
      widthMm: 1200, depthMm: 900, heightMm: 900, xMm: 1000, yMm: 2000, rotationDeg: 90,
      dimensionsLocked: false, movable: true, removable: true, capabilities: ['range-cook'],
    }
    expect(stationApproachPoints(item)).toEqual([{ x: -50, y: 2600 }])
    expect(stationApproachPoints(item, 'left')).toEqual([{ x: 550, y: 1850 }])
    expect(stationApproachPoints(item, 'either-side')).toEqual([{ x: 550, y: 1850 }, { x: 550, y: 3350 }])
  })

  it('does not treat wall and overhead storage as floor navigation obstacles', () => {
    const elevated = (catalogId: string): EquipmentItem => ({
      id: catalogId, catalogId, label: catalogId, category: 'storage', widthMm: 1800, depthMm: 1800,
      heightMm: 500, xMm: 100, yMm: 100, rotationDeg: 0, dimensionsLocked: false,
      movable: true, removable: true, capabilities: [],
    })
    const grid = buildNavGrid({ ...room, architecture: { ...room.architecture, pillars: [] }, equipment: [
      elevated('storage-wall-shelf'), elevated('storage-overhead-rack'),
    ] }, 100, { bodyRadiusMm: 0 })
    expect(grid.isWalkable({ x: 500, y: 500 })).toBe(true)
  })
})
