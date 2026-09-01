import { Edges } from '@react-three/drei'
import type { ReactNode } from 'react'

export const STEEL = '#d5dcda'
export const DARK_STEEL = '#687470'
export const BLACK = '#252b29'

export function BoxPart({ position, size, color = STEEL, metalness = .24, roughness = .4, children }: { position: [number, number, number]; size: [number, number, number]; color?: string; metalness?: number; roughness?: number; children?: ReactNode }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} /><Edges color="#394440" threshold={20} />{children}</mesh>
}

export function TubularLeg({ x, z, height, radius = .025 }: { x: number; z: number; height: number; radius?: number }) {
  return <mesh position={[x, height / 2, z]} castShadow><cylinderGeometry args={[radius, radius, height, 10]} /><meshStandardMaterial color={DARK_STEEL} metalness={.28} roughness={.4} /></mesh>
}

export function Handle({ x, y, z, vertical = true, length = .34 }: { x: number; y: number; z: number; vertical?: boolean; length?: number }) {
  return <group position={[x, y, z]}><mesh rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}><cylinderGeometry args={[.014, .014, length, 10]} /><meshStandardMaterial color="#303936" metalness={.3} roughness={.42} /></mesh></group>
}

export function Knob({ x, y, z }: { x: number; y: number; z: number }) {
  return <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.027, .027, .025, 12]} /><meshStandardMaterial color={BLACK} roughness={.45} /></mesh>
}

export function Foot({ x, z }: { x: number; z: number }) {
  return <mesh position={[x, .025, z]}><cylinderGeometry args={[.035, .04, .05, 12]} /><meshStandardMaterial color={BLACK} roughness={.6} /></mesh>
}
