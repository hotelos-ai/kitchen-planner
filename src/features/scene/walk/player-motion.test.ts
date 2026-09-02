import { describe, expect, it } from 'vitest'
import type { PointMm } from '../../../domain/project'
import type { WalkCollider, WalkSpawn } from './walk-collision'
import { EMPTY_WALK_INPUT } from './walk-input'
import {
  MAX_JUMP_VELOCITY_MPS,
  advanceWalkPlayerMotion,
  createWalkPlayerPose,
} from './player-motion'

const spawn: WalkSpawn = { xMm: 0, yMm: 0, headingRad: 0 }
const polygon = (left: number, top: number, right: number, bottom: number): PointMm[] => [
  { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom },
]

describe('walk player motion', () => {
  it('creates a camera-independent pose with all persistent motion and interaction state', () => {
    expect(createWalkPlayerPose(spawn)).toEqual({
      x: 0,
      y: 0,
      headingRad: 0,
      pitchRad: 0,
      elevationMm: 0,
      velocityMmPerSecond: { x: 0, y: 0 },
      verticalVelocityMps: 0,
      grounded: true,
      locomotion: 'idle',
      nearbyInteractionIds: [],
    })
  })

  it('moves forward and strafes right from pose heading without consulting a camera', () => {
    const initial = createWalkPlayerPose(spawn)
    const forward = advanceWalkPlayerMotion({
      pose: initial,
      input: { ...EMPTY_WALK_INPUT, forward: true },
      deltaSeconds: 1,
      colliders: [],
      staff: [],
    }).pose
    const right = advanceWalkPlayerMotion({
      pose: initial,
      input: { ...EMPTY_WALK_INPUT, right: true },
      deltaSeconds: 1,
      colliders: [],
      staff: [],
    }).pose

    expect(forward.x).toBeCloseTo(1450)
    expect(forward.y).toBeCloseTo(0)
    expect(right.x).toBeCloseTo(0)
    expect(right.y).toBeCloseTo(1450)
    expect(forward.locomotion).toBe('walking')
  })

  it('turns with arrows while retaining conventional A/D strafing controls', () => {
    const turned = advanceWalkPlayerMotion({
      pose: createWalkPlayerPose(spawn),
      input: { ...EMPTY_WALK_INPUT, turnLeft: true },
      deltaSeconds: .5,
      colliders: [],
      staff: [],
    }).pose

    expect(turned.headingRad).toBeGreaterThan(0)
    expect(turned.x).toBe(0)
    expect(turned.y).toBe(0)
  })

  it('resolves body collision and caps adaptive jumps so tall solid objects remain barriers', () => {
    const tall: WalkCollider = {
      id: 'tall-solid',
      kind: 'equipment',
      polygon: polygon(300, -500, 1100, 500),
      topMm: 2400,
      jumpable: true,
      landable: true,
    }
    const result = advanceWalkPlayerMotion({
      pose: createWalkPlayerPose(spawn),
      input: { ...EMPTY_WALK_INPUT, forward: true, jump: true },
      deltaSeconds: .05,
      colliders: [tall],
      staff: [],
      jumpRequested: true,
    })

    expect(result.pose.x).toBeLessThan(300)
    expect(result.pose.grounded).toBe(false)
    expect(result.pose.verticalVelocityMps).toBeGreaterThan(0)
    expect(result.pose.verticalVelocityMps).toBeLessThanOrEqual(MAX_JUMP_VELOCITY_MPS)
    expect(result.colliderIds).toContain('tall-solid')
  })

  it('preserves vertical motion and nearby interaction identity between subsequent frames', () => {
    const airborne = {
      ...createWalkPlayerPose(spawn),
      elevationMm: 600,
      verticalVelocityMps: 2,
      grounded: false,
      nearbyInteractionIds: ['chef-2'],
    }
    const next = advanceWalkPlayerMotion({
      pose: airborne,
      input: EMPTY_WALK_INPUT,
      deltaSeconds: .05,
      colliders: [],
      staff: [{ agentId: 'chef-2', xMm: 300, yMm: 0 }],
    }).pose

    expect(next.elevationMm).toBeGreaterThan(600)
    expect(next.verticalVelocityMps).toBeLessThan(2)
    expect(next.nearbyInteractionIds).toEqual(['chef-2'])
  })
})
