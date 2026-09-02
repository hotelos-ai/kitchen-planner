import type { PointMm } from '../../../domain/project'

export type WalkPlayerPosition = PointMm & {
  elevationMm: number
  grounded: boolean
  verticalVelocityMps: number
}

export type WalkViewMode = 'first-person' | 'third-person'
export type WalkLocomotionState = 'idle' | 'walking' | 'running' | 'jumping' | 'falling' | 'landing'

/** Persistent player state. Cameras are projections of this pose, never its owner. */
export type WalkPlayerPose = WalkPlayerPosition & {
  headingRad: number
  pitchRad: number
  velocityMmPerSecond: PointMm
  locomotion: WalkLocomotionState
  nearbyInteractionIds: string[]
}
