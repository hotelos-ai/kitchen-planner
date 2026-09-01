import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import { buildWalkColliders, findD2Spawn, resolveWalkStep } from './walk-collision'

describe('walk collision', () => {
  const project = createSeedProject()
  const colliders = buildWalkColliders(project.architecture, project.variants[0].equipment)

  it('places the player inside D2 and builds all solid collider families', () => {
    const spawn = findD2Spawn(project.architecture, colliders)
    expect(spawn.xMm).toBeGreaterThan(0)
    expect(colliders.map((collider) => collider.kind)).toEqual(expect.arrayContaining(['wall', 'equipment', 'pillar', 'pass-ledge']))
  })

  it('resolves a horizontal step without crossing a solid wall', () => {
    const result = resolveWalkStep({ positionMm: { x: 400, y: 1000 }, radiusMm: 260 }, { x: -600, y: 0 }, colliders)
    expect(result.positionMm.x).toBeGreaterThanOrEqual(260)
    expect(result.collided).toBe(true)
  })

  it('slides along equipment instead of teleporting through it', () => {
    const result = resolveWalkStep({ positionMm: { x: 1500, y: 1800 }, radiusMm: 220 }, { x: 900, y: -900 }, colliders)
    expect(Number.isFinite(result.positionMm.x)).toBe(true)
    expect(Number.isFinite(result.positionMm.y)).toBe(true)
  })
})
