import { pointInPolygon, polygonsOverlap, rotatedFootprint } from './geometry'
import type { Architecture, EquipmentItem, PointMm, RectMm } from './project'

export type LayoutIssue = {
  id: string
  code: 'outside-room' | 'equipment-overlap' | 'pillar-overlap' | 'clearance-obstructed'
  severity: 'error' | 'warning'
  title: string
  message: string
  itemIds: string[]
}

const rectPolygon = (rect: RectMm): PointMm[] => [
  { x: rect.xMm, y: rect.yMm }, { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm }, { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const onSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y)
  if (Math.abs(cross) > .01) return false
  return point.x >= Math.min(start.x, end.x) - .01 && point.x <= Math.max(start.x, end.x) + .01 && point.y >= Math.min(start.y, end.y) - .01 && point.y <= Math.max(start.y, end.y) + .01
}

const insideOrBoundary = (point: PointMm, polygon: PointMm[]) => pointInPolygon(point, polygon) || polygon.some((start, index) => onSegment(point, start, polygon[(index + 1) % polygon.length]))

const clearancePolygon = (item: EquipmentItem): PointMm[] => {
  const depth = item.clearance?.frontMm ?? 0
  const radians = item.rotationDeg * Math.PI / 180
  return [
    { x: 0, y: item.depthMm }, { x: item.widthMm, y: item.depthMm },
    { x: item.widthMm, y: item.depthMm + depth }, { x: 0, y: item.depthMm + depth },
  ].map((point) => ({ x: item.xMm + point.x * Math.cos(radians) - point.y * Math.sin(radians), y: item.yMm + point.x * Math.sin(radians) + point.y * Math.cos(radians) }))
}

export function analyzeLayout(architecture: Architecture, equipment: readonly EquipmentItem[]): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const floorItems = equipment.filter((item) => item.category !== 'hood')
  const footprints = new Map(floorItems.map((item) => [item.id, rotatedFootprint(item)]))
  floorItems.forEach((item) => {
    const footprint = footprints.get(item.id)!
    if (!footprint.every((point) => insideOrBoundary(point, architecture.roomPolygon))) issues.push({ id: `outside-${item.id}`, code: 'outside-room', severity: 'error', title: `${item.label} is outside the room`, message: 'One or more corners cross the jagged kitchen boundary.', itemIds: [item.id] })
    architecture.pillars.forEach((pillar) => {
      if (polygonsOverlap(footprint, rectPolygon(pillar))) issues.push({ id: `pillar-${item.id}-${pillar.id}`, code: 'pillar-overlap', severity: 'error', title: `${item.label} overlaps the pillar`, message: 'Move or resize the item; touching the pillar edge is allowed, overlapping it is not.', itemIds: [item.id] })
    })
  })
  floorItems.forEach((item, index) => floorItems.slice(index + 1).forEach((other) => {
    if (polygonsOverlap(footprints.get(item.id)!, footprints.get(other.id)!)) issues.push({ id: `overlap-${item.id}-${other.id}`, code: 'equipment-overlap', severity: 'error', title: `${item.label} overlaps ${other.label}`, message: 'The equipment footprints occupy the same floor area.', itemIds: [item.id, other.id] })
  }))
  floorItems.filter((item) => item.clearance?.frontMm).forEach((item) => {
    const clearance = clearancePolygon(item)
    const obstructors = floorItems.filter((other) => other.id !== item.id && polygonsOverlap(clearance, footprints.get(other.id)!))
    if (obstructors.length) issues.push({ id: `clearance-${item.id}`, code: 'clearance-obstructed', severity: 'warning', title: `${item.label} work zone is obstructed`, message: `Front clearance overlaps ${obstructors.map((other) => other.label).join(', ')}.`, itemIds: [item.id, ...obstructors.map((other) => other.id)] })
  })
  return issues
}
