import type { PointMm } from '../../../domain/project'

export const GRAVITY_MPS2 = 9.81
export const NORMAL_JUMP_MPS = 3.4
export const JUMP_CLEARANCE_MM = 180

export function cameraRelativeRight(forward: PointMm): PointMm {
  const length = Math.hypot(forward.x, forward.y) || 1
  return {
    x: (-forward.y / length) || 0,
    y: (forward.x / length) || 0,
  }
}

export function jumpVelocityForObstacle({ obstacleTopMm, supportHeightMm, marginMm = JUMP_CLEARANCE_MM }: {
  obstacleTopMm: number
  supportHeightMm: number
  marginMm?: number
}): number {
  const riseM = Math.max(0, obstacleTopMm + marginMm - supportHeightMm) / 1000
  return Math.max(NORMAL_JUMP_MPS, Math.sqrt(2 * GRAVITY_MPS2 * riseM))
}

export type VerticalMotionState = {
  footHeightMm: number
  velocityMps: number
  grounded: boolean
}

export function advanceVerticalMotion(
  state: VerticalMotionState,
  deltaSeconds: number,
  supportHeightMm: number,
): VerticalMotionState {
  if (state.grounded && Math.abs(state.footHeightMm - supportHeightMm) <= 1) {
    return { ...state, footHeightMm: supportHeightMm, velocityMps: 0 }
  }
  const fallingFromSupport = state.grounded && supportHeightMm < state.footHeightMm
  const velocityMps = (fallingFromSupport ? 0 : state.velocityMps) - GRAVITY_MPS2 * deltaSeconds
  const footHeightMm = state.footHeightMm + velocityMps * deltaSeconds * 1000
  if (velocityMps <= 0 && state.footHeightMm >= supportHeightMm && footHeightMm <= supportHeightMm) {
    return { footHeightMm: supportHeightMm, velocityMps: 0, grounded: true }
  }
  return { footHeightMm, velocityMps, grounded: false }
}
