import { RoundedBox } from '@react-three/drei'
import { createContext, useContext, type ReactNode } from 'react'
import { KITCHEN_MATERIALS, resolveAppearanceSkinMaterial, resolveKitchenMaterial, type KitchenMaterialDescriptor, type KitchenMaterialName } from './materials'

export const STEEL = KITCHEN_MATERIALS.brushedSteel.color
export const DARK_STEEL = KITCHEN_MATERIALS.darkSteel.color
export const BLACK = KITCHEN_MATERIALS.blackEnamel.color

const AppearanceSkinContext = createContext<Partial<KitchenMaterialDescriptor>>({})

export function AppearanceSkinProvider({ skinId, children }: { skinId?: string; children: ReactNode }) {
  return <AppearanceSkinContext.Provider value={resolveAppearanceSkinMaterial(skinId)}>{children}</AppearanceSkinContext.Provider>
}

export function KitchenSurfaceMaterial({ material = 'brushedSteel', ...overrides }: {
  material?: KitchenMaterialName
} & Partial<KitchenMaterialDescriptor>) {
  const skinOverrides = useContext(AppearanceSkinContext)
  const descriptor = resolveKitchenMaterial(material, material === 'brushedSteel' ? skinOverrides : {})
  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== undefined) Object.assign(descriptor, { [key]: value })
  })
  return <meshPhysicalMaterial {...descriptor} />
}

export function BoxPart({ position, size, material = 'brushedSteel', color, metalness, roughness, radius, children }: {
  position: [number, number, number]
  size: [number, number, number]
  material?: KitchenMaterialName
  color?: string
  metalness?: number
  roughness?: number
  radius?: number
  children?: ReactNode
}) {
  const smallestDimension = Math.min(...size)
  const bevelRadius = Math.max(.002, Math.min(radius ?? .026, smallestDimension / 4))
  return (
    <RoundedBox args={size} radius={bevelRadius} smoothness={4} position={position} castShadow receiveShadow>
      <KitchenSurfaceMaterial material={material} color={color} metalness={metalness} roughness={roughness} />
      {children}
    </RoundedBox>
  )
}

export function TubularLeg({ x, z, height, radius = .025 }: { x: number; z: number; height: number; radius?: number }) {
  return <mesh position={[x, height / 2, z]} castShadow><cylinderGeometry args={[radius, radius, height, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
}

export function Handle({ x, y, z, vertical = true, length = .34 }: { x: number; y: number; z: number; vertical?: boolean; length?: number }) {
  return <group position={[x, y, z]}><mesh rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.014, .014, length, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh></group>
}

export function Knob({ x, y, z }: { x: number; y: number; z: number }) {
  return <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.027, .027, .025, 16]} /><KitchenSurfaceMaterial material="blackEnamel" /></mesh>
}

export function Foot({ x, z }: { x: number; z: number }) {
  return <mesh position={[x, .025, z]} castShadow><cylinderGeometry args={[.035, .04, .05, 12]} /><KitchenSurfaceMaterial material="rubber" /></mesh>
}
