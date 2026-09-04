import type { Architecture, PointMm } from '../../domain/project'
import { architectureOpeningEnds } from '../../domain/opening-geometry'

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

export function removeVertex(architecture: Architecture, index: number): Architecture {
  const polygon = architecture.roomPolygon
  if (polygon.length <= 3 || index < 0 || index >= polygon.length) return architecture
  const count = polygon.length
  const roomPolygon = polygon.filter((_, position) => position !== index)
  const remap = (segmentIndex: number): number => {
    if (index === 0) return segmentIndex === 0 || segmentIndex === count - 1 ? count - 2 : segmentIndex - 1
    return segmentIndex === index - 1 || segmentIndex === index ? index - 1 : segmentIndex > index ? segmentIndex - 1 : segmentIndex
  }
  const openings = architecture.openings.map((opening) => (
    opening.segmentIndex !== undefined ? { ...opening, segmentIndex: remap(opening.segmentIndex) } : opening
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
  const polygon = architecture.roomPolygon
  if (polygon.length < 3) return architecture

  const candidates = polygon.map((start, segmentIndex) => {
    const end = polygon[(segmentIndex + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy) || 1
    const projected = Math.max(0, Math.min(length, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length))
    const px = start.x + (dx / length) * projected
    const py = start.y + (dy / length) * projected
    return { segmentIndex, start, end, length, projected, distance: Math.hypot(px - point.x, py - point.y) }
  }).sort((left, right) => left.distance - right.distance || left.segmentIndex - right.segmentIndex)

  const target = candidates.find((candidate) => candidate.length >= opening.widthMm) ?? candidates[0]
  const widthMm = Math.min(opening.widthMm, target.length)
  const maxOffset = Math.max(0, target.length - widthMm)
  const rawOffset = target.projected - widthMm / 2
  const offsetMm = Math.max(0, Math.min(maxOffset, Math.round(rawOffset / snapMm) * snapMm))

  const midpoint = { x: (target.start.x + target.end.x) / 2, y: (target.start.y + target.end.y) / 2 }
  const wallCandidates: { wall: 'top' | 'right' | 'bottom' | 'left'; distance: number }[] = [
    { wall: 'top', distance: midpoint.y },
    { wall: 'right', distance: architecture.widthMm - midpoint.x },
    { wall: 'bottom', distance: architecture.depthMm - midpoint.y },
    { wall: 'left', distance: midpoint.x },
  ]
  const wall = wallCandidates.sort((left, right) => left.distance - right.distance)[0].wall

  const openings = architecture.openings.map((candidate, position) => position === index
    ? { ...candidate, segmentIndex: target.segmentIndex, wall, offsetMm, ...(widthMm !== candidate.widthMm ? { widthMm } : {}) }
    : candidate)
  return { ...architecture, openings }
}

export function movePillar(architecture: Architecture, index: number, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.pillars.length) return architecture
  const snapped = snapPoint(point, snapMm)
  const pillars = architecture.pillars.map((candidate, position) => position === index ? { ...candidate, xMm: snapped.x, yMm: snapped.y } : candidate)
  return { ...architecture, pillars }
}

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export type RectHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'

export type RectMm = { xMm: number; yMm: number; widthMm: number; depthMm: number }

const MIN_RECT_MM = 100

export function resizeRect(rect: RectMm, handle: RectHandle, point: PointMm, snapMm: number): RectMm {
  const snap = (value: number) => Math.max(0, Math.round(value / snapMm) * snapMm)
  const left = snap(handle.includes('l') ? point.x : rect.xMm)
  const right = snap(handle.includes('r') ? point.x : rect.xMm + rect.widthMm)
  const top = snap(handle.includes('t') ? point.y : rect.yMm)
  const bottom = snap(handle.includes('b') ? point.y : rect.yMm + rect.depthMm)
  const xMm = Math.min(left, right - MIN_RECT_MM)
  const yMm = Math.min(top, bottom - MIN_RECT_MM)
  return {
    xMm: Math.max(0, xMm),
    yMm: Math.max(0, yMm),
    widthMm: Math.max(MIN_RECT_MM, Math.abs(right - left)),
    depthMm: Math.max(MIN_RECT_MM, Math.abs(bottom - top)),
  }
}

export function rectHandles(rect: RectMm): { handle: RectHandle; at: PointMm }[] {
  const { xMm, yMm, widthMm, depthMm } = rect
  return [
    { handle: 'tl', at: { x: xMm, y: yMm } },
    { handle: 'tr', at: { x: xMm + widthMm, y: yMm } },
    { handle: 'bl', at: { x: xMm, y: yMm + depthMm } },
    { handle: 'br', at: { x: xMm + widthMm, y: yMm + depthMm } },
    { handle: 't', at: { x: xMm + widthMm / 2, y: yMm } },
    { handle: 'b', at: { x: xMm + widthMm / 2, y: yMm + depthMm } },
    { handle: 'l', at: { x: xMm, y: yMm + depthMm / 2 } },
    { handle: 'r', at: { x: xMm + widthMm, y: yMm + depthMm / 2 } },
  ]
}

export function resizePillarRect(architecture: Architecture, index: number, handle: RectHandle, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.pillars.length) return architecture
  const pillars = architecture.pillars.map((pillar, position) => {
    if (position !== index) return pillar
    const next = resizeRect({ xMm: pillar.xMm, yMm: pillar.yMm, widthMm: pillar.widthMm, depthMm: pillar.depthMm }, handle, point, snapMm)
    return { ...pillar, xMm: next.xMm, yMm: next.yMm, widthMm: next.widthMm, depthMm: next.depthMm }
  })
  return { ...architecture, pillars }
}

export function resizeZoneRect(architecture: Architecture, index: number, handle: RectHandle, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.storageZones.length) return architecture
  const storageZones = architecture.storageZones.map((zone, position) => {
    if (position !== index) return zone
    const next = resizeRect({ xMm: zone.xMm, yMm: zone.yMm, widthMm: zone.widthMm, depthMm: zone.depthMm }, handle, point, snapMm)
    return { ...zone, xMm: next.xMm, yMm: next.yMm, widthMm: next.widthMm, depthMm: next.depthMm }
  })
  return { ...architecture, storageZones }
}

