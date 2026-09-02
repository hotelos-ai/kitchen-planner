/* eslint-disable react-refresh/only-export-components */
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { AgentRenderPose } from '../../../core/agents/types'
import type { StaffRole } from '../../../domain/project'
import { KitchenSurfaceMaterial } from '../equipment/parts'
import { ROLE_COLORS } from './role-style'

const SKIN = '#bd8462'
const CHEEK = '#d88e7c'
const HAIR = '#302c28'
const STEEL = '#d7dade'
const UTENSIL = '#26282a'

export function chefVisualDescriptor(role: StaffRole, player: boolean) {
  return {
    parts: [
      'toque-band', 'toque-crown', 'eyes', 'eyebrows', 'smile', 'cheeks', 'ears',
      'nose', 'pupils', 'double-breasted-jacket', 'collar', 'apron', 'neckerchief',
      'cuffed-sleeves', 'trousers', 'non-slip-shoes', 'spatula', 'whisk',
    ],
    expression: 'happy' as const,
    accent: player ? '#b95f47' : ROLE_COLORS[role],
    proportions: { heightM: 1.82, headToHeightRatio: .1, shoulderToHeightRatio: .36 },
    visualRegressionViews: ['front', 'three-quarter'] as const,
    uniform: 'modern-double-breasted' as const,
  }
}

// Facial features are positioned on the head ellipsoid: center (0, 1.52, 0), radii (.175, .196, .175).
// Each z coordinate is the ellipsoid surface at that x/y minus a small embed so parts protrude slightly.
function Face() {
  return <group>
    {[-1, 1].map((side) => <mesh key={`ear-${side}`} position={[side * .162, 1.52, 0]} scale={[.7, 1, .8]}><sphereGeometry args={[.055, 14, 10]} /><meshStandardMaterial color={SKIN} roughness={.76} /></mesh>)}
    {[-1, 1].map((side) => <group key={side}>
      <mesh position={[side * .072, 1.552, .152]} scale={[.82, 1.02, .55]}><sphereGeometry args={[.033, 14, 10]} /><meshStandardMaterial color="#fffdf7" roughness={.55} /></mesh>
      <mesh position={[side * .074, 1.554, .166]} scale={[.7, 1, .45]}><sphereGeometry args={[.0135, 12, 8]} /><meshStandardMaterial color="#252724" roughness={.5} /></mesh>
      <mesh position={[side * .078, 1.614, .133]} rotation={[0, 0, side * -.12]}><boxGeometry args={[.078, .013, .014]} /><meshStandardMaterial color={HAIR} roughness={.82} /></mesh>
      <mesh position={[side * .118, 1.468, .124]} scale={[1, .62, .42]}><sphereGeometry args={[.03, 12, 8]} /><meshStandardMaterial color={CHEEK} transparent opacity={.72} roughness={.8} /></mesh>
    </group>)}
    <mesh position={[0, 1.447, .156]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.054, .01, 8, 24, Math.PI]} /><meshStandardMaterial color="#713d34" roughness={.65} /></mesh>
    <mesh position={[0, 1.502, .172]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.021, .055, 10]} /><meshStandardMaterial color="#a96f51" roughness={.82} /></mesh>
  </group>
}

