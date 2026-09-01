import { pointInPolygon, rotatedFootprint } from '../../../domain/geometry'
import type { Architecture, EquipmentItem, PointMm, RectMm } from '../../../domain/project'
import { buildWallPanels, serviceWindowFixtures } from '../wall-geometry'

export type WalkColliderKind = 'wall' | 'equipment' | 'pillar' | 'pass-ledge'
export type WalkCollider = {
  id: string
  kind: WalkColliderKind
  polygon: PointMm[]
  topMm: number
  jumpable: boolean
  landable: boolean
}
export type WalkBody = { positionMm: PointMm; radiusMm: number }

export const cameraYawForHeading = (headingRad: number) => -Math.PI / 2 - headingRad

const rectPolygon = (rect: RectMm): PointMm[] => [
  { x: rect.xMm, y: rect.yMm }, { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm }, { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const centeredRect = (x: number, y: number, width: number, depth: number, angleRad: number): PointMm[] => {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]].map(([localX, localY]) => ({
    x: x + localX * cos - localY * sin,
    y: y + localX * sin + localY * cos,
  }))
}

export function buildWalkColliders(architecture: Architecture, equipment: readonly EquipmentItem[]): WalkCollider[] {
  const seenWalls = new Set<string>()
  const walls = buildWallPanels(architecture).flatMap((panel): WalkCollider[] => {
    const key = `${panel.wall}-${panel.offsetStartMm}-${panel.offsetEndMm}-${panel.openingId ?? ''}`
    if (seenWalls.has(key)) return []
    seenWalls.add(key)
    return [{
      id: panel.id,
      kind: 'wall',
      polygon: centeredRect(panel.centerMm.x, panel.centerMm.z, panel.sizeMm.width, panel.sizeMm.depth, -panel.rotationYRad),
      topMm: architecture.wallHeightMm,
      jumpable: false,
      landable: false,
    }]
  })
  const equipmentColliders: WalkCollider[] = equipment.filter((item) => item.category !== 'hood').map((item) => ({
    id: item.id,
    kind: 'equipment',
    polygon: rotatedFootprint(item),
    topMm: item.heightMm,
    jumpable: true,
    landable: true,
  }))
  const pillars: WalkCollider[] = architecture.pillars.map((pillar) => ({
    id: pillar.id,
    kind: 'pillar',
    polygon: rectPolygon(pillar),
    topMm: architecture.wallHeightMm,
    jumpable: false,
    landable: false,
  }))
  const ledges: WalkCollider[] = serviceWindowFixtures(architecture).map((fixture) => ({
    id: `ledge-${fixture.id}`,
    kind: 'pass-ledge',
    polygon: centeredRect(fixture.centerMm.x, fixture.centerMm.z, fixture.widthMm + 140, 460, -fixture.rotationYRad),
    topMm: fixture.sillHeightMm,
    jumpable: true,
    landable: true,
  }))
  return [...walls, ...equipmentColliders, ...pillars, ...ledges]
}

const closestOnSegment = (point: PointMm, start: PointMm, end: PointMm): PointMm => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy || 1
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return { x: start.x + dx * amount, y: start.y + dy * amount }
}

const nearestBoundary = (point: PointMm, polygon: readonly PointMm[]) => polygon.reduce((nearest, start, index) => {
  const candidate = closestOnSegment(point, start, polygon[(index + 1) % polygon.length])
  const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y)
  return distance < nearest.distance ? { point: candidate, distance } : nearest
}, { point: polygon[0], distance: Infinity })

const resolveCircle = (position: PointMm, radiusMm: number, collider: WalkCollider): { position: PointMm; collided: boolean } => {
  const nearest = nearestBoundary(position, collider.polygon)
  const inside = pointInPolygon(position, collider.polygon)
  if (!inside && nearest.distance >= radiusMm) return { position, collided: false }
  const dx = position.x - nearest.point.x
  const dy = position.y - nearest.point.y
  const length = Math.hypot(dx, dy)
  const unit = length > .001 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }
  const correction = inside ? -(radiusMm + length + .5) : radiusMm - length + .5
  return { position: { x: position.x + unit.x * correction, y: position.y + unit.y * correction }, collided: true }
}

