import { pointInPolygon, polygonsOverlap, rotatedFootprint } from './geometry'
import { isFloorObstacle } from './catalog/floor-obstacle'
import type { Architecture, EquipmentItem, LayoutConstraints, Opening, PointMm, RectMm } from './project'

export type LayoutIssue = {
  id: string
  code: 'outside-room' | 'equipment-overlap' | 'pillar-overlap' | 'clearance-obstructed'
  severity: 'error' | 'warning'
  title: string
  message: string
  itemIds: string[]
}

export type LayoutDiagnosticOptions = {
  layoutConstraints?: Pick<LayoutConstraints, 'noGoZones'>
}

export const UNKNOWN_PROFESSIONAL_CONSTRAINTS = Object.freeze([
  Object.freeze({ code: 'fire', status: 'unknown' as const }),
  Object.freeze({ code: 'ventilation', status: 'unknown' as const }),
  Object.freeze({ code: 'hygiene', status: 'unknown' as const }),
  Object.freeze({ code: 'accessibility', status: 'unknown' as const }),
  Object.freeze({ code: 'electrical', status: 'unknown' as const }),
  Object.freeze({ code: 'drainage', status: 'unknown' as const }),
])

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

const transformLocal = (item: EquipmentItem, point: PointMm): PointMm => {
  const radians = item.rotationDeg * Math.PI / 180
  return {
    x: item.xMm + point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: item.yMm + point.x * Math.sin(radians) + point.y * Math.cos(radians),
  }
}

const clearancePolygon = (item: EquipmentItem): PointMm[] => {
  const clearance = item.clearance
  const left = clearance?.leftMm ?? 0
  const right = clearance?.rightMm ?? 0
  const back = clearance?.backMm ?? 0
  const front = clearance?.frontMm ?? 0
  return [
    { x: -left, y: -back },
    { x: item.widthMm + right, y: -back },
    { x: item.widthMm + right, y: item.depthMm + front },
    { x: -left, y: item.depthMm + front },
  ].map((point) => transformLocal(item, point))
}

const polygonInsideRoom = (polygon: PointMm[], room: PointMm[]) => polygon.every((point, index) => {
  const next = polygon[(index + 1) % polygon.length]
  const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
  return insideOrBoundary(point, room) && insideOrBoundary(midpoint, room)
})

const roomCentroid = (room: readonly PointMm[]): PointMm => ({
  x: room.reduce((sum, point) => sum + point.x, 0) / Math.max(1, room.length),
  y: room.reduce((sum, point) => sum + point.y, 0) / Math.max(1, room.length),
})

const openingLine = (architecture: Architecture, opening: Opening): [PointMm, PointMm] | undefined => {
  if (opening.segmentIndex !== undefined) {
    const segmentStart = architecture.roomPolygon[opening.segmentIndex]
    const segmentEnd = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
    if (!segmentStart || !segmentEnd) return undefined
    const length = Math.hypot(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y) || 1
    const unit = { x: (segmentEnd.x - segmentStart.x) / length, y: (segmentEnd.y - segmentStart.y) / length }
    const start = { x: segmentStart.x + unit.x * opening.offsetMm, y: segmentStart.y + unit.y * opening.offsetMm }
    return [start, { x: start.x + unit.x * opening.widthMm, y: start.y + unit.y * opening.widthMm }]
  }
  if (opening.wall === 'top') return [{ x: opening.offsetMm, y: 0 }, { x: opening.offsetMm + opening.widthMm, y: 0 }]
  if (opening.wall === 'bottom') return [{ x: opening.offsetMm, y: architecture.depthMm }, { x: opening.offsetMm + opening.widthMm, y: architecture.depthMm }]
  if (opening.wall === 'left') return [{ x: 0, y: opening.offsetMm }, { x: 0, y: opening.offsetMm + opening.widthMm }]
  return [{ x: architecture.widthMm, y: opening.offsetMm }, { x: architecture.widthMm, y: opening.offsetMm + opening.widthMm }]
}

