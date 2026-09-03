import type { EquipmentItem, PointMm } from './project'

export const snapMm = (value: number, interval: number) => Math.round(value / interval) * interval
export const normalizeRotation = (degrees: number) => ((degrees % 360) + 360) % 360

type RotatableRect = Pick<EquipmentItem, 'xMm' | 'yMm' | 'widthMm' | 'depthMm' | 'rotationDeg'>

export function rotateInPlace(item: RotatableRect, deltaDeg: number): Pick<EquipmentItem, 'xMm' | 'yMm' | 'rotationDeg'> {
  const previousRadians = normalizeRotation(item.rotationDeg) * Math.PI / 180
  const rotationDeg = normalizeRotation(item.rotationDeg + deltaDeg)
  const nextRadians = rotationDeg * Math.PI / 180
  const halfWidth = item.widthMm / 2
  const halfDepth = item.depthMm / 2
  const rotatedCenterOffset = (radians: number) => ({
    x: halfWidth * Math.cos(radians) - halfDepth * Math.sin(radians),
    y: halfWidth * Math.sin(radians) + halfDepth * Math.cos(radians),
  })
  const previousOffset = rotatedCenterOffset(previousRadians)
  const nextOffset = rotatedCenterOffset(nextRadians)
  return {
    xMm: item.xMm + previousOffset.x - nextOffset.x,
    yMm: item.yMm + previousOffset.y - nextOffset.y,
    rotationDeg,
  }
}

export function rotatedFootprint(item: EquipmentItem): PointMm[] {
  const radians = normalizeRotation(item.rotationDeg) * Math.PI / 180
  const corners = [
    { x: 0, y: 0 },
    { x: item.widthMm, y: 0 },
    { x: item.widthMm, y: item.depthMm },
    { x: 0, y: item.depthMm },
  ]
  return corners.map(({ x, y }) => ({
    x: item.xMm + x * Math.cos(radians) - y * Math.sin(radians),
    y: item.yMm + x * Math.sin(radians) + y * Math.cos(radians),
  }))
}

const axesFor = (polygon: PointMm[]) => polygon.map((point, index) => {
  const next = polygon[(index + 1) % polygon.length]
  const edge = { x: next.x - point.x, y: next.y - point.y }
  const length = Math.hypot(edge.x, edge.y) || 1
  return { x: -edge.y / length, y: edge.x / length }
})

const projection = (polygon: PointMm[], axis: PointMm) => {
  const values = polygon.map((point) => point.x * axis.x + point.y * axis.y)
  return { min: Math.min(...values), max: Math.max(...values) }
}

export function polygonsOverlap(first: PointMm[], second: PointMm[]): boolean {
  if (first.length < 3 || second.length < 3) return false
  return [...axesFor(first), ...axesFor(second)].every((axis) => {
    const a = projection(first, axis)
    const b = projection(second, axis)
    return a.max > b.min && b.max > a.min
  })
}

export function pointInPolygon(point: PointMm, polygon: PointMm[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]
    const b = polygon[previous]
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x
    if (intersects) inside = !inside
  }
  return inside
}