const overlapsAny = (position: PointMm, radiusMm: number, colliders: readonly WalkCollider[]) => colliders.some((collider) => {
  const nearest = nearestBoundary(position, collider.polygon)
  return pointInPolygon(position, collider.polygon) || nearest.distance < radiusMm
})

const blocksAtFootHeight = (collider: WalkCollider, footHeightMm: number) =>
  !collider.jumpable || footHeightMm < collider.topMm + 40

export function resolveWalkStep(body: WalkBody, intendedDeltaMm: PointMm, colliders: readonly WalkCollider[], footHeightMm = 0): { positionMm: PointMm; collided: boolean; colliderIds: string[] } {
  const distance = Math.hypot(intendedDeltaMm.x, intendedDeltaMm.y)
  const steps = Math.max(1, Math.ceil(distance / 60))
  let position = { ...body.positionMm }
  let collided = false
  const colliderIds = new Set<string>()
  for (let step = 0; step < steps; step += 1) {
    position = { x: position.x + intendedDeltaMm.x / steps, y: position.y + intendedDeltaMm.y / steps }
    for (let pass = 0; pass < 3; pass += 1) colliders.filter((collider) => blocksAtFootHeight(collider, footHeightMm)).forEach((collider) => {
      const resolved = resolveCircle(position, body.radiusMm, collider)
      if (resolved.collided) { collided = true; colliderIds.add(collider.id); position = resolved.position }
    })
  }
  return { positionMm: position, collided, colliderIds: [...colliderIds] }
}

export function supportHeightAt(position: PointMm, colliders: readonly WalkCollider[]): number {
  return colliders
    .filter((collider) => collider.landable && pointInPolygon(position, collider.polygon))
    .reduce((height, collider) => Math.max(height, collider.topMm), 0)
}

export function findJumpObstacle(body: WalkBody, direction: PointMm, colliders: readonly WalkCollider[]): WalkCollider | undefined {
  const length = Math.hypot(direction.x, direction.y)
  if (length < .001) return undefined
  const unit = { x: direction.x / length, y: direction.y / length }
  const jumpable = colliders.filter((collider) =>
    collider.jumpable && !pointInPolygon(body.positionMm, collider.polygon),
  )
  for (let distance = body.radiusMm; distance <= 1400; distance += 40) {
    const sample = {
      x: body.positionMm.x + unit.x * distance,
      y: body.positionMm.y + unit.y * distance,
    }
    const hit = jumpable.find((collider) => {
      const nearest = nearestBoundary(sample, collider.polygon)
      return pointInPolygon(sample, collider.polygon) || nearest.distance < body.radiusMm
    })
    if (hit) return hit
  }
  return undefined
}

export function findD2Spawn(architecture: Architecture, colliders: readonly WalkCollider[]): { xMm: number; yMm: number; headingRad: number } {
  const door = architecture.openings.find((opening) => opening.kind === 'door' && opening.flow === 'entry')
  if (!door) throw new Error('D2 entry is required for Walk Kitchen')
  const middle = door.offsetMm + door.widthMm / 2
  const inward = door.wall === 'left' ? { x: 1, y: 0 } : door.wall === 'right' ? { x: -1, y: 0 } : door.wall === 'top' ? { x: 0, y: 1 } : { x: 0, y: -1 }
  const edge = door.wall === 'left' ? { x: 0, y: middle } : door.wall === 'right' ? { x: architecture.widthMm, y: middle } : door.wall === 'top' ? { x: middle, y: 0 } : { x: middle, y: architecture.depthMm }
  for (let distance = 450; distance <= 1800; distance += 100) {
    for (const lateral of [0, 150, -150, 300, -300]) {
      const candidate = { x: edge.x + inward.x * distance - inward.y * lateral, y: edge.y + inward.y * distance + inward.x * lateral }
      if (!overlapsAny(candidate, 260, colliders)) return { xMm: candidate.x, yMm: candidate.y, headingRad: Math.atan2(inward.y, inward.x) }
    }
  }
  throw new Error('D2 spawn is obstructed')
}