const doorSwingPolygon = (architecture: Architecture, opening: Opening): PointMm[] | undefined => {
  const line = openingLine(architecture, opening)
  const depth = opening.swingDepthMm ?? 0
  if (!line || depth <= 0) return undefined
  const [start, end] = line
  const edge = { x: end.x - start.x, y: end.y - start.y }
  const length = Math.hypot(edge.x, edge.y) || 1
  const candidates = [{ x: -edge.y / length, y: edge.x / length }, { x: edge.y / length, y: -edge.x / length }]
  const center = roomCentroid(architecture.roomPolygon)
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const inward = candidates.sort((left, right) =>
    Math.hypot(midpoint.x + left.x * depth - center.x, midpoint.y + left.y * depth - center.y)
      - Math.hypot(midpoint.x + right.x * depth - center.x, midpoint.y + right.y * depth - center.y))[0]
  return [start, end, { x: end.x + inward.x * depth, y: end.y + inward.y * depth }, { x: start.x + inward.x * depth, y: start.y + inward.y * depth }]
}

export function doorSwingEnvelopes(architecture: Architecture): readonly { opening: Opening; polygon: PointMm[] }[] {
  return architecture.openings.flatMap((opening) => {
    const polygon = opening.kind === 'door' ? doorSwingPolygon(architecture, opening) : undefined
    return polygon ? [{ opening, polygon }] : []
  })
}

export function analyzeLayout(architecture: Architecture, equipment: readonly EquipmentItem[], options: LayoutDiagnosticOptions = {}): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const floorItems = equipment.filter(isFloorObstacle)
  const footprints = new Map(floorItems.map((item) => [item.id, rotatedFootprint(item)]))
  const pillarPolygons = architecture.pillars.map((pillar) => ({ pillar, polygon: rectPolygon(pillar) }))
  const doorPolygons = doorSwingEnvelopes(architecture)
  const noGoPolygons = (options.layoutConstraints?.noGoZones ?? []).map((zone) => ({ zone, polygon: rectPolygon(zone) }))

  floorItems.forEach((item) => {
    const footprint = footprints.get(item.id)!
    if (!polygonInsideRoom(footprint, architecture.roomPolygon)) issues.push({ id: `outside-${item.id}`, code: 'outside-room', severity: 'error', title: `${item.label} is outside the room`, message: 'One or more corners cross the jagged kitchen boundary.', itemIds: [item.id] })
    pillarPolygons.forEach(({ pillar, polygon }) => {
      if (polygonsOverlap(footprint, polygon)) issues.push({ id: `pillar-${item.id}-${pillar.id}`, code: 'pillar-overlap', severity: 'error', title: `${item.label} overlaps the pillar`, message: 'Move or resize the item; touching the pillar edge is allowed, overlapping it is not.', itemIds: [item.id] })
    })
  })
  floorItems.forEach((item, index) => floorItems.slice(index + 1).forEach((other) => {
    if (polygonsOverlap(footprints.get(item.id)!, footprints.get(other.id)!)) issues.push({ id: `overlap-${item.id}-${other.id}`, code: 'equipment-overlap', severity: 'error', title: `${item.label} overlaps ${other.label}`, message: 'The equipment footprints occupy the same floor area.', itemIds: [item.id, other.id] })
  }))

  floorItems.filter((item) => item.clearance && Object.entries(item.clearance).some(([key, value]) => key.endsWith('Mm') && Number(value) > 0)).forEach((item) => {
    const clearance = clearancePolygon(item)
    const obstructionIds: string[] = []
    const obstructionLabels: string[] = []
    const append = (id: string, label: string) => {
      if (obstructionIds.includes(id)) return
      obstructionIds.push(id)
      obstructionLabels.push(label)
    }
    floorItems.filter((other) => other.id !== item.id && polygonsOverlap(clearance, footprints.get(other.id)!)).forEach((other) => append(other.id, other.label))
    pillarPolygons.filter(({ polygon }) => polygonsOverlap(clearance, polygon)).forEach(({ pillar }) => append(pillar.id, `pillar ${pillar.id}`))
    doorPolygons.filter(({ polygon }) => polygonsOverlap(clearance, polygon)).forEach(({ opening }) => append(opening.id, `door swing ${opening.label}`))
    noGoPolygons.filter(({ polygon }) => polygonsOverlap(clearance, polygon)).forEach(({ zone }) => append(zone.id, `no-go zone ${zone.id}`))
    if (!polygonInsideRoom(clearance, architecture.roomPolygon)) obstructionLabels.push('room boundary')
    if (obstructionLabels.length) issues.push({
      id: `clearance-${item.id}`,
      code: 'clearance-obstructed',
      severity: 'warning',
      title: `${item.label} clearance is obstructed`,
      message: `Configured clearance overlaps ${obstructionLabels.join(', ')}.`,
      itemIds: [item.id, ...obstructionIds],
    })
  })
  return issues
}
