import type { PointMm } from '../../../domain/project'

export type WalkPlayerPosition = PointMm & {
  elevationMm: number
  grounded: boolean
  verticalVelocityMps: number
}
