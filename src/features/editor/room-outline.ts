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
