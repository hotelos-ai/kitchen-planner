import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Architecture, EquipmentItem, PointMm } from '../../../domain/project'
import { softenPlayerStep } from './staff-proximity'
import { buildWalkColliders, findD2Spawn, resolveWalkStep } from './walk-collision'
import { EMPTY_WALK_INPUT, walkActionForKeyboardEvent, walkInputReducer, type WalkInputState } from './walk-input'

const EYE_HEIGHT_M = 1.68
const WALK_MPS = 1.45
const BOOST_MPS = 2.35
const JUMP_MPS = 3.4

export function FirstPersonController({ active, architecture, equipment, staff = [], onLockedChange, onNearbyChange, onPositionChange }: {
  active: boolean
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  staff?: readonly { agentId: string; xMm: number; yMm: number }[]
  onLockedChange?(locked: boolean): void
  onNearbyChange?(nearby: boolean): void
  onPositionChange?(position: PointMm): void
}) {
  const getThree = useThree((state) => state.get)
  const colliders = useMemo(() => buildWalkColliders(architecture, equipment), [architecture, equipment])
  const input = useRef<WalkInputState>({ ...EMPTY_WALK_INPUT })
  const velocityY = useRef(0)
  const grounded = useRef(true)
  const jumpConsumed = useRef(false)
  const wasActive = useRef(false)
  const lastPositionNotice = useRef(0)
  const lastNearby = useRef(false)

  useEffect(() => {
    if (active && !wasActive.current) {
      const spawn = findD2Spawn(architecture, colliders)
      const camera = getThree().camera
      camera.position.set(spawn.xMm / 1000, EYE_HEIGHT_M, spawn.yMm / 1000)
      camera.rotation.set(0, Math.PI / 2 - spawn.headingRad, 0, 'YXZ')
      velocityY.current = 0
      grounded.current = true
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
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize().negate()
    const desired = new THREE.Vector3()
    if (input.current.forward) desired.add(forward)
    if (input.current.backward) desired.sub(forward)
    if (input.current.right) desired.add(right)
    if (input.current.left) desired.sub(right)
    const speed = input.current.boost ? BOOST_MPS : WALK_MPS
    if (desired.lengthSq()) desired.normalize().multiplyScalar(speed * Math.min(delta, .05) * 1000)
    const currentMm = { x: camera.position.x * 1000, y: camera.position.z * 1000 }
    const softened = softenPlayerStep(currentMm, { x: desired.x, y: desired.z }, staff)
    const resolved = resolveWalkStep({ positionMm: currentMm, radiusMm: 260 }, softened.delta, colliders)
    camera.position.x = resolved.positionMm.x / 1000
    camera.position.z = resolved.positionMm.y / 1000

    if (input.current.jump && grounded.current && !jumpConsumed.current) {
      velocityY.current = JUMP_MPS
      grounded.current = false
      jumpConsumed.current = true
    }
    velocityY.current += -9.81 * Math.min(delta, .05)
    camera.position.y += velocityY.current * Math.min(delta, .05)
    if (camera.position.y <= EYE_HEIGHT_M) { camera.position.y = EYE_HEIGHT_M; velocityY.current = 0; grounded.current = true }

    const nearby = softened.overlappingAgentIds.length > 0
    if (nearby !== lastNearby.current) { lastNearby.current = nearby; onNearbyChange?.(nearby) }
    const now = performance.now()
    if (now - lastPositionNotice.current > 100) { lastPositionNotice.current = now; onPositionChange?.(resolved.positionMm) }
  })

  if (!active) return null
  return <PointerLockControls onLock={() => onLockedChange?.(true)} onUnlock={() => { input.current = { ...EMPTY_WALK_INPUT }; onLockedChange?.(false) }} />
}
