import type { Architecture, PointMm } from '../../domain/project'

export type SegmentHit = { segmentIndex: number; point: PointMm; distanceMm: number }

const snapValue = (value: number, snapMm: number) => Math.max(0, Math.round(value / snapMm) * snapMm)

const snapPoint = (point: PointMm, snapMm: number): PointMm => ({ x: snapValue(point.x, snapMm), y: snapValue(point.y, snapMm) })

const boundsOf = (polygon: PointMm[]) => ({
  widthMm: Math.max(100, ...polygon.map((point) => point.x)),
  depthMm: Math.max(100, ...polygon.map((point) => point.y)),
})

const withPolygon = (architecture: Architecture, roomPolygon: PointMm[]): Architecture => ({
  ...architecture,
  roomPolygon,
  ...boundsOf(roomPolygon),
})

export function moveVertex(architecture: Architecture, index: number, point: PointMm, snapMm: number): Architecture {
  const polygon = architecture.roomPolygon
  if (index < 0 || index >= polygon.length) return architecture
  return withPolygon(architecture, polygon.map((vertex, position) => position === index ? snapPoint(point, snapMm) : vertex))
}

export function slideEdge(architecture: Architecture, segmentIndex: number, delta: PointMm, snapMm: number): Architecture {
  const polygon = architecture.roomPolygon
  if (segmentIndex < 0 || segmentIndex >= polygon.length) return architecture
  const snapped = { x: Math.round(delta.x / snapMm) * snapMm, y: Math.round(delta.y / snapMm) * snapMm }
  if (snapped.x === 0 && snapped.y === 0) return architecture
  const endIndex = (segmentIndex + 1) % polygon.length
  return withPolygon(architecture, polygon.map((vertex, position) => (
    position === segmentIndex || position === endIndex
      ? snapPoint({ x: vertex.x + snapped.x, y: vertex.y + snapped.y }, snapMm)
      : vertex
  )))
}

export function insertVertexOnSegment(architecture: Architecture, segmentIndex: number, point: PointMm, snapMm: number): Architecture {
  const polygon = architecture.roomPolygon
  if (segmentIndex < 0 || segmentIndex >= polygon.length) return architecture
  const vertex = snapPoint(point, snapMm)
  const roomPolygon = [...polygon.slice(0, segmentIndex + 1), vertex, ...polygon.slice(segmentIndex + 1)]
  const openings = architecture.openings.map((opening) => (
    opening.segmentIndex !== undefined && opening.segmentIndex > segmentIndex
      ? { ...opening, segmentIndex: opening.segmentIndex + 1 }
      : opening
  ))
  return { ...withPolygon(architecture, roomPolygon), openings }
}

export function nearestSegment(polygon: PointMm[], point: PointMm): SegmentHit {
  let best: SegmentHit = { segmentIndex: 0, point: polygon[0], distanceMm: Number.POSITIVE_INFINITY }
  polygon.forEach((start, segmentIndex) => {
    const end = polygon[(segmentIndex + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy || 1
    const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    const projected = { x: start.x + dx * fraction, y: start.y + dy * fraction }
    const distanceMm = Math.hypot(projected.x - point.x, projected.y - point.y)
    if (distanceMm < best.distanceMm) best = { segmentIndex, point: projected, distanceMm }
  })
  return best
}

export function edgeMidpoint(polygon: PointMm[], segmentIndex: number): PointMm {
  const start = polygon[segmentIndex]
  const end = polygon[(segmentIndex + 1) % polygon.length]
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
}

export function polygonCentroid(polygon: PointMm[]): PointMm {
  const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / polygon.length, y: sum.y / polygon.length }
}

const segmentOf = (architecture: Architecture, opening: { segmentIndex?: number; wall?: string }): { start: PointMm; end: PointMm } | null => {
  const polygon = architecture.roomPolygon
  if (opening.segmentIndex !== undefined && opening.segmentIndex >= 0 && opening.segmentIndex < polygon.length) {
    return { start: polygon[opening.segmentIndex], end: polygon[(opening.segmentIndex + 1) % polygon.length] }
  }
  const wall = opening.wall
  if (wall === 'top') return { start: { x: 0, y: 0 }, end: { x: architecture.widthMm, y: 0 } }
  if (wall === 'right') return { start: { x: architecture.widthMm, y: 0 }, end: { x: architecture.widthMm, y: architecture.depthMm } }
  if (wall === 'bottom') return { start: { x: 0, y: architecture.depthMm }, end: { x: architecture.widthMm, y: architecture.depthMm } }
  if (wall === 'left') return { start: { x: 0, y: 0 }, end: { x: 0, y: architecture.depthMm } }
  return null
}

export function openingCenter(architecture: Architecture, opening: { wall?: string; segmentIndex?: number; offsetMm: number; widthMm: number }): PointMm {
  const segment = segmentOf(architecture, opening)
  const along = opening.offsetMm + opening.widthMm / 2
  if (segment) {
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    const length = Math.hypot(dx, dy) || 1
    return { x: segment.start.x + (dx / length) * along, y: segment.start.y + (dy / length) * along }
  }
  if (opening.wall === 'right') return { x: architecture.widthMm, y: along }
  if (opening.wall === 'bottom') return { x: along, y: architecture.depthMm }
  if (opening.wall === 'left') return { x: 0, y: along }
  return { x: along, y: 0 }
}

export function moveOpening(architecture: Architecture, index: number, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.openings.length) return architecture
  const opening = architecture.openings[index]
  const segment = segmentOf(architecture, opening)
  if (!segment) return architecture
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const length = Math.hypot(dx, dy) || 1
  const projected = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / length
  const maxOffset = Math.max(0, length - opening.widthMm)
  const offsetMm = Math.max(0, Math.min(maxOffset, Math.round((projected - opening.widthMm / 2) / snapMm) * snapMm))
  const openings = architecture.openings.map((candidate, position) => position === index ? { ...candidate, offsetMm } : candidate)
  return { ...architecture, openings }
}

export function movePillar(architecture: Architecture, index: number, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.pillars.length) return architecture
  const snapped = snapPoint(point, snapMm)
  const pillars = architecture.pillars.map((candidate, position) => position === index ? { ...candidate, xMm: snapped.x, yMm: snapped.y } : candidate)
  return { ...architecture, pillars }
}
