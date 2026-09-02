import { pointInPolygon, rotatedFootprint } from '../domain/geometry'
import { getCatalogEntry } from '../domain/catalog/kitchen-catalog'
import type { CatalogEntry } from '../domain/catalog/types'
import type { Architecture, EquipmentItem, LayoutConstraints, PointMm, RectMm } from '../domain/project'
import type { NavCell, NavGrid } from './types'

type GridInput = {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  layoutConstraints?: Pick<LayoutConstraints, 'minimumAisleMm' | 'noGoZones'>
}

export type NavigationClearance = { bodyRadiusMm?: number; minimumAisleMm?: number }
export type IntendedApproachFace = CatalogEntry['intendedApproachFace']

// The 100 mm grid already rasterizes solid footprints by up to half a cell;
// this additional radius prevents point-mass routing without invalidating
// legacy traced layouts. New planning rules can supply the actual body radius.
export const DEFAULT_NAVIGATION_BODY_RADIUS_MM = 50

const rectPolygon = (rect: RectMm): PointMm[] => [
  { x: rect.xMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm },
  { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const distanceToSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy || 1
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - start.x - dx * amount, point.y - start.y - dy * amount)
}

const boundaryDistance = (point: PointMm, polygon: readonly PointMm[]) => Math.min(...polygon.map((start, index) =>
  distanceToSegment(point, start, polygon[(index + 1) % polygon.length])))

const pointBlockedByInflatedPolygon = (point: PointMm, polygon: PointMm[], clearanceMm: number) =>
  pointInPolygon(point, polygon) || boundaryDistance(point, polygon) < clearanceMm

const transformLocalPoint = (item: EquipmentItem, local: PointMm): PointMm => {
  const radians = item.rotationDeg * Math.PI / 180
  const stable = (value: number) => Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value
  return {
    x: stable(item.xMm + local.x * Math.cos(radians) - local.y * Math.sin(radians)),
    y: stable(item.yMm + local.x * Math.sin(radians) + local.y * Math.cos(radians)),
  }
}

export function stationApproachPoints(
  item: EquipmentItem,
  face?: IntendedApproachFace,
  offsetMm = 150,
): PointMm[] {
  const localPoints: Partial<Record<Exclude<IntendedApproachFace, 'either-side' | 'none'>, PointMm>> = {
    front: { x: item.widthMm / 2, y: item.depthMm + offsetMm },
    back: { x: item.widthMm / 2, y: -offsetMm },
    left: { x: -offsetMm, y: item.depthMm / 2 },
    right: { x: item.widthMm + offsetMm, y: item.depthMm / 2 },
  }
  const intendedFace = face ?? getCatalogEntry(item.catalogId ?? '')?.intendedApproachFace
  if (intendedFace === 'none') return []
  const faces: ('front' | 'back' | 'left' | 'right')[] = intendedFace === 'either-side'
    ? ['left', 'right']
    : intendedFace
      ? [intendedFace]
      : ['front', 'back', 'left', 'right']
  return faces.map((approach) => transformLocalPoint(item, localPoints[approach as keyof typeof localPoints]!))
}

export function buildNavGrid(input: GridInput, cellSizeMm = 100, clearance: NavigationClearance = {}): NavGrid {
  const widthCells = Math.ceil(input.architecture.widthMm / cellSizeMm)
  const heightCells = Math.ceil(input.architecture.depthMm / cellSizeMm)
  const blocked = new Set<string>()
  const key = (cell: NavCell) => `${cell.x},${cell.y}`
  const toPointMm = (cell: NavCell) => ({ x: cell.x * cellSizeMm + cellSizeMm / 2, y: cell.y * cellSizeMm + cellSizeMm / 2 })
  const bodyRadiusMm = Math.max(0, clearance.bodyRadiusMm ?? DEFAULT_NAVIGATION_BODY_RADIUS_MM)
  const minimumAisleMm = Math.max(0, clearance.minimumAisleMm ?? input.layoutConstraints?.minimumAisleMm ?? 0)
  const obstacleClearanceMm = Math.max(bodyRadiusMm, minimumAisleMm / 2)
  const equipmentPolygons = input.equipment.filter((item) => item.category !== 'hood').map(rotatedFootprint)
  const pillarPolygons = input.architecture.pillars.map(rectPolygon)
  const noGoPolygons = (input.layoutConstraints?.noGoZones ?? []).map(rectPolygon)
  const obstaclePolygons = [...equipmentPolygons, ...pillarPolygons, ...noGoPolygons]

  for (let y = 0; y < heightCells; y += 1) for (let x = 0; x < widthCells; x += 1) {
    const point = toPointMm({ x, y })
    if (!pointInPolygon(point, input.architecture.roomPolygon)
      || boundaryDistance(point, input.architecture.roomPolygon) < obstacleClearanceMm
      || obstaclePolygons.some((polygon) => pointBlockedByInflatedPolygon(point, polygon, obstacleClearanceMm))) blocked.add(key({ x, y }))
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
