import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Architecture, EquipmentItem } from '../../../domain/project'
import { buildWalkColliders, type WalkSpawn } from './walk-collision'
import { EMPTY_WALK_INPUT, walkActionForKeyboardEvent, walkInputReducer, type WalkInputState } from './walk-input'
import { advanceWalkPlayerMotion, createWalkPlayerPose } from './player-motion'
import { DEFAULT_CHASE_BOOM_MM, cameraTransformForPose, updateObstacleAwareChaseCamera } from './walk-camera'
import { PointerLockLook } from './PointerLockLook'
import type { WalkLocomotionState, WalkPlayerPose, WalkPlayerPosition, WalkViewMode } from './types'

const MAX_PITCH_RAD = Math.PI / 2 - .015

export function FirstPersonController({ active, view = 'first-person', architecture, equipment, spawn, staff = [], onLockedChange, onNearbyChange, onPositionChange, onPoseChange }: {
  active: boolean
  view?: WalkViewMode
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  spawn: WalkSpawn
  staff?: readonly { agentId: string; xMm: number; yMm: number }[]
  onLockedChange?(locked: boolean): void
  onNearbyChange?(nearby: boolean): void
  onPositionChange?(position: WalkPlayerPosition): void
  onPoseChange?(pose: WalkPlayerPose): void
}) {
  const colliders = useMemo(() => buildWalkColliders(architecture, equipment), [architecture, equipment])
  const input = useRef<WalkInputState>({ ...EMPTY_WALK_INPUT })
  const pose = useRef<WalkPlayerPose>(createWalkPlayerPose(spawn))
  const chaseBoomMm = useRef(DEFAULT_CHASE_BOOM_MM)
  const jumpConsumed = useRef(false)
  const wasActive = useRef(false)
  const lastPositionNotice = useRef(0)
  const lastPublishedLocomotion = useRef<WalkLocomotionState>('idle')
  const lastNearby = useRef(false)
  const handleLock = useCallback(() => onLockedChange?.(true), [onLockedChange])
  const handleUnlock = useCallback(() => { input.current = { ...EMPTY_WALK_INPUT }; onLockedChange?.(false) }, [onLockedChange])
  const handleLook = useCallback((headingDeltaRad: number, pitchDeltaRad: number) => {
    pose.current = {
      ...pose.current,
      headingRad: pose.current.headingRad + headingDeltaRad,
      pitchRad: Math.max(-MAX_PITCH_RAD, Math.min(MAX_PITCH_RAD, pose.current.pitchRad + pitchDeltaRad)),
    }
  }, [])

  useEffect(() => {
    if (active && !wasActive.current) {
      pose.current = createWalkPlayerPose(spawn)
      chaseBoomMm.current = DEFAULT_CHASE_BOOM_MM
      lastPublishedLocomotion.current = pose.current.locomotion
      onPoseChange?.(pose.current)
      onPositionChange?.(pose.current)
    }
    wasActive.current = active
  }, [active, onPoseChange, onPositionChange, spawn])

  useEffect(() => {
    if (!active) return
    const handle = (pressed: boolean) => (event: KeyboardEvent) => {
      const action = walkActionForKeyboardEvent(event, pressed)
      if (!action) return
      if (action.control !== 'release') event.preventDefault()
      input.current = walkInputReducer(input.current, action)
      if (action.control === 'jump' && !pressed) jumpConsumed.current = false
      if (action.control === 'release') document.exitPointerLock?.()
    }
    const down = handle(true)
    const up = handle(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      input.current = { ...EMPTY_WALK_INPUT }
    }
  }, [active])

  useFrame((state, delta) => {
    if (!active) return
    const frameDelta = Math.min(delta, .05)
    const jumpRequested = input.current.jump && pose.current.grounded && !jumpConsumed.current
    const result = advanceWalkPlayerMotion({
      pose: pose.current,
      input: input.current,
      deltaSeconds: frameDelta,
      colliders,
      staff,
      jumpRequested,
    })
    pose.current = result.pose
    if (jumpRequested) jumpConsumed.current = true

    const cameraTransform = view === 'third-person'
      ? (() => {
        const chase = updateObstacleAwareChaseCamera({
          pose: pose.current,
          colliders,
          previousBoomMm: chaseBoomMm.current,
          deltaSeconds: frameDelta,
        })
        chaseBoomMm.current = chase.boomMm
        return chase
      })()
      : cameraTransformForPose(pose.current, 'first-person')
    state.camera.position.set(
      cameraTransform.position.xMm / 1000,
      cameraTransform.position.heightMm / 1000,
      cameraTransform.position.yMm / 1000,
    )
    state.camera.lookAt(
      cameraTransform.target.xMm / 1000,
      cameraTransform.target.heightMm / 1000,
      cameraTransform.target.yMm / 1000,
    )

    const nearby = pose.current.nearbyInteractionIds.length > 0
    if (nearby !== lastNearby.current) {
      lastNearby.current = nearby
      onNearbyChange?.(nearby)
    }
    const now = performance.now()
    const holdLandingPose = lastPublishedLocomotion.current === 'landing'
      && pose.current.locomotion === 'idle'
      && now - lastPositionNotice.current <= 100
    const locomotionChanged = pose.current.locomotion !== lastPublishedLocomotion.current && !holdLandingPose
    if (locomotionChanged || now - lastPositionNotice.current > 100) {
      lastPositionNotice.current = now
      lastPublishedLocomotion.current = pose.current.locomotion
      onPoseChange?.(pose.current)
      onPositionChange?.(pose.current)
    }
  })

  if (!active) return null
  return <PointerLockLook active onLock={handleLock} onUnlock={handleUnlock} onLook={handleLook} />
}
