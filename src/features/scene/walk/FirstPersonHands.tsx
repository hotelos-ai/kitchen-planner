import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'
import type { WalkPlayerPose } from './types'
import { firstPersonViewModel, type FirstPersonPartTransform, type FirstPersonViewModel } from './first-person-view-model'
import { SpatulaModel } from './SpatulaModel'
import { WhiskModel } from './WhiskModel'
import { walkActionForKeyboardEvent, walkActionForPrimaryPointerEvent } from './walk-input'

type HandsPose = Pick<WalkPlayerPose, 'locomotion' | 'grounded' | 'verticalVelocityMps'>

const applyTransform = (group: Group | null, transform: FirstPersonPartTransform) => {
  if (!group?.position?.set || !group.rotation?.set) return
  group.position.set(...transform.position)
  group.rotation.set(...transform.rotation)
}

function HandModel() {
  return <group>
    <mesh position={[0, 0, 0]} castShadow>
      <sphereGeometry args={[.062, 14, 10]} />
      <meshStandardMaterial color="#bd8767" roughness={.78} depthTest={false} />
    </mesh>
    <mesh position={[0, -.12, 0]} castShadow>
      <cylinderGeometry args={[.06, .056, .05, 12]} />
      <meshStandardMaterial color="#b95f47" roughness={.56} depthTest={false} />
    </mesh>
    <mesh position={[0, -.33, 0]} castShadow>
      <capsuleGeometry args={[.054, .18, 5, 10]} />
      <meshStandardMaterial color="#f8f4eb" roughness={.64} depthTest={false} />
    </mesh>
  </group>
}

// Upright weapon mount: the internal PI/2 of each tool model points the head forward,
// the wrapper's PI/2 pitches it up so the tool reads like a first-person weapon.
const weaponMount = (cant: number, scale: number, inset: number): { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } => ({
  position: [inset, .02, -.05],
  rotation: [Math.PI / 2 + .12, 0, cant],
  scale: [scale, scale, scale],
})

export function FirstPersonHands({ pose, reducedMotion = false, onViewModelChange }: {
  pose?: HandsPose
  reducedMotion?: boolean
  onViewModelChange?(model: FirstPersonViewModel): void
}) {
  const anchor = useRef<Group>(null)
  const root = useRef<Group>(null)
  const supportHand = useRef<Group>(null)
  const dominantHand = useRef<Group>(null)
  const swingStartedAtSeconds = useRef<number | null>(null)
  const locomotionStartedAtSeconds = useRef(0)
  const lastLocomotion = useRef(pose?.locomotion ?? 'idle')
  const pointerLocked = useRef(false)
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    const startSwing = () => { swingStartedAtSeconds.current = performance.now() / 1_000 }
    const handlePointerLock = () => { pointerLocked.current = document.pointerLockElement === canvas }
    const handleClick = (event: MouseEvent) => {
      if (walkActionForPrimaryPointerEvent(event, pointerLocked.current)?.control === 'swing') startSwing()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (walkActionForKeyboardEvent(event, true)?.control === 'swing') startSwing()
    }
    handlePointerLock()
    canvas.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLock)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      canvas.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLock)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canvas])

  useFrame(() => {
    const nowSeconds = performance.now() / 1_000
    const locomotion = pose?.locomotion ?? 'idle'
    if (lastLocomotion.current !== locomotion) {
      lastLocomotion.current = locomotion
      locomotionStartedAtSeconds.current = nowSeconds
    }
    const model = firstPersonViewModel({
      elapsedSeconds: nowSeconds,
      locomotionElapsedSeconds: Math.max(0, nowSeconds - locomotionStartedAtSeconds.current),
      locomotion,
      reducedMotion,
      swingStartedAtSeconds: swingStartedAtSeconds.current,
    })
    onViewModelChange?.(model)
    if (anchor.current?.position?.copy && anchor.current.quaternion?.copy) {
      anchor.current.position.copy(camera.position)
      anchor.current.quaternion.copy(camera.quaternion)
    }
    applyTransform(root.current, model.root)
    applyTransform(supportHand.current, model.supportHand)
    applyTransform(dominantHand.current, model.dominantHand)
    if (!model.swing.active && model.swing.progress === 1) swingStartedAtSeconds.current = null
  })

  return <group ref={anchor} renderOrder={20}>
    <group ref={root}>
      <group ref={supportHand}>
        <HandModel />
        <group {...weaponMount(.15, .68, .05)}><WhiskModel /></group>
      </group>
      <group ref={dominantHand}>
        <HandModel />
        <group {...weaponMount(-.15, .6, -.05)}><SpatulaModel /></group>
      </group>
    </group>
  </group>
}

FirstPersonHands.displayName = 'FirstPersonHands'
