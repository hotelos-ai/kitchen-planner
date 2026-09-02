import { pointInPolygon, polygonsOverlap, rotatedFootprint } from '../geometry'
import { isFloorObstacle } from './floor-obstacle'
import type { Architecture, EquipmentItem, LayoutConstraints, Opening, PointMm, RectMm } from '../project'

type PlacementEntry = {
  typicalDimensions: {
    widthMm: number
    depthMm: number
    heightMm: number
  }
  placementRules?: { mounting: 'floor' | 'wall' | 'overhead' | 'counter' | 'architectural'; requiresWall: boolean; keepClearOfOpeningsMm?: number }
}

export type CatalogPlacement = { xMm: number; yMm: number; rotationDeg: 0 }

export type CatalogPlacementInput = {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  entry: PlacementEntry
  snapMm: number
  preferredPoint?: { xMm: number; yMm: number }
  layoutConstraints?: Pick<LayoutConstraints, 'noGoZones'>
}

const rectPolygon = (rect: Pick<RectMm, 'xMm' | 'yMm' | 'widthMm' | 'depthMm'>): PointMm[] => [
  { x: rect.xMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm },
  { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const onSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y)
  if (Math.abs(cross) > .01) return false
  return point.x >= Math.min(start.x, end.x) - .01
    && point.x <= Math.max(start.x, end.x) + .01
    && point.y >= Math.min(start.y, end.y) - .01
    && point.y <= Math.max(start.y, end.y) + .01
}

const insideOrBoundary = (point: PointMm, polygon: readonly PointMm[]) =>
  pointInPolygon(point, [...polygon])
  || polygon.some((start, index) => onSegment(point, start, polygon[(index + 1) % polygon.length]))

const sampleRectangle = (polygon: readonly PointMm[]) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = polygon
  return [
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    { x: (topLeft.x + topRight.x) / 2, y: topLeft.y },
    { x: topRight.x, y: (topRight.y + bottomRight.y) / 2 },
    { x: (bottomLeft.x + bottomRight.x) / 2, y: bottomLeft.y },
    { x: topLeft.x, y: (topLeft.y + bottomLeft.y) / 2 },
    { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 },
  ]
}

const openingCenter = (architecture: Architecture, opening: Opening): PointMm => {
  const distance = opening.offsetMm + opening.widthMm / 2
  if (opening.segmentIndex !== undefined) {
    const start = architecture.roomPolygon[opening.segmentIndex]
    const end = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
    if (start && end) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
      return { x: start.x + (end.x - start.x) * distance / length, y: start.y + (end.y - start.y) * distance / length }
    }
  }
  if (opening.wall === 'top') return { x: distance, y: 0 }
  if (opening.wall === 'bottom') return { x: distance, y: architecture.depthMm }
  if (opening.wall === 'left') return { x: 0, y: distance }
  return { x: architecture.widthMm, y: distance }
}

export function suggestCatalogPlacement(input: CatalogPlacementInput): CatalogPlacement | null {
  const { widthMm, depthMm } = input.entry.typicalDimensions
  if (![widthMm, depthMm, input.snapMm].every((value) => Number.isFinite(value) && value > 0)) return null
  if (widthMm > input.architecture.widthMm || depthMm > input.architecture.depthMm) return null

  const obstructors = [
    ...input.equipment.filter(isFloorObstacle).map(rotatedFootprint),
    ...input.architecture.pillars.map(rectPolygon),
    ...(input.layoutConstraints?.noGoZones ?? []).map(rectPolygon),
  ]
  const openingClearance = Math.max(0, input.entry.placementRules?.keepClearOfOpeningsMm ?? 0)
  const openingKeepClear = openingClearance === 0 ? [] : input.architecture.openings.map((opening) => {
    const center = openingCenter(input.architecture, opening)
    return rectPolygon({
      xMm: center.x - opening.widthMm / 2 - openingClearance,
      yMm: center.y - opening.widthMm / 2 - openingClearance,
      widthMm: opening.widthMm + openingClearance * 2,
      depthMm: opening.widthMm + openingClearance * 2,
    })
  })
  const fits = (xMm: number, yMm: number) => {
    const footprint = rectPolygon({ xMm, yMm, widthMm, depthMm })
    const elevated = input.entry.placementRules?.mounting === 'wall' || input.entry.placementRules?.mounting === 'overhead'
    const touchesRoomEdge = footprint.some((point) => input.architecture.roomPolygon.some((start, index) => onSegment(point, start, input.architecture.roomPolygon[(index + 1) % input.architecture.roomPolygon.length])))
    return sampleRectangle(footprint).every((point) => insideOrBoundary(point, input.architecture.roomPolygon))
      && (!input.entry.placementRules?.requiresWall || touchesRoomEdge)
      && (elevated || obstructors.every((obstructor) => !polygonsOverlap(footprint, obstructor)))
      && openingKeepClear.every((clearance) => !polygonsOverlap(footprint, clearance))
  }

  const candidates: { xMm: number; yMm: number }[] = []
  if (input.preferredPoint && Number.isFinite(input.preferredPoint.xMm) && Number.isFinite(input.preferredPoint.yMm)) {
    candidates.push({
      xMm: Math.round(input.preferredPoint.xMm / input.snapMm) * input.snapMm,
      yMm: Math.round(input.preferredPoint.yMm / input.snapMm) * input.snapMm,
    })
  }
  for (let yMm = 0; yMm <= input.architecture.depthMm - depthMm; yMm += input.snapMm) {
    for (let xMm = 0; xMm <= input.architecture.widthMm - widthMm; xMm += input.snapMm) candidates.push({ xMm, yMm })
  }

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = `${candidate.xMm}:${candidate.yMm}`
    if (seen.has(key)) continue
    seen.add(key)
    if (fits(candidate.xMm, candidate.yMm)) return { ...candidate, rotationDeg: 0 }
  }
  return null
}
