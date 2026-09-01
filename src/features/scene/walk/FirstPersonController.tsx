import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Architecture, EquipmentItem } from '../../../domain/project'
import { softenPlayerStep } from './staff-proximity'
import { buildWalkColliders, cameraYawForHeading, findD2Spawn, findJumpObstacle, resolveWalkStep, supportHeightAt } from './walk-collision'
import { EMPTY_WALK_INPUT, walkActionForKeyboardEvent, walkInputReducer, type WalkInputState } from './walk-input'
import { advanceVerticalMotion, cameraRelativeRight, jumpVelocityForObstacle, type VerticalMotionState } from './walk-motion'
import { PointerLockLook } from './PointerLockLook'
import type { WalkPlayerPosition } from './types'

const EYE_HEIGHT_M = 1.68
const WALK_MPS = 1.45
const BOOST_MPS = 2.35
const PLAYER_RADIUS_MM = 260

export function FirstPersonController({ active, architecture, equipment, staff = [], onLockedChange, onNearbyChange, onPositionChange }: {
  active: boolean
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  staff?: readonly { agentId: string; xMm: number; yMm: number }[]
  onLockedChange?(locked: boolean): void
  onNearbyChange?(nearby: boolean): void
  onPositionChange?(position: WalkPlayerPosition): void
}) {
  const getThree = useThree((state) => state.get)
  const colliders = useMemo(() => buildWalkColliders(architecture, equipment), [architecture, equipment])
  const input = useRef<WalkInputState>({ ...EMPTY_WALK_INPUT })
  const vertical = useRef<VerticalMotionState>({ footHeightMm: 0, velocityMps: 0, grounded: true })
  const jumpConsumed = useRef(false)
  const wasActive = useRef(false)
  const lastPositionNotice = useRef(0)
  const lastNearby = useRef(false)
  const handleLock = useCallback(() => onLockedChange?.(true), [onLockedChange])
  const handleUnlock = useCallback(() => { input.current = { ...EMPTY_WALK_INPUT }; onLockedChange?.(false) }, [onLockedChange])

  useEffect(() => {
    if (active && !wasActive.current) {
      const spawn = findD2Spawn(architecture, colliders)
      const camera = getThree().camera
      camera.position.set(spawn.xMm / 1000, EYE_HEIGHT_M, spawn.yMm / 1000)
      camera.rotation.set(0, cameraYawForHeading(spawn.headingRad), 0, 'YXZ')
      vertical.current = { footHeightMm: 0, velocityMps: 0, grounded: true }
    }
    wasActive.current = active
  }, [active, architecture, colliders, getThree])

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
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); input.current = { ...EMPTY_WALK_INPUT } }
  }, [active])

  useFrame((state, delta) => {
    if (!active) return
    const camera = state.camera
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right2d = cameraRelativeRight({ x: forward.x, y: forward.z })
    const right = new THREE.Vector3(right2d.x, 0, right2d.y)
    const desired = new THREE.Vector3()
    if (input.current.forward) desired.add(forward)
    if (input.current.backward) desired.sub(forward)
    if (input.current.right) desired.add(right)
    if (input.current.left) desired.sub(right)
    const frameDelta = Math.min(delta, .05)
    const jumpDirection = desired.lengthSq()
      ? { x: desired.x, y: desired.z }
      : { x: forward.x, y: forward.z }
    const speed = input.current.boost ? BOOST_MPS : WALK_MPS
    if (desired.lengthSq()) desired.normalize().multiplyScalar(speed * frameDelta * 1000)
    const currentMm = { x: camera.position.x * 1000, y: camera.position.z * 1000 }
    const softened = softenPlayerStep(currentMm, { x: desired.x, y: desired.z }, staff)
    const body = { positionMm: currentMm, radiusMm: PLAYER_RADIUS_MM }
    const resolved = resolveWalkStep(body, softened.delta, colliders, vertical.current.footHeightMm)
    camera.position.x = resolved.positionMm.x / 1000
    camera.position.z = resolved.positionMm.y / 1000

    const supportHeightMm = supportHeightAt(resolved.positionMm, colliders)
    if (input.current.jump && vertical.current.grounded && !jumpConsumed.current) {
      const obstacle = findJumpObstacle(body, jumpDirection, colliders)
      vertical.current = {
        ...vertical.current,
        velocityMps: jumpVelocityForObstacle({
          obstacleTopMm: obstacle?.topMm ?? supportHeightMm,
          supportHeightMm: vertical.current.footHeightMm,
        }),
        grounded: false,
      }
      jumpConsumed.current = true
    }
    vertical.current = advanceVerticalMotion(vertical.current, frameDelta, supportHeightMm)
    camera.position.y = EYE_HEIGHT_M + vertical.current.footHeightMm / 1000

    const nearby = softened.overlappingAgentIds.length > 0
    if (nearby !== lastNearby.current) { lastNearby.current = nearby; onNearbyChange?.(nearby) }
    const now = performance.now()
    if (now - lastPositionNotice.current > 100) {
      lastPositionNotice.current = now
      onPositionChange?.({
        ...resolved.positionMm,
        elevationMm: vertical.current.footHeightMm,
        grounded: vertical.current.grounded,
        verticalVelocityMps: vertical.current.velocityMps,
      })
    }
  })

  if (!active) return null
  return <PointerLockLook active onLock={handleLock} onUnlock={handleUnlock} />
}
