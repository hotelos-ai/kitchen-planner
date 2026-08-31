import { rotatedFootprint } from '../domain/geometry'
import type { Architecture, EquipmentItem, PointMm } from '../domain/project'
import type { NavCell, NavGrid } from './types'

type GridInput = { architecture: Architecture; equipment: readonly EquipmentItem[] }

const pointInPolygon = (point: PointMm, polygon: readonly PointMm[]) => {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]
    const b = polygon[previous]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const pointInRect = (point: PointMm, rect: { xMm: number; yMm: number; widthMm: number; depthMm: number }) =>
  point.x >= rect.xMm && point.x < rect.xMm + rect.widthMm && point.y >= rect.yMm && point.y < rect.yMm + rect.depthMm

export function buildNavGrid(input: GridInput, cellSizeMm = 100): NavGrid {
  const widthCells = Math.ceil(input.architecture.widthMm / cellSizeMm)
  const heightCells = Math.ceil(input.architecture.depthMm / cellSizeMm)
  const blocked = new Set<string>()
  const key = (cell: NavCell) => `${cell.x},${cell.y}`
  const toPointMm = (cell: NavCell) => ({ x: cell.x * cellSizeMm + cellSizeMm / 2, y: cell.y * cellSizeMm + cellSizeMm / 2 })
  const equipmentPolygons = input.equipment.filter((item) => item.category !== 'hood').map(rotatedFootprint)
  for (let y = 0; y < heightCells; y += 1) for (let x = 0; x < widthCells; x += 1) {
    const point = toPointMm({ x, y })
    if (!pointInPolygon(point, input.architecture.roomPolygon)
      || input.architecture.pillars.some((pillar) => pointInRect(point, pillar))
      || equipmentPolygons.some((polygon) => pointInPolygon(point, polygon))) blocked.add(key({ x, y }))
  }
  const inBounds = (cell: NavCell) => cell.x >= 0 && cell.y >= 0 && cell.x < widthCells && cell.y < heightCells
  const isWalkableCell = (cell: NavCell) => inBounds(cell) && !blocked.has(key(cell))
  const isWalkable = (point: PointMm) => isWalkableCell({ x: Math.floor(point.x / cellSizeMm), y: Math.floor(point.y / cellSizeMm) })
  const nearestWalkable = (origin: NavCell) => {
    if (isWalkableCell(origin)) return origin
    for (let radius = 1; radius <= Math.max(widthCells, heightCells); radius += 1) {
      for (let y = origin.y - radius; y <= origin.y + radius; y += 1) for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        const candidate = { x, y }
        if ((Math.abs(x - origin.x) === radius || Math.abs(y - origin.y) === radius) && isWalkableCell(candidate)) return candidate
      }
    }
    throw new Error('Required station is unreachable')
  }
  return {
    cellSizeMm, widthCells, heightCells, key, toPointMm, isWalkable, nearestWalkable,
    toCell: (point) => ({ x: Math.max(0, Math.min(widthCells - 1, Math.floor(point.x / cellSizeMm))), y: Math.max(0, Math.min(heightCells - 1, Math.floor(point.y / cellSizeMm))) }),
    walkableNeighbours: (cell) => [{ x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 }].filter(isWalkableCell),
  }
}

export function findRoute(grid: NavGrid, startMm: PointMm, goalMm: PointMm): PointMm[] {
  const start = grid.nearestWalkable(grid.toCell(startMm))
  const goal = grid.nearestWalkable(grid.toCell(goalMm))
  const frontier: { cell: NavCell; priority: number }[] = [{ cell: start, priority: 0 }]
  const cameFrom = new Map<string, NavCell>()
  const cost = new Map<string, number>([[grid.key(start), 0]])
  while (frontier.length) {
    frontier.sort((left, right) => left.priority - right.priority)
    const current = frontier.shift()!.cell
    if (grid.key(current) === grid.key(goal)) {
      const route = [current]
      let cursor = current
      while (cameFrom.has(grid.key(cursor))) { cursor = cameFrom.get(grid.key(cursor))!; route.push(cursor) }
      return route.reverse().map(grid.toPointMm)
    }
    for (const next of grid.walkableNeighbours(current)) {
      const nextCost = cost.get(grid.key(current))! + 1
      if (nextCost < (cost.get(grid.key(next)) ?? Infinity)) {
        cost.set(grid.key(next), nextCost)
        cameFrom.set(grid.key(next), current)
        frontier.push({ cell: next, priority: nextCost + Math.abs(next.x - goal.x) + Math.abs(next.y - goal.y) })
      }
    }
  }
  throw new Error('Required station is unreachable')
}

export const routeDistanceMm = (route: readonly PointMm[]) => route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - route[index].x, point.y - route[index].y), 0)
