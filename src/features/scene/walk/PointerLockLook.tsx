import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const LOOK_SENSITIVITY = .002
const MAX_PITCH = Math.PI / 2 - .015

export function PointerLockLook({ active, onLock, onUnlock, onLook }: {
  active: boolean
  onLock(): void
  onUnlock(): void
  onLook?(headingDeltaRad: number, pitchDeltaRad: number): void
}) {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const locked = useRef(false)

  useEffect(() => {
    if (!active) return
    const documentRef = canvas.ownerDocument
    if (!documentRef) return
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    const handleClick = () => {
      if (documentRef.pointerLockElement === canvas) return
      try {
        const request = canvas.requestPointerLock()
        if (request && typeof request.catch === 'function') request.catch(() => undefined)
      } catch { /* Keyboard walking remains available when pointer lock is unavailable. */ }
    }
    const handleLockChange = () => {
      if (documentRef.pointerLockElement === canvas) {
        locked.current = true
        onLock()
      } else if (locked.current) {
        locked.current = false
        onUnlock()
      }
    }
    const handleMouseMove = (event: MouseEvent) => {
      if (documentRef.pointerLockElement !== canvas) return
      if (onLook) {
        onLook(event.movementX * LOOK_SENSITIVITY, -event.movementY * LOOK_SENSITIVITY)
        return
      }
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= event.movementX * LOOK_SENSITIVITY
      euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x - event.movementY * LOOK_SENSITIVITY))
      camera.quaternion.setFromEuler(euler)
    }
    canvas.addEventListener('click', handleClick)
    documentRef.addEventListener('pointerlockchange', handleLockChange)
    documentRef.addEventListener('mousemove', handleMouseMove)
    return () => {
      canvas.removeEventListener('click', handleClick)
      documentRef.removeEventListener('pointerlockchange', handleLockChange)
      documentRef.removeEventListener('mousemove', handleMouseMove)
      if (documentRef.pointerLockElement === canvas) documentRef.exitPointerLock?.()
      locked.current = false
    }
  }, [active, camera, canvas, onLock, onLook, onUnlock])

  return null
}
