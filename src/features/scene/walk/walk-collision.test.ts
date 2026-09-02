import { describe, expect, it } from 'vitest'
import { pointInPolygon } from '../../../domain/geometry'
import { createSeedProject } from '../../../domain/seed-project'
import type { Architecture, PointMm } from '../../../domain/project'
import { buildWalkColliders, cameraYawForHeading, findJumpObstacle, resolveWalkSpawn, resolveWalkStep, supportHeightAt, type WalkCollider } from './walk-collision'

const solidCollider = (id: string, polygon: PointMm[]): WalkCollider => ({
  id,
  polygon,
  kind: 'equipment',
  topMm: 2000,
  jumpable: false,
  landable: false,
})

const distanceToSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy || 1
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - start.x - dx * amount, point.y - start.y - dy * amount)
}

const boundaryDistance = (point: PointMm, polygon: readonly PointMm[]) => Math.min(...polygon.map((start, index) =>
  distanceToSegment(point, start, polygon[(index + 1) % polygon.length])))

describe('walk collision', () => {
  const project = createSeedProject()
  const colliders = buildWalkColliders(project.architecture, project.variants[0].equipment)

  it('places the player inside D2 and builds all solid collider families', () => {
    const resolution = resolveWalkSpawn(project.architecture, colliders)
    expect(resolution.status).toBe('ready')
    if (resolution.status !== 'ready') throw new Error('Expected an entry spawn')
    const { spawn } = resolution
    expect(spawn.xMm).toBeGreaterThan(0)
    expect(spawn.headingRad).toBe(0)
    expect(cameraYawForHeading(spawn.headingRad)).toBe(-Math.PI / 2)
    expect(colliders.map((collider) => collider.kind)).toEqual(expect.arrayContaining(['wall', 'equipment', 'pillar', 'pass-ledge']))
    expect(colliders.find((collider) => collider.id === 'tandoor')).toMatchObject({ topMm: 900, jumpable: true, landable: true })
    expect(colliders.find((collider) => collider.kind === 'wall')).toMatchObject({ topMm: 2800, jumpable: false, landable: false })
    expect(colliders.find((collider) => collider.kind === 'pillar')).toMatchObject({ topMm: 2800, jumpable: false, landable: false })
    expect(colliders.find((collider) => collider.kind === 'pass-ledge')).toMatchObject({ topMm: 950, jumpable: true, landable: true })
  })

  it('falls back to a valid interior spawn when no staff entry is declared', () => {
    const architecture: Architecture = {
      ...project.architecture,
      openings: project.architecture.openings.filter((opening) => opening.flow !== 'entry'),
    }
    const resolution = resolveWalkSpawn(architecture, buildWalkColliders(architecture, project.variants[0].equipment))

    expect(resolution).toMatchObject({ status: 'ready', source: 'interior' })
    if (resolution.status !== 'ready') throw new Error('Expected an interior spawn')
    expect(pointInPolygon({ x: resolution.spawn.xMm, y: resolution.spawn.yMm }, architecture.roomPolygon)).toBe(true)
  })

  it('falls back to the room search when every declared-entry probe is blocked', () => {
    const entryBlocker = solidCollider('blocked-entry', [
      { x: 150, y: 5150 }, { x: 2100, y: 5150 }, { x: 2100, y: 6650 }, { x: 150, y: 6650 },
    ])
    const resolution = resolveWalkSpawn(project.architecture, [...colliders, entryBlocker])

    expect(resolution).toMatchObject({ status: 'ready', source: 'interior' })
    if (resolution.status !== 'ready') throw new Error('Expected an interior spawn')
    expect(pointInPolygon({ x: resolution.spawn.xMm, y: resolution.spawn.yMm }, entryBlocker.polygon)).toBe(false)
  })

  it('returns a typed unavailable result without throwing when the room is fully obstructed', () => {
    const roomBlocker = solidCollider('blocked-room', project.architecture.roomPolygon)

    expect(() => resolveWalkSpawn(project.architecture, [...colliders, roomBlocker])).not.toThrow()
    expect(resolveWalkSpawn(project.architecture, [...colliders, roomBlocker])).toEqual({
      status: 'unavailable',
      code: 'no-valid-spawn',
      message: 'No safe walkthrough start is available. Add a staff entry or clear space inside the room.',
    })
  })

  it('searches deterministically inside jagged room boundaries with full player clearance', () => {
    const architecture: Architecture = {
      ...project.architecture,
      widthMm: 2000,
      depthMm: 2000,
      roomPolygon: [
        { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 800 },
        { x: 800, y: 800 }, { x: 800, y: 2000 }, { x: 0, y: 2000 },
      ],
      openings: [],
      pillars: [],
      storageZones: [],
    }
    const jaggedColliders = buildWalkColliders(architecture, [])
    const first = resolveWalkSpawn(architecture, jaggedColliders)
    const second = resolveWalkSpawn(architecture, jaggedColliders)

    expect(second).toEqual(first)
    expect(first).toMatchObject({ status: 'ready', source: 'interior' })
    if (first.status !== 'ready') throw new Error('Expected an interior spawn')
    const point = { x: first.spawn.xMm, y: first.spawn.yMm }
    expect(pointInPolygon(point, architecture.roomPolygon)).toBe(true)
    expect(boundaryDistance(point, architecture.roomPolygon)).toBeGreaterThanOrEqual(260)
  })

  it('resolves a horizontal step without crossing a solid wall', () => {
    const result = resolveWalkStep({ positionMm: { x: 400, y: 1000 }, radiusMm: 260 }, { x: -600, y: 0 }, colliders, 5000)
    expect(result.positionMm.x).toBeGreaterThanOrEqual(260)
    expect(result.collided).toBe(true)
  })

  it('slides along equipment instead of teleporting through it', () => {
    const result = resolveWalkStep({ positionMm: { x: 1500, y: 1800 }, radiusMm: 220 }, { x: 900, y: -900 }, colliders, 0)
    expect(Number.isFinite(result.positionMm.x)).toBe(true)
    expect(Number.isFinite(result.positionMm.y)).toBe(true)
  })

  it('blocks equipment below its top but permits movement above its clearance plane', () => {
    const body = { positionMm: { x: 2000, y: 1250 }, radiusMm: 200 }
    const delta = { x: 600, y: 0 }
    const floor = resolveWalkStep(body, delta, colliders, 0)
    const airborne = resolveWalkStep(body, delta, colliders, 1100)
    expect(floor.collided).toBe(true)
    expect(floor.colliderIds).toContain('tandoor')
    expect(airborne.positionMm.x).toBe(2600)
    expect(airborne.colliderIds).not.toContain('tandoor')
  })

  it('returns exact landable support height and the nearest jumpable obstacle', () => {
    const table = project.variants[0].equipment.find((item) => item.id === 'working-table')!
    expect(supportHeightAt({ x: 2200, y: 3000 }, colliders)).toBe(table.heightMm)
    expect(supportHeightAt({ x: 1500, y: 3500 }, colliders)).toBe(0)
    expect(findJumpObstacle(
      { positionMm: { x: 2750, y: 2050 }, radiusMm: 260 },
      { x: 0, y: -1 },
      colliders,
    )).toMatchObject({ id: 'tandoor', topMm: 900 })
  })

  it('ignores the support under the player when targeting the next obstacle', () => {
    expect(findJumpObstacle(
      { positionMm: { x: 2200, y: 3000 }, radiusMm: 220 },
      { x: 1, y: 0 },
      colliders,
    )).toMatchObject({ id: 'prep-fridge-counter', topMm: 850 })
  })
})
