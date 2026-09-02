import type { PointMm } from '../../../domain/project'
import { softenPlayerStep } from './staff-proximity'
import {
  findJumpObstacle,
  resolveWalkStep,
  supportHeightAt,
  type WalkCollider,
  type WalkSpawn,
} from './walk-collision'
import type { WalkInputState } from './walk-input'
import { advanceVerticalMotion, jumpVelocityForObstacle } from './walk-motion'
import type { WalkLocomotionState, WalkPlayerPose } from './types'

export const WALK_SPEED_MPS = 1.45
export const BOOST_SPEED_MPS = 2.35
export const PLAYER_RADIUS_MM = 260
export const TURN_SPEED_RAD_PER_SECOND = 2.15
export const MAX_JUMP_VELOCITY_MPS = 5.4

const normalizeAngle = (angle: number) => {
  const wrapped = angle % (Math.PI * 2)
  return wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped < -Math.PI ? wrapped + Math.PI * 2 : wrapped
}

export function createWalkPlayerPose(spawn: WalkSpawn): WalkPlayerPose {
  return {
    x: spawn.xMm,
    y: spawn.yMm,
    headingRad: spawn.headingRad,
    pitchRad: 0,
    elevationMm: 0,
    velocityMmPerSecond: { x: 0, y: 0 },
    verticalVelocityMps: 0,
    grounded: true,
    locomotion: 'idle',
    nearbyInteractionIds: [],
  }
}

const planarDirection = (headingRad: number, input: WalkInputState): PointMm => {
  const forward = { x: Math.cos(headingRad), y: Math.sin(headingRad) }
  const right = { x: -forward.y, y: forward.x }
  const direction = {
    x: forward.x * (Number(input.forward) - Number(input.backward)) + right.x * (Number(input.right) - Number(input.left)),
    y: forward.y * (Number(input.forward) - Number(input.backward)) + right.y * (Number(input.right) - Number(input.left)),
  }
  const length = Math.hypot(direction.x, direction.y)
  return length > 0 ? { x: direction.x / length, y: direction.y / length } : { x: 0, y: 0 }
}

const locomotionFor = (moving: boolean, boosted: boolean, wasGrounded: boolean, grounded: boolean, velocityMps: number): WalkLocomotionState => {
  if (!wasGrounded && grounded) return 'landing'
  if (!grounded) return velocityMps >= 0 ? 'jumping' : 'falling'
  if (!moving) return 'idle'
  return boosted ? 'running' : 'walking'
}

export function advanceWalkPlayerMotion({
  pose,
  input,
  deltaSeconds,
  colliders,
  staff,
  jumpRequested = false,
}: {
  pose: WalkPlayerPose
  input: WalkInputState
  deltaSeconds: number
  colliders: readonly WalkCollider[]
  staff: readonly { agentId: string; xMm: number; yMm: number }[]
  jumpRequested?: boolean
}): { pose: WalkPlayerPose; colliderIds: string[] } {
  const safeDelta = Math.max(0, deltaSeconds)
  const headingRad = normalizeAngle(pose.headingRad + (Number(input.turnLeft) - Number(input.turnRight)) * TURN_SPEED_RAD_PER_SECOND * safeDelta)
  const direction = planarDirection(headingRad, input)
  const moving = Math.hypot(direction.x, direction.y) > 0
  const speedMmPerSecond = (input.boost ? BOOST_SPEED_MPS : WALK_SPEED_MPS) * 1000
  const velocityMmPerSecond = moving ? { x: direction.x * speedMmPerSecond, y: direction.y * speedMmPerSecond } : { x: 0, y: 0 }
  const intendedDelta = { x: velocityMmPerSecond.x * safeDelta, y: velocityMmPerSecond.y * safeDelta }
  const softened = softenPlayerStep({ x: pose.x, y: pose.y }, intendedDelta, staff)
  const body = { positionMm: { x: pose.x, y: pose.y }, radiusMm: PLAYER_RADIUS_MM }
  const resolved = resolveWalkStep(body, softened.delta, colliders, pose.elevationMm)
  const supportHeightMm = supportHeightAt(resolved.positionMm, colliders)
  let vertical = { footHeightMm: pose.elevationMm, velocityMps: pose.verticalVelocityMps, grounded: pose.grounded }

  if (jumpRequested && pose.grounded) {
    const jumpDirection = moving ? direction : { x: Math.cos(headingRad), y: Math.sin(headingRad) }
    const obstacle = findJumpObstacle(body, jumpDirection, colliders)
    vertical = {
      ...vertical,
      velocityMps: Math.min(MAX_JUMP_VELOCITY_MPS, jumpVelocityForObstacle({
        obstacleTopMm: obstacle?.topMm ?? supportHeightMm,
        supportHeightMm: pose.elevationMm,
      })),
      grounded: false,
    }
  }

  const nextVertical = advanceVerticalMotion(vertical, safeDelta, supportHeightMm)
  return {
    pose: {
      ...pose,
      x: resolved.positionMm.x,
      y: resolved.positionMm.y,
      headingRad,
      elevationMm: nextVertical.footHeightMm,
      velocityMmPerSecond,
      verticalVelocityMps: nextVertical.velocityMps,
      grounded: nextVertical.grounded,
      locomotion: locomotionFor(moving, input.boost, pose.grounded, nextVertical.grounded, nextVertical.velocityMps),
      nearbyInteractionIds: softened.overlappingAgentIds,
    },
    colliderIds: resolved.colliderIds,
  }
}
