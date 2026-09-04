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

export function doorSwingGeometry(architecture: Architecture, opening: Opening): DoorSwingGeometry | undefined {
  const radiusMm = opening.swingDepthMm ?? 0
  if (opening.kind !== 'door' || radiusMm <= 0) return undefined
  const ends = architectureOpeningEnds(architecture, opening)
  const hinge = opening.swingHinge === 'end' ? ends.end : ends.start
  const closedEnd = opening.swingHinge === 'end' ? ends.start : ends.end
  const inward = inwardNormal(architecture, ends.start, ends.end)
  const direction = opening.swingDirection === 'outward' ? { x: -inward.x, y: -inward.y } : inward
  const openEnd = { x: hinge.x + direction.x * radiusMm, y: hinge.y + direction.y * radiusMm }
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