export function moveZoneRect(architecture: Architecture, index: number, point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.storageZones.length) return architecture
  const snapped = snapPoint(point, snapMm)
  const storageZones = architecture.storageZones.map((zone, position) => position === index
    ? { ...zone, xMm: snapped.x, yMm: snapped.y }
    : zone)
  return { ...architecture, storageZones }
}

const MIN_OPENING_MM = 200

export function openingEnds(architecture: Architecture, opening: { wall?: string; segmentIndex?: number; offsetMm: number; widthMm: number }): { start: PointMm; end: PointMm } {
  return architectureOpeningEnds(architecture, {
    ...opening,
    wall: opening.wall === 'top' || opening.wall === 'right' || opening.wall === 'bottom' || opening.wall === 'left' ? opening.wall : 'top',
  })
}

export function resizeOpening(architecture: Architecture, index: number, end: 'start' | 'end', point: PointMm, snapMm: number): Architecture {
  if (index < 0 || index >= architecture.openings.length) return architecture
  const opening = architecture.openings[index]
  const segment = segmentOf(architecture, opening)
  if (!segment) return architecture
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const length = Math.hypot(dx, dy) || 1
  const projected = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / length
  const snapped = Math.max(0, Math.min(length, Math.round(projected / snapMm) * snapMm))
  const openings = architecture.openings.map((candidate, position) => {
    if (position !== index) return candidate
    if (end === 'start') {
      const newOffset = Math.min(snapped, candidate.offsetMm + candidate.widthMm - MIN_OPENING_MM)
      return { ...candidate, offsetMm: Math.max(0, newOffset), widthMm: candidate.offsetMm + candidate.widthMm - Math.max(0, newOffset) }
    }
    const newEnd = Math.max(snapped, candidate.offsetMm + MIN_OPENING_MM)
    return { ...candidate, widthMm: Math.min(length - candidate.offsetMm, newEnd - candidate.offsetMm) }
  })
  return { ...architecture, openings }
}

