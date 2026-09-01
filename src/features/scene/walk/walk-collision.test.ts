import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import { buildWalkColliders, cameraYawForHeading, findD2Spawn, findJumpObstacle, resolveWalkStep, supportHeightAt } from './walk-collision'

describe('walk collision', () => {
  const project = createSeedProject()
  const colliders = buildWalkColliders(project.architecture, project.variants[0].equipment)

  it('places the player inside D2 and builds all solid collider families', () => {
    const spawn = findD2Spawn(project.architecture, colliders)
    expect(spawn.xMm).toBeGreaterThan(0)
    expect(spawn.headingRad).toBe(0)
    expect(cameraYawForHeading(spawn.headingRad)).toBe(-Math.PI / 2)
    expect(colliders.map((collider) => collider.kind)).toEqual(expect.arrayContaining(['wall', 'equipment', 'pillar', 'pass-ledge']))
    expect(colliders.find((collider) => collider.id === 'tandoor')).toMatchObject({ topMm: 900, jumpable: true, landable: true })
    expect(colliders.find((collider) => collider.kind === 'wall')).toMatchObject({ topMm: 2800, jumpable: false, landable: false })
    expect(colliders.find((collider) => collider.kind === 'pillar')).toMatchObject({ topMm: 2800, jumpable: false, landable: false })
    expect(colliders.find((collider) => collider.kind === 'pass-ledge')).toMatchObject({ topMm: 950, jumpable: true, landable: true })
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
