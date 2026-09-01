/* eslint-disable react-refresh/only-export-components */
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { AgentRenderPose } from '../../../core/agents/types'
import type { StaffRole } from '../../../domain/project'
import { ROLE_COLORS } from './role-style'

export function chefVisualDescriptor(role: StaffRole, player: boolean) {
  return {
    parts: ['toque', 'double-breasted-jacket', 'neckerchief', 'trousers', 'kitchen-shoes'],
    accent: player ? '#b95f47' : ROLE_COLORS[role],
  }
}

export function ChefAvatar({ pose, label, reducedMotion = false, player = false }: { pose: AgentRenderPose<StaffRole>; label?: string; reducedMotion?: boolean; player?: boolean }) {
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const accent = chefVisualDescriptor(pose.role, player).accent

  useFrame(({ clock }) => {
    const moving = pose.moving && !reducedMotion
    const walking = moving ? Math.sin(clock.elapsedTime * 8 + pose.agentId.length) * .48 : 0
    const working = pose.state === 'working' && !reducedMotion ? Math.sin(clock.elapsedTime * 5) * .22 : 0
    if (leftArm.current) leftArm.current.rotation.x = moving ? walking : working
    if (rightArm.current) rightArm.current.rotation.x = moving ? -walking : -working
    if (leftLeg.current) leftLeg.current.rotation.x = walking
    if (rightLeg.current) rightLeg.current.rotation.x = -walking
  })

  return <group scale={player ? 1.02 : 1}>
    <group ref={leftLeg} position={[-.105, .61, 0]}><mesh position={[0, -.29, 0]}><capsuleGeometry args={[.085, .42, 5, 10]} /><meshStandardMaterial color="#252b2a" roughness={.72} /></mesh><mesh position={[0, -.56, .04]}><boxGeometry args={[.18, .1, .31]} /><meshStandardMaterial color="#171b1a" roughness={.8} /></mesh></group>
    <group ref={rightLeg} position={[.105, .61, 0]}><mesh position={[0, -.29, 0]}><capsuleGeometry args={[.085, .42, 5, 10]} /><meshStandardMaterial color="#252b2a" roughness={.72} /></mesh><mesh position={[0, -.56, .04]}><boxGeometry args={[.18, .1, .31]} /><meshStandardMaterial color="#171b1a" roughness={.8} /></mesh></group>
    <mesh position={[0, 1.05, 0]} castShadow><capsuleGeometry args={[.27, .5, 7, 12]} /><meshStandardMaterial color={player ? '#fff9ef' : '#f2f2ec'} roughness={.62} /></mesh>
    <mesh position={[0, 1.04, .274]}><boxGeometry args={[.05, .5, .018]} /><meshStandardMaterial color={accent} /></mesh>
    {[-.11, .11].flatMap((x) => [.92, 1.06, 1.2].map((y) => <mesh key={`${x}-${y}`} position={[x, y, .292]}><sphereGeometry args={[.018, 8, 8]} /><meshStandardMaterial color="#333b38" /></mesh>))}
    <group ref={leftArm} position={[-.32, 1.22, 0]} rotation={[0, 0, -.12]}><mesh position={[0, -.25, 0]}><capsuleGeometry args={[.07, .36, 5, 10]} /><meshStandardMaterial color="#f0f0ea" roughness={.64} /></mesh><mesh position={[0, -.49, 0]}><sphereGeometry args={[.085, 12, 10]} /><meshStandardMaterial color="#bc8766" roughness={.78} /></mesh></group>
    <group ref={rightArm} position={[.32, 1.22, 0]} rotation={[0, 0, .12]}><mesh position={[0, -.25, 0]}><capsuleGeometry args={[.07, .36, 5, 10]} /><meshStandardMaterial color="#f0f0ea" roughness={.64} /></mesh><mesh position={[0, -.49, 0]}><sphereGeometry args={[.085, 12, 10]} /><meshStandardMaterial color="#bc8766" roughness={.78} /></mesh></group>
    <mesh position={[0, 1.47, 0]}><sphereGeometry args={[.18, 16, 12]} /><meshStandardMaterial color="#b9805f" roughness={.8} /></mesh>
    <mesh position={[0, 1.34, .17]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.115, .16, 3]} /><meshStandardMaterial color={accent} roughness={.65} /></mesh>
    <mesh position={[0, 1.64, 0]}><cylinderGeometry args={[.2, .17, .13, 16]} /><meshStandardMaterial color="#fffdf6" roughness={.72} /></mesh>
    <mesh position={[0, 1.76, 0]}><cylinderGeometry args={[.16, .19, .16, 10]} /><meshStandardMaterial color="#fffdf6" roughness={.72} /></mesh>
    <mesh position={[0, 1.86, 0]}><cylinderGeometry args={[.12, .155, .08, 10]} /><meshStandardMaterial color="#fffdf6" roughness={.72} /></mesh>
    {label && <Html position={[0, 2.02, 0]} center distanceFactor={7} className="chef-label"><span>{label}</span><small>{pose.state}</small></Html>}
  </group>
}
ChefAvatar.displayName = 'ChefAvatar'