function Toque() {
  return <group>
    <mesh position={[0, 1.7, 0]} castShadow><cylinderGeometry args={[.195, .18, .11, 24]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
    {[-.1, 0, .1].map((x, index) => <mesh key={x} position={[x, 1.79 + (index === 1 ? .035 : 0), 0]} scale={[1.05, 1.18, .88]} castShadow><sphereGeometry args={[.105, 18, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>)}
    <mesh position={[0, 1.87, 0]} scale={[1.15, .72, 1]} castShadow><sphereGeometry args={[.13, 18, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
  </group>
}

function Spatula() {
  return <group>
    <mesh position={[0, -.015, 0]} castShadow><cylinderGeometry args={[.017, .017, .03, 12]} /><meshStandardMaterial color={STEEL} roughness={.35} metalness={.55} /></mesh>
    <mesh position={[0, -.105, 0]} castShadow><cylinderGeometry args={[.011, .011, .17, 10]} /><meshStandardMaterial color={UTENSIL} roughness={.6} /></mesh>
    <mesh position={[0, -.25, 0]} castShadow><boxGeometry args={[.085, .12, .012]} /><meshStandardMaterial color={STEEL} roughness={.35} metalness={.55} /></mesh>
  </group>
}

function Whisk() {
  return <group>
    <mesh position={[0, -.09, 0]} castShadow><cylinderGeometry args={[.013, .013, .16, 10]} /><meshStandardMaterial color={UTENSIL} roughness={.6} /></mesh>
    {[0, 1, 2].map((wire) => <mesh key={wire} position={[0, -.23, 0]} rotation={[0, wire * Math.PI / 3, 0]} scale={[1, 1.35, 1]} castShadow><torusGeometry args={[.032, .0035, 6, 16]} /><meshStandardMaterial color={STEEL} roughness={.35} metalness={.55} /></mesh>)}
    <mesh position={[0, -.285, 0]}><sphereGeometry args={[.008, 8, 8]} /><meshStandardMaterial color={STEEL} roughness={.35} metalness={.55} /></mesh>
  </group>
}

export function ChefAvatar({ pose, label, reducedMotion = false, player = false }: {
  pose: AgentRenderPose<StaffRole>
  label?: string
  reducedMotion?: boolean
  player?: boolean
}) {
  const torso = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const rightWrist = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const descriptor = chefVisualDescriptor(pose.role, player)

  useFrame(({ clock }) => {
    const moving = pose.moving && !reducedMotion
    const walking = moving ? Math.sin(clock.elapsedTime * 8 + pose.agentId.length) * .48 : 0
    const working = pose.state === 'working' && !reducedMotion ? Math.sin(clock.elapsedTime * 5) * .22 : 0
    if (leftArm.current) leftArm.current.rotation.x = moving ? walking : working
    if (rightArm.current) rightArm.current.rotation.x = moving ? -walking : -working
    if (rightWrist.current) rightWrist.current.rotation.z = reducedMotion ? 0
      : pose.state === 'working' ? Math.sin(clock.elapsedTime * 6) * .55
      : Math.sin(clock.elapsedTime * 2.6) * .38
    if (leftLeg.current) leftLeg.current.rotation.x = walking
    if (rightLeg.current) rightLeg.current.rotation.x = -walking
    if (torso.current) torso.current.position.y = !moving && !reducedMotion
      ? (Math.sin(clock.elapsedTime * 1.7 + pose.agentId.length) + 1) * .004
      : 0
  })

  return <group scale={player ? 1.04 : 1}>
    <group ref={leftLeg} position={[-.105, .61, 0]}>
      <mesh position={[0, -.29, 0]} castShadow><capsuleGeometry args={[.082, .42, 6, 12]} /><meshStandardMaterial color="#252b2a" roughness={.72} /></mesh>
      <mesh position={[0, -.555, .055]} scale={[1, .75, 1.35]} castShadow><capsuleGeometry args={[.09, .09, 5, 10]} /><KitchenSurfaceMaterial material="rubber" /></mesh>
    </group>
    <group ref={rightLeg} position={[.105, .61, 0]}>
      <mesh position={[0, -.29, 0]} castShadow><capsuleGeometry args={[.082, .42, 6, 12]} /><meshStandardMaterial color="#252b2a" roughness={.72} /></mesh>
      <mesh position={[0, -.555, .055]} scale={[1, .75, 1.35]} castShadow><capsuleGeometry args={[.09, .09, 5, 10]} /><KitchenSurfaceMaterial material="rubber" /></mesh>
    </group>

    <group ref={torso}>
      <mesh position={[0, .75, 0]} castShadow><cylinderGeometry args={[.09, .105, .15, 16]} /><meshStandardMaterial color={SKIN} roughness={.78} /></mesh>
      <mesh position={[0, 1.08, 0]} scale={[1, 1.04, .88]} castShadow><capsuleGeometry args={[.265, .48, 8, 14]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
      <mesh position={[0, 1.05, .238]} castShadow><boxGeometry args={[.39, .48, .024]} /><meshStandardMaterial color="#f4f1e9" roughness={.72} /></mesh>
      <mesh position={[0, .965, .256]} castShadow><boxGeometry args={[.31, .42, .018]} /><meshStandardMaterial color="#e7e2d8" roughness={.76} /></mesh>
      <mesh position={[0, 1.18, .255]}><boxGeometry args={[.035, .28, .018]} /><meshStandardMaterial color={descriptor.accent} roughness={.58} /></mesh>
      <mesh position={[-.08, 1.285, .245]} rotation={[0, 0, -.55]}><boxGeometry args={[.14, .045, .025]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
      <mesh position={[.08, 1.285, .245]} rotation={[0, 0, .55]}><boxGeometry args={[.14, .045, .025]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
      {[-.105, .105].flatMap((x) => [.94, 1.07, 1.2].map((y) => <mesh key={`${x}-${y}`} position={[x, y, .274]}><sphereGeometry args={[.017, 10, 8]} /><KitchenSurfaceMaterial material="blackEnamel" /></mesh>))}
      <mesh position={[0, 1.34, .17]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.115, .16, 3]} /><meshStandardMaterial color={descriptor.accent} roughness={.65} /></mesh>

      <group ref={leftArm} position={[-.32, 1.22, 0]} rotation={[0, 0, -.12]}>
        <mesh position={[0, -.25, 0]} castShadow><capsuleGeometry args={[.07, .36, 6, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
        <mesh position={[0, -.43, 0]} castShadow><cylinderGeometry args={[.079, .074, .09, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
        <mesh position={[0, -.49, 0]} scale={[.88, 1.05, .82]} castShadow><sphereGeometry args={[.085, 14, 10]} /><meshStandardMaterial color={SKIN} roughness={.78} /></mesh>
        <group position={[0, -.49, .012]} rotation={[.55, 0, 0]}><Whisk /></group>
      </group>
      <group ref={rightArm} position={[.32, 1.22, 0]} rotation={[0, 0, .12]}>
        <mesh position={[0, -.25, 0]} castShadow><capsuleGeometry args={[.07, .36, 6, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
        <mesh position={[0, -.43, 0]} castShadow><cylinderGeometry args={[.079, .074, .09, 12]} /><KitchenSurfaceMaterial material="whiteUniform" /></mesh>
        <mesh position={[0, -.49, 0]} scale={[.88, 1.05, .82]} castShadow><sphereGeometry args={[.085, 14, 10]} /><meshStandardMaterial color={SKIN} roughness={.78} /></mesh>
        <group ref={rightWrist} position={[0, -.49, .012]} rotation={[.55, 0, 0]}><Spatula /></group>
      </group>

      <mesh position={[0, 1.35, 0]} castShadow><cylinderGeometry args={[.09, .085, .13, 16]} /><meshStandardMaterial color={SKIN} roughness={.78} /></mesh>
      <mesh position={[0, 1.52, 0]} scale={[.96, 1.03, .92]} castShadow><sphereGeometry args={[.19, 20, 14]} /><meshStandardMaterial color={SKIN} roughness={.8} /></mesh>
      <Face />
      <Toque />
    </group>

    {label && <Html position={[0, 2.08, 0]} center distanceFactor={7} className="chef-label"><span>{label}</span><small>{pose.state}</small></Html>}
  </group>
}
ChefAvatar.displayName = 'ChefAvatar'
