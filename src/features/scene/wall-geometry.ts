import type { Architecture, Opening, PointMm } from '../../domain/project'

export type WallPanel = {
  id: string
  wall: Opening['wall'] | 'boundary'
  openingId?: string
  part: 'run' | 'above' | 'below'
  offsetStartMm: number
  offsetEndMm: number
  centerMm: { x: number; y: number; z: number }
  sizeMm: { width: number; height: number; depth: number }
  rotationYRad: number
}

export type ServiceWindowFixture = {
  id: string
  flow: 'clean-out' | 'dirty-in'
  label: string
  centerMm: { x: number; y: number; z: number }
  widthMm: number
  sillHeightMm: number
  openingHeightMm: number
  rotationYRad: number
}

const WALL_DEPTH_MM = 80

const wallName = (start: PointMm, end: PointMm, architecture: Architecture): Opening['wall'] | null => {
  if (start.y === 0 && end.y === 0) return 'top'
  if (start.x === architecture.widthMm && end.x === architecture.widthMm) return 'right'
  if (start.y === architecture.depthMm && end.y === architecture.depthMm) return 'bottom'
  if (start.x === 0 && end.x === 0) return 'left'
  return null
}

const pointAt = (start: PointMm, end: PointMm, distanceMm: number): PointMm => {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
  const ratio = distanceMm / length
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
}

export function buildWallPanels(architecture: Architecture): WallPanel[] {
  const panels: WallPanel[] = []
  architecture.roomPolygon.forEach((start, edgeIndex) => {
    const end = architecture.roomPolygon[(edgeIndex + 1) % architecture.roomPolygon.length]
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y)
    const wall = wallName(start, end, architecture)
    const forward = !wall || (wall === 'top' || wall === 'bottom' ? end.x >= start.x : end.y >= start.y)
    const openings = architecture.openings
      .filter((opening) => opening.kind !== 'sealed-opening'
        && (opening.segmentIndex !== undefined ? opening.segmentIndex === edgeIndex : Boolean(wall && opening.wall === wall)))
      .map((opening) => {
        const localStart = opening.segmentIndex !== undefined || forward ? opening.offsetMm : edgeLength - opening.offsetMm - opening.widthMm
        return { opening, start: Math.max(0, localStart), end: Math.min(edgeLength, localStart + opening.widthMm) }
      })
      .filter((entry) => entry.end > entry.start)
      .sort((left, right) => left.start - right.start)

    const append = (localStart: number, localEnd: number, heightMm: number, baseMm: number, part: WallPanel['part'], openingId?: string) => {
      if (localEnd <= localStart || heightMm <= 0) return
      const midpoint = pointAt(start, end, (localStart + localEnd) / 2)
      const offsetA = forward ? localStart : edgeLength - localStart
      const offsetB = forward ? localEnd : edgeLength - localEnd
      panels.push({
        id: `wall-${edgeIndex}-${openingId ?? 'run'}-${part}-${localStart}`,
        wall: wall ?? 'boundary', openingId, part,
        offsetStartMm: Math.min(offsetA, offsetB), offsetEndMm: Math.max(offsetA, offsetB),
        centerMm: { x: midpoint.x, y: baseMm + heightMm / 2, z: midpoint.y },
        sizeMm: { width: localEnd - localStart, height: heightMm, depth: WALL_DEPTH_MM },
        rotationYRad: -Math.atan2(end.y - start.y, end.x - start.x),
      })
    }

    let cursor = 0
    openings.forEach(({ opening, start: openingStart, end: openingEnd }) => {
      append(cursor, openingStart, architecture.wallHeightMm, 0, 'run')
      if (opening.kind === 'service-window') {
        const sill = Math.min(architecture.wallHeightMm, opening.sillHeightMm ?? 950)
        const openingHeight = Math.min(opening.heightMm ?? 900, architecture.wallHeightMm - sill)
        append(openingStart, openingEnd, sill, 0, 'below', opening.id)
        append(openingStart, openingEnd, architecture.wallHeightMm - sill - openingHeight, sill + openingHeight, 'above', opening.id)
      }
      cursor = Math.max(cursor, openingEnd)
    })
    append(cursor, edgeLength, architecture.wallHeightMm, 0, 'run')
  })
  return panels
}

export function serviceWindowFixtures(architecture: Architecture): ServiceWindowFixture[] {
  return architecture.openings.filter((opening): opening is Opening & { flow: 'clean-out' | 'dirty-in' } =>
    opening.kind === 'service-window' && (opening.flow === 'clean-out' || opening.flow === 'dirty-in'))
    .map((opening) => {
      const midpoint = opening.offsetMm + opening.widthMm / 2
      const sillHeightMm = opening.sillHeightMm ?? 950
      const openingHeightMm = opening.heightMm ?? 900
      if (opening.segmentIndex !== undefined) {
        const start = architecture.roomPolygon[opening.segmentIndex]
        const end = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
        if (start && end) {
          const center = pointAt(start, end, midpoint)
          return {
            id: opening.id,
            flow: opening.flow,
            label: opening.label,
            centerMm: { x: center.x, y: sillHeightMm, z: center.y },
            widthMm: opening.widthMm,
            sillHeightMm,
            openingHeightMm,
            rotationYRad: -Math.atan2(end.y - start.y, end.x - start.x),
          }
        }
      }
      if (opening.wall === 'top') return { id: opening.id, flow: opening.flow, label: opening.label, centerMm: { x: midpoint, y: sillHeightMm, z: 0 }, widthMm: opening.widthMm, sillHeightMm, openingHeightMm, rotationYRad: 0 }
      if (opening.wall === 'bottom') return { id: opening.id, flow: opening.flow, label: opening.label, centerMm: { x: midpoint, y: sillHeightMm, z: architecture.depthMm }, widthMm: opening.widthMm, sillHeightMm, openingHeightMm, rotationYRad: Math.PI }
      if (opening.wall === 'left') return { id: opening.id, flow: opening.flow, label: opening.label, centerMm: { x: 0, y: sillHeightMm, z: midpoint }, widthMm: opening.widthMm, sillHeightMm, openingHeightMm, rotationYRad: Math.PI / 2 }
      return { id: opening.id, flow: opening.flow, label: opening.label, centerMm: { x: architecture.widthMm, y: sillHeightMm, z: midpoint }, widthMm: opening.widthMm, sillHeightMm, openingHeightMm, rotationYRad: -Math.PI / 2 }
    })
}
