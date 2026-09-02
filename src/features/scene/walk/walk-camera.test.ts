import { describe, expect, it } from 'vitest'
import type { PointMm } from '../../../domain/project'
import type { WalkCollider } from './walk-collision'
import { createWalkPlayerPose } from './player-motion'
import { avatarYawForHeading, cameraTransformForPose, updateObstacleAwareChaseCamera } from './walk-camera'

const polygon = (left: number, top: number, right: number, bottom: number): PointMm[] => [
  { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom },
]

describe('walk camera', () => {
  it('derives first- and third-person transforms from one immutable pose', () => {
    const pose = {
      ...createWalkPlayerPose({ xMm: 2000, yMm: 3000, headingRad: Math.PI / 3 }),
      pitchRad: -.2,
      elevationMm: 850,
      verticalVelocityMps: 1.7,
      grounded: false,
      nearbyInteractionIds: ['pass'],
    }
    const snapshot = structuredClone(pose)
    const first = cameraTransformForPose(pose, 'first-person')
    const third = cameraTransformForPose(pose, 'third-person', 2600)

    expect(first.position).toEqual({ xMm: 2000, heightMm: 2530, yMm: 3000 })
    expect(third.position).not.toEqual(first.position)
    expect(third.target.heightMm).toBeGreaterThan(pose.elevationMm)
    expect(third.target.heightMm).toBeLessThan(cameraTransformForPose({ ...pose, pitchRad: .2 }, 'third-person', 2600).target.heightMm)
    expect(avatarYawForHeading(0)).toBeCloseTo(Math.PI / 2)
    expect(avatarYawForHeading(Math.PI / 2)).toBeCloseTo(0)
    expect(pose).toEqual(snapshot)
  })

  it('shortens the chase boom around obstacles and eases back only after the view clears', () => {
    const pose = createWalkPlayerPose({ xMm: 3000, yMm: 3000, headingRad: 0 })
    const wall: WalkCollider = {
      id: 'rear-wall',
      kind: 'wall',
      polygon: polygon(1350, 2000, 1550, 4000),
      topMm: 2800,
      jumpable: false,
      landable: false,
    }
    const obstructed = updateObstacleAwareChaseCamera({
      pose,
      colliders: [wall],
      desiredBoomMm: 2800,
      previousBoomMm: 2800,
      deltaSeconds: 1 / 60,
    })
    const clearing = updateObstacleAwareChaseCamera({
      pose,
      colliders: [],
      desiredBoomMm: 2800,
      previousBoomMm: obstructed.boomMm,
      deltaSeconds: .1,
    })

    expect(obstructed.boomMm).toBeLessThan(1400)
    expect(clearing.boomMm).toBeGreaterThan(obstructed.boomMm)
    expect(clearing.boomMm).toBeLessThan(2800)
  })

  it('ignores low obstacles below the chase sightline', () => {
    const pose = createWalkPlayerPose({ xMm: 3000, yMm: 3000, headingRad: 0 })
    const dunnage: WalkCollider = {
      id: 'low-rack',
      kind: 'equipment',
      polygon: polygon(1400, 2200, 1700, 3800),
      topMm: 300,
      jumpable: true,
      landable: true,
    }

    expect(updateObstacleAwareChaseCamera({
      pose,
      colliders: [dunnage],
      desiredBoomMm: 2800,
      previousBoomMm: 2800,
      deltaSeconds: .1,
    }).boomMm).toBe(2800)
  })
})
