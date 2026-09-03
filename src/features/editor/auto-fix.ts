import type { Architecture, EquipmentItem, PointMm } from '../../domain/project'

export type AutoFixStrategy = 'rearrange' | 'boundary'
export type EquipmentMove = { id: string; xMm: number; yMm: number }

const MARGIN_MM = 300
const SPIRAL_MAX_RING = 40

const pointInPolygon = (point: PointMm, polygon: PointMm[]): boolean => {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]
    const prior = polygon[previous]
    if ((current.y > point.y) !== (prior.y > point.y)
      && point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x) {
      inside = !inside
    }
  }
  return inside
}

const itemFootprint = (item: EquipmentItem): PointMm[] => {
  const half = { x: item.widthMm / 2, y: item.depthMm / 2 }
  return [
    { x: item.xMm - half.x, y: item.yMm - half.y },
    { x: item.xMm + half.x, y: item.yMm - half.y },
    { x: item.xMm + half.x, y: item.yMm + half.y },
    { x: item.xMm - half.x, y: item.yMm + half.y },
  ]
}

export const itemInsideRoom = (item: EquipmentItem, architecture: Architecture): boolean =>
  itemFootprint(item).every((corner) => pointInPolygon(corner, architecture.roomPolygon))

const rectsOverlap = (a: { x: number; y: number; width: number; depth: number }, b: { x: number; y: number; width: number; depth: number }): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth

const pillarRects = (architecture: Architecture) => architecture.pillars.map((pillar) => ({ x: pillar.xMm, y: pillar.yMm, width: pillar.widthMm, depth: pillar.depthMm }))

const itemFits = (item: EquipmentItem, xMm: number, yMm: number, architecture: Architecture, placed: EquipmentItem[]): boolean => {
  const candidate = { ...item, xMm, yMm }
  if (!itemInsideRoom(candidate, architecture)) return false
  const rect = { x: xMm - item.widthMm / 2, y: yMm - item.depthMm / 2, width: item.widthMm, depth: item.depthMm }
  if (pillarRects(architecture).some((pillar) => rectsOverlap(rect, pillar))) return false
  return !placed.some((other) => rectsOverlap(rect, { x: other.xMm - other.widthMm / 2, y: other.yMm - other.depthMm / 2, width: other.widthMm, depth: other.depthMm }))
}

const clampInsideBounds = (value: number, sizeMm: number, bound: number): number =>
  Math.min(Math.max(sizeMm / 2 + MARGIN_MM, value), Math.max(sizeMm / 2 + MARGIN_MM, bound - sizeMm / 2 - MARGIN_MM))

export function fixByRearranging(architecture: Architecture, equipment: readonly EquipmentItem[], snapMm: number): EquipmentMove[] {
  const ordered = [...equipment].sort((a, b) => b.widthMm * b.depthMm - a.widthMm * a.depthMm)
  const placed: EquipmentItem[] = []
  const moves: EquipmentMove[] = []
  for (const item of ordered) {
    const snap = (value: number) => Math.round(value / snapMm) * snapMm
    const startX = clampInsideBounds(snap(item.xMm), item.widthMm, architecture.widthMm)
    const startY = clampInsideBounds(snap(item.yMm), item.depthMm, architecture.depthMm)
    let position = { x: startX, y: startY }
    if (!itemFits(item, position.x, position.y, architecture, placed)) {
      position = { x: snap(architecture.widthMm / 2), y: snap(architecture.depthMm / 2) }
      let found = itemFits(item, position.x, position.y, architecture, placed)
      for (let ring = 1; !found && ring <= SPIRAL_MAX_RING; ring += 1) {
        const step = ring * snapMm * 4
        const candidates: PointMm[] = [
          { x: startX + step, y: startY }, { x: startX - step, y: startY },
          { x: startX, y: startY + step }, { x: startX, y: startY - step },
          { x: startX + step, y: startY + step }, { x: startX - step, y: startY - step },
          { x: startX + step, y: startY - step }, { x: startX - step, y: startY + step },
        ]
        for (const candidate of candidates) {
          const x = snap(candidate.x)
          const y = snap(candidate.y)
          if (itemFits(item, x, y, architecture, placed)) {
            position = { x, y }
            found = true
            break
          }
        }
      }
      if (!found) continue
    }
    placed.push({ ...item, xMm: position.x, yMm: position.y })
    if (position.x !== item.xMm || position.y !== item.yMm) moves.push({ id: item.id, xMm: position.x, yMm: position.y })
  }
  return moves
}

export function fixByBoundary(architecture: Architecture, equipment: readonly EquipmentItem[], snapMm: number): Architecture {
  if (equipment.length === 0) return architecture
  const neededMinX = Math.min(...equipment.map((item) => item.xMm - item.widthMm / 2)) - MARGIN_MM
  const neededMaxX = Math.max(...equipment.map((item) => item.xMm + item.widthMm / 2)) + MARGIN_MM
  const neededMinY = Math.min(...equipment.map((item) => item.yMm - item.depthMm / 2)) - MARGIN_MM
  const neededMaxY = Math.max(...equipment.map((item) => item.yMm + item.depthMm / 2)) + MARGIN_MM
  const roomMinX = Math.min(...architecture.roomPolygon.map((vertex) => vertex.x))
  const roomMaxX = Math.max(...architecture.roomPolygon.map((vertex) => vertex.x))
  const roomMinY = Math.min(...architecture.roomPolygon.map((vertex) => vertex.y))
  const roomMaxY = Math.max(...architecture.roomPolygon.map((vertex) => vertex.y))
  const minX = Math.min(neededMinX, roomMinX)
  const maxX = Math.max(neededMaxX, roomMaxX)
  const minY = Math.min(neededMinY, roomMinY)
  const maxY = Math.max(neededMaxY, roomMaxY)
  const snap = (value: number) => Math.round(value / snapMm) * snapMm
  const roomPolygon = architecture.roomPolygon.map((vertex) => ({
    x: vertex.x <= roomMinX && minX < roomMinX ? snap(minX) : vertex.x >= roomMaxX && maxX > roomMaxX ? snap(maxX) : vertex.x,
    y: vertex.y <= roomMinY && minY < roomMinY ? snap(minY) : vertex.y >= roomMaxY && maxY > roomMaxY ? snap(maxY) : vertex.y,
  }))
  if (roomPolygon.every((vertex, index) => vertex.x === architecture.roomPolygon[index].x && vertex.y === architecture.roomPolygon[index].y)) return architecture
  return {
    ...architecture,
    roomPolygon,
    widthMm: Math.max(100, ...roomPolygon.map((vertex) => vertex.x)),
    depthMm: Math.max(100, ...roomPolygon.map((vertex) => vertex.y)),
  }
}
