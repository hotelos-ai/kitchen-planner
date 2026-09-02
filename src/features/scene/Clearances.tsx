import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Architecture, DisplayUnit, EquipmentItem } from '../../domain/project'
import { buildClearanceDescriptors, type ArcClearanceDescriptor, type RectClearanceDescriptor } from './clearance-geometry'
import { toWorld } from './ArchitectureMesh'

function RectClearance({ zone, showLabels }: { zone: RectClearanceDescriptor; showLabels: boolean }) {
  const width = toWorld(zone.widthMm)
  const depth = toWorld(zone.depthMm)
  const frontOffset = toWorld(zone.frontOffsetMm)
  const border: [number, number, number][] = [[0, .028, frontOffset], [width, .028, frontOffset], [width, .028, frontOffset + depth], [0, .028, frontOffset + depth], [0, .028, frontOffset]]
  const hatchCount = Math.max(2, Math.floor(zone.widthMm / 180))
  return (
    <group position={[toWorld(zone.xMm), 0, toWorld(zone.yMm)]} rotation={[0, -THREE.MathUtils.degToRad(zone.rotationDeg), 0]}>
      <mesh position={[width / 2, .018, frontOffset + depth / 2]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={zone.fill} transparent opacity={.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={border} color={zone.outline} lineWidth={2.4} transparent opacity={.98} raycast={() => null} />
      {Array.from({ length: hatchCount }, (_, index) => {
        const x = (index + .5) * width / hatchCount
        const half = Math.min(.16, depth * .22)
        return <Line key={index} points={[[x - half, .027, frontOffset + depth * .32], [x + half, .027, frontOffset + depth * .68]]} color={zone.hatch} lineWidth={1.1} transparent opacity={.7} raycast={() => null} />
      })}
      {showLabels && <Html position={[width / 2, .045, frontOffset + depth / 2]} center distanceFactor={8} className={`clearance-label ${zone.kind}`}>
        <span>{zone.label}</span>
      </Html>}
    </group>
  )
}

function ArcClearance({ zone, showLabels }: { zone: ArcClearanceDescriptor; showLabels: boolean }) {
  const radius = toWorld(zone.radiusMm)
  return (
    <group position={[toWorld(zone.xMm), 0, toWorld(zone.yMm)]} rotation={[0, -THREE.MathUtils.degToRad(zone.rotationDeg), 0]}>
      <mesh position={[0, .02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[radius, 36, 0, Math.PI / 2]} />
        <meshBasicMaterial color={zone.fill} transparent opacity={.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, .029, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[Math.max(0, radius - .022), radius, 36, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color={zone.outline} transparent opacity={.98} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={[[0, .03, 0], [radius, .03, 0]]} color={zone.outline} lineWidth={2} raycast={() => null} />
      <Line points={[[0, .03, 0], [0, .03, radius]]} color={zone.outline} lineWidth={2} raycast={() => null} />
      <mesh position={[0, .04, 0]} raycast={() => null}><cylinderGeometry args={[.045, .045, .035, 16]} /><meshBasicMaterial color={zone.outline} /></mesh>
      {showLabels && <Html position={[radius * .58, .06, radius * .58]} center distanceFactor={8} className="clearance-label door-swing"><span>{zone.label}</span></Html>}
    </group>
  )
}

export function Clearances({ items, architecture, displayUnit, visible, showLabels = true }: { items: EquipmentItem[]; architecture: Architecture; displayUnit: DisplayUnit; visible: boolean; showLabels?: boolean }) {
  if (!visible) return null
  return <group>{buildClearanceDescriptors(items, architecture, displayUnit).map((zone) => zone.shape === 'rect' ? <RectClearance key={zone.id} zone={zone} showLabels={showLabels} /> : <ArcClearance key={zone.id} zone={zone} showLabels={showLabels} />)}</group>
}
