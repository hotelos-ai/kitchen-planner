import { pointInPolygon, polygonsOverlap, rotatedFootprint } from '../geometry'
import type { Architecture, EquipmentItem, PointMm, RectMm } from '../project'

type PlacementEntry = {
  typicalDimensions: {
    widthMm: number
    depthMm: number
    heightMm: number
  }
}

export type CatalogPlacement = { xMm: number; yMm: number; rotationDeg: 0 }

export type CatalogPlacementInput = {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  entry: PlacementEntry
  snapMm: number
  preferredPoint?: { xMm: number; yMm: number }
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

export function suggestCatalogPlacement(input: CatalogPlacementInput): CatalogPlacement | null {
  const { widthMm, depthMm } = input.entry.typicalDimensions
  if (![widthMm, depthMm, input.snapMm].every((value) => Number.isFinite(value) && value > 0)) return null
  if (widthMm > input.architecture.widthMm || depthMm > input.architecture.depthMm) return null

  const obstructors = [
    ...input.equipment.filter((item) => item.category !== 'hood').map(rotatedFootprint),
    ...input.architecture.pillars.map(rectPolygon),
  ]
  const fits = (xMm: number, yMm: number) => {
    const footprint = rectPolygon({ xMm, yMm, widthMm, depthMm })
    return sampleRectangle(footprint).every((point) => insideOrBoundary(point, input.architecture.roomPolygon))
      && obstructors.every((obstructor) => !polygonsOverlap(footprint, obstructor))
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
