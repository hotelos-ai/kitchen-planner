import { pointInPolygon } from './geometry'
import type { Architecture, Opening, PointMm } from './project'

const segmentForOpening = (architecture: Architecture, opening: Pick<Opening, 'segmentIndex' | 'wall'>) => {
  const polygon = architecture.roomPolygon
  if (opening.segmentIndex !== undefined && opening.segmentIndex >= 0 && opening.segmentIndex < polygon.length) {
    return { start: polygon[opening.segmentIndex], end: polygon[(opening.segmentIndex + 1) % polygon.length] }
  }
  if (opening.wall === 'top') return { start: { x: 0, y: 0 }, end: { x: architecture.widthMm, y: 0 } }
  if (opening.wall === 'right') return { start: { x: architecture.widthMm, y: 0 }, end: { x: architecture.widthMm, y: architecture.depthMm } }
  if (opening.wall === 'bottom') return { start: { x: 0, y: architecture.depthMm }, end: { x: architecture.widthMm, y: architecture.depthMm } }
  return { start: { x: 0, y: 0 }, end: { x: 0, y: architecture.depthMm } }
}

export function architectureOpeningEnds(
  architecture: Architecture,
  opening: Pick<Opening, 'segmentIndex' | 'wall' | 'offsetMm' | 'widthMm'>,
): { start: PointMm; end: PointMm } {
  const segment = segmentForOpening(architecture, opening)
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const length = Math.hypot(dx, dy) || 1
  const at = (distanceMm: number): PointMm => ({
    x: segment.start.x + dx / length * distanceMm,
    y: segment.start.y + dy / length * distanceMm,
  })
  return { start: at(opening.offsetMm), end: at(opening.offsetMm + opening.widthMm) }
}

const roomCentroid = (room: readonly PointMm[]): PointMm => ({
  x: room.reduce((sum, point) => sum + point.x, 0) / Math.max(1, room.length),
  y: room.reduce((sum, point) => sum + point.y, 0) / Math.max(1, room.length),
})

const inwardNormal = (architecture: Architecture, start: PointMm, end: PointMm): PointMm => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const candidates = [{ x: -dy / length, y: dx / length }, { x: dy / length, y: -dx / length }]
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const direct = candidates.find((normal) => pointInPolygon({ x: midpoint.x + normal.x, y: midpoint.y + normal.y }, architecture.roomPolygon))
  if (direct) return direct
  const center = roomCentroid(architecture.roomPolygon)
  return candidates.sort((left, right) =>
    Math.hypot(midpoint.x + left.x - center.x, midpoint.y + left.y - center.y)
      - Math.hypot(midpoint.x + right.x - center.x, midpoint.y + right.y - center.y))[0]
}

export type DoorSwingGeometry = {
  hinge: PointMm
  closedEnd: PointMm
  openEnd: PointMm
  radiusMm: number
  startAngleRad: number
  sweepAngleRad: number
  arc: PointMm[]
  envelope: PointMm[]
}

const swingForLeaf = (
  architecture: Architecture,
  ends: { start: PointMm; end: PointMm },
  hinge: PointMm,
  closedEnd: PointMm,
  radiusMm: number,
  direction: Opening['swingDirection'],
): DoorSwingGeometry => {
  const inward = inwardNormal(architecture, ends.start, ends.end)
  const openingNormal = direction === 'outward' ? { x: -inward.x, y: -inward.y } : inward
  const openEnd = { x: hinge.x + openingNormal.x * radiusMm, y: hinge.y + openingNormal.y * radiusMm }
  const startAngleRad = Math.atan2(closedEnd.y - hinge.y, closedEnd.x - hinge.x)
  const targetAngleRad = Math.atan2(openEnd.y - hinge.y, openEnd.x - hinge.x)
  let sweepAngleRad = targetAngleRad - startAngleRad
  while (sweepAngleRad > Math.PI) sweepAngleRad -= Math.PI * 2
  while (sweepAngleRad < -Math.PI) sweepAngleRad += Math.PI * 2
  const steps = 18
  const arc = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngleRad + sweepAngleRad * index / steps
    return { x: hinge.x + Math.cos(angle) * radiusMm, y: hinge.y + Math.sin(angle) * radiusMm }
  })
  return {
    hinge,
    closedEnd,
    openEnd,
    radiusMm,
    startAngleRad,
    sweepAngleRad,
    arc,
    envelope: [hinge, ...arc],
  }
}

/** All swept leaves for a door. Sliding doors intentionally have no swing envelope. */
export function doorSwingGeometries(architecture: Architecture, opening: Opening): DoorSwingGeometry[] {
  if (opening.kind !== 'door' || opening.doorType === 'sliding' || opening.doorType === 'double-sliding') return []
  const ends = architectureOpeningEnds(architecture, opening)
  if (opening.doorType === 'double-hinged') {
    const midpoint = { x: (ends.start.x + ends.end.x) / 2, y: (ends.start.y + ends.end.y) / 2 }
    const leafRadiusMm = Math.min(opening.swingDepthMm ?? opening.widthMm / 2, opening.widthMm / 2)
    if (leafRadiusMm <= 0) return []
    return [
      swingForLeaf(architecture, ends, ends.start, midpoint, leafRadiusMm, opening.swingDirection),
      swingForLeaf(architecture, ends, ends.end, midpoint, leafRadiusMm, opening.swingDirection),
    ]
  }
  const radiusMm = opening.swingDepthMm ?? opening.widthMm
  if (radiusMm <= 0) return []
  const hinge = opening.swingHinge === 'end' ? ends.end : ends.start
  const closedEnd = opening.swingHinge === 'end' ? ends.start : ends.end
  return [swingForLeaf(architecture, ends, hinge, closedEnd, radiusMm, opening.swingDirection)]
}

/** Backwards-compatible accessor for callers that only need the first leaf. */
export function doorSwingGeometry(architecture: Architecture, opening: Opening): DoorSwingGeometry | undefined {
  return doorSwingGeometries(architecture, opening)[0]
}
