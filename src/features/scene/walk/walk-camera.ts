import { pointInPolygon } from '../../../domain/geometry'
import type { PointMm } from '../../../domain/project'
import type { WalkCollider } from './walk-collision'
import type { WalkPlayerPose, WalkViewMode } from './types'

export const WALK_EYE_HEIGHT_MM = 1680
export const DEFAULT_CHASE_BOOM_MM = 2800
export const CHASE_SHOULDER_OFFSET_MM = 360
const CHASE_CAMERA_LIFT_MM = 340
const CHASE_TARGET_HEIGHT_MM = 1450
const CHASE_TARGET_FORWARD_MM = 260
const CHASE_OBSTRUCTION_PADDING_MM = 240
const CHASE_EASE_BACK_MM_PER_SECOND = 2500

export type WalkCameraPoint = { xMm: number; heightMm: number; yMm: number }
export type WalkCameraTransform = { position: WalkCameraPoint; target: WalkCameraPoint }

const forwardFor = (headingRad: number) => ({ x: Math.cos(headingRad), y: Math.sin(headingRad) })
export const avatarYawForHeading = (headingRad: number) => Math.PI / 2 - headingRad

export function cameraTransformForPose(pose: WalkPlayerPose, view: WalkViewMode, boomMm = DEFAULT_CHASE_BOOM_MM): WalkCameraTransform {
  const forward = forwardFor(pose.headingRad)
  const eyeHeight = pose.elevationMm + WALK_EYE_HEIGHT_MM
  if (view === 'first-person') {
    const horizontal = Math.cos(pose.pitchRad) * 1000
    return {
      position: { xMm: pose.x, heightMm: eyeHeight, yMm: pose.y },
      target: {
        xMm: pose.x + forward.x * horizontal,
        heightMm: eyeHeight + Math.sin(pose.pitchRad) * 1000,
        yMm: pose.y + forward.y * horizontal,
      },
    }
  }

  const right = { x: -forward.y, y: forward.x }
  const pitchOffsetMm = Math.sin(pose.pitchRad) * 900
  return {
    position: {
      xMm: pose.x - forward.x * boomMm + right.x * CHASE_SHOULDER_OFFSET_MM,
      heightMm: eyeHeight + CHASE_CAMERA_LIFT_MM,
      yMm: pose.y - forward.y * boomMm + right.y * CHASE_SHOULDER_OFFSET_MM,
    },
    target: {
      xMm: pose.x + forward.x * CHASE_TARGET_FORWARD_MM,
      heightMm: pose.elevationMm + CHASE_TARGET_HEIGHT_MM + pitchOffsetMm,
      yMm: pose.y + forward.y * CHASE_TARGET_FORWARD_MM,
    },
  }
}

const cross = (a: PointMm, b: PointMm) => a.x * b.y - a.y * b.x

const segmentIntersectionAmount = (start: PointMm, end: PointMm, a: PointMm, b: PointMm): number | undefined => {
  const ray = { x: end.x - start.x, y: end.y - start.y }
  const edge = { x: b.x - a.x, y: b.y - a.y }
  const denominator = cross(ray, edge)
  if (Math.abs(denominator) < .0001) return undefined
  const offset = { x: a.x - start.x, y: a.y - start.y }
  const amount = cross(offset, edge) / denominator
  const edgeAmount = cross(offset, ray) / denominator
  return amount >= 0 && amount <= 1 && edgeAmount >= 0 && edgeAmount <= 1 ? amount : undefined
}

const firstPolygonIntersection = (start: PointMm, end: PointMm, polygon: readonly PointMm[]) => {
  if (pointInPolygon(start, [...polygon])) return 0
  const amounts = polygon.flatMap((point, index) => {
    const amount = segmentIntersectionAmount(start, end, point, polygon[(index + 1) % polygon.length])
    return amount === undefined ? [] : [amount]
  })
  return amounts.length ? Math.min(...amounts) : undefined
}

export function updateObstacleAwareChaseCamera({
  pose,
  colliders,
  desiredBoomMm = DEFAULT_CHASE_BOOM_MM,
  previousBoomMm,
  deltaSeconds,
}: {
  pose: WalkPlayerPose
  colliders: readonly WalkCollider[]
  desiredBoomMm?: number
  previousBoomMm: number
  deltaSeconds: number
}): WalkCameraTransform & { boomMm: number } {
  const desired = cameraTransformForPose(pose, 'third-person', desiredBoomMm)
  const start = { x: desired.target.xMm, y: desired.target.yMm }
  const end = { x: desired.position.xMm, y: desired.position.yMm }
  let obstructionBoom = desiredBoomMm

  colliders.forEach((collider) => {
    const amount = firstPolygonIntersection(start, end, collider.polygon)
    if (amount === undefined) return
    const sightlineHeight = desired.target.heightMm + (desired.position.heightMm - desired.target.heightMm) * amount
    if (collider.topMm < sightlineHeight - 100) return
    obstructionBoom = Math.min(obstructionBoom, Math.max(420, desiredBoomMm * amount - CHASE_OBSTRUCTION_PADDING_MM))
  })

  const boomMm = obstructionBoom < previousBoomMm
    ? obstructionBoom
    : Math.min(obstructionBoom, previousBoomMm + CHASE_EASE_BACK_MM_PER_SECOND * Math.max(0, deltaSeconds))
  return { ...cameraTransformForPose(pose, 'third-person', boomMm), boomMm }
}
