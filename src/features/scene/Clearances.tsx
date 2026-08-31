import * as THREE from 'three'
import type { Architecture, EquipmentItem } from '../../domain/project'
import { toWorld } from './ArchitectureMesh'

export function Clearances({ items, architecture, visible }: { items: EquipmentItem[]; architecture: Architecture; visible: boolean }) {
  if (!visible) return null
  return (
    <group>
      {items.filter((item) => item.clearance).map((item) => {
        const clearance = item.clearance!
        const width = toWorld(item.widthMm)
        const depth = toWorld(clearance.frontMm)
        return (
          <mesh key={item.id} position={[toWorld(item.xMm + item.widthMm / 2), .018, toWorld(item.yMm + item.depthMm + clearance.frontMm / 2)]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, depth]} />
            <meshBasicMaterial color={clearance.kind === 'heat' ? '#df7657' : '#5f9c91'} transparent opacity={.17} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )
      })}
      {architecture.openings.filter((opening) => opening.kind === 'door' && opening.swingDepthMm).map((opening) => {
        const radius = toWorld(opening.swingDepthMm!)
        const x = opening.wall === 'right' ? toWorld(architecture.widthMm) : opening.wall === 'left' ? 0 : toWorld(opening.offsetMm)
        const z = opening.wall === 'bottom' ? toWorld(architecture.depthMm) : opening.wall === 'top' ? 0 : toWorld(opening.offsetMm)
        return <mesh key={opening.id} position={[x, .022, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius - .025, radius, 36, 1, 0, Math.PI / 2]} /><meshBasicMaterial color="#5d8178" transparent opacity={.7} side={THREE.DoubleSide} /></mesh>
      })}
    </group>
  )
}