export function createOpeningAt(architecture: Architecture, entry: { label: string; kind: 'door' | 'window' | 'service-window'; widthMm: number }, point: PointMm, dragTo: PointMm | null, snapMm: number): Architecture {
  const from = dragTo ?? point
  const polygon = architecture.roomPolygon
  const nearest = nearestSegment(polygon, from)
  const start = polygon[nearest.segmentIndex]
  const end = polygon[(nearest.segmentIndex + 1) % polygon.length]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const project = (p: PointMm) => ((p.x - start.x) * dx + (p.y - start.y) * dy) / length
  const a = Math.max(0, Math.min(length, Math.round(project(point) / snapMm) * snapMm))
  const b = dragTo ? Math.max(0, Math.min(length, Math.round(project(dragTo) / snapMm) * snapMm)) : null
  const widthMm = b === null ? Math.min(entry.widthMm, length) : Math.max(MIN_OPENING_MM, Math.abs(b - a))
  const offsetMm = b === null ? Math.max(0, Math.min(length - widthMm, a - widthMm / 2)) : Math.max(0, Math.min(length - widthMm, Math.min(a, b)))
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const wallCandidates: { wall: 'top' | 'right' | 'bottom' | 'left'; distance: number }[] = [
    { wall: 'top', distance: midpoint.y },
    { wall: 'right', distance: architecture.widthMm - midpoint.x },
    { wall: 'bottom', distance: architecture.depthMm - midpoint.y },
    { wall: 'left', distance: midpoint.x },
  ]
  const wall = wallCandidates.sort((left, right) => left.distance - right.distance)[0].wall
  const glazedOpening = entry.kind === 'service-window' || entry.kind === 'window'
  return {
    ...architecture,
    openings: [...architecture.openings, {
      id: makeId(entry.kind),
      label: entry.label,
      kind: entry.kind,
      wall,
      segmentIndex: nearest.segmentIndex,
      offsetMm,
      widthMm,
      ...(glazedOpening
        ? { sillHeightMm: entry.kind === 'window' ? 1_000 : 900, heightMm: entry.kind === 'window' ? 1_200 : 900, flow: entry.kind === 'window' ? 'closed' as const : 'clean-out' as const }
        : { flow: 'entry' as const, doorType: 'hinged' as const, swingDepthMm: widthMm, swingHinge: 'start' as const, swingDirection: 'inward' as const }),
    }],
  }
}

export function createRectItemAt(architecture: Architecture, entry: { id: string; label: string; kind: 'pillar' | 'zone'; widthMm: number; depthMm: number; round?: boolean }, from: PointMm, to: PointMm | null, snapMm: number): Architecture {
  const snap = (value: number) => Math.max(0, Math.round(value / snapMm) * snapMm)
  const x1 = snap(from.x)
  const y1 = snap(from.y)
  if (!to) {
    const xMm = Math.max(0, x1 - entry.widthMm / 2)
    const yMm = Math.max(0, y1 - entry.depthMm / 2)
    return appendRectItem(architecture, entry, { xMm, yMm, widthMm: entry.widthMm, depthMm: entry.depthMm })
  }
  const x2 = snap(to.x)
  const y2 = snap(to.y)
  const rect = {
    xMm: Math.max(0, Math.min(x1, x2)),
    yMm: Math.max(0, Math.min(y1, y2)),
    widthMm: Math.max(MIN_RECT_MM, Math.abs(x2 - x1)),
    depthMm: Math.max(MIN_RECT_MM, Math.abs(y2 - y1)),
  }
  return appendRectItem(architecture, entry, rect)
}

function appendRectItem(architecture: Architecture, entry: { id: string; label: string; kind: 'pillar' | 'zone'; round?: boolean }, rect: RectMm): Architecture {
  if (entry.kind === 'pillar') {
    return { ...architecture, pillars: [...architecture.pillars, { id: makeId('pillar'), xMm: rect.xMm, yMm: rect.yMm, widthMm: rect.widthMm, depthMm: rect.depthMm, ...(entry.round ? { shape: 'round' as const } : {}) }] }
  }
  return { ...architecture, storageZones: [...architecture.storageZones, { id: makeId('storage-zone'), label: entry.label, xMm: rect.xMm, yMm: rect.yMm, widthMm: rect.widthMm, depthMm: rect.depthMm, adjacent: false }] }
}

export type PlacementSpec = { catalogId: string; label: string; kind: 'pillar' | 'partition' | 'zone' | 'door' | 'window' | 'service-window'; widthMm: number; depthMm: number; round?: boolean }

export function constrainToAxes(from: PointMm, to: PointMm): PointMm {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return to
  const angle = Math.atan2(dy, dx)
  const step = Math.PI / 4
  const snapped = Math.round(angle / step) * step
  const length = Math.hypot(dx, dy)
  return { x: from.x + Math.cos(snapped) * length, y: from.y + Math.sin(snapped) * length }
}

export function squarePointAround(anchor: PointMm, point: PointMm): PointMm {
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: anchor.x + Math.sign(dx || 1) * size, y: anchor.y + Math.sign(dy || 1) * size }
}

export function removeOpening(architecture: Architecture, index: number): Architecture {
  if (index < 0 || index >= architecture.openings.length) return architecture
  return { ...architecture, openings: architecture.openings.filter((_, position) => position !== index) }
}

export function removePillar(architecture: Architecture, index: number): Architecture {
  if (index < 0 || index >= architecture.pillars.length) return architecture
  return { ...architecture, pillars: architecture.pillars.filter((_, position) => position !== index) }
}

export function removeZone(architecture: Architecture, index: number): Architecture {
  if (index < 0 || index >= architecture.storageZones.length) return architecture
  return { ...architecture, storageZones: architecture.storageZones.filter((_, position) => position !== index) }
}
