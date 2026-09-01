import { Edges, Html } from '@react-three/drei'
import { createElement } from 'react'
import * as THREE from 'three'
import type { EquipmentItem } from '../../domain/project'
import { toWorld } from './ArchitectureMesh'
import { getEquipmentVisual } from './equipment/equipment-visual-registry'
import { equipmentSelectionDescriptor } from './equipment-selection'

type Props = {
  item: EquipmentItem
  selected: boolean
  wallHeightMm: number
  onSelect(id: string): void
}

export function EquipmentMesh({ item, selected, wallHeightMm, onSelect }: Props) {
  const selection = equipmentSelectionDescriptor(item)
  const widthM = selection.widthM
  const heightM = selection.heightM
  const depthM = selection.depthM
  const isHood = item.category === 'hood'
  const baseY = isHood ? toWorld(wallHeightMm) - heightM - .15 : 0
  return (
    <group
      position={[toWorld(item.xMm), 0, toWorld(item.yMm)]}
      rotation={[0, -THREE.MathUtils.degToRad(item.rotationDeg), 0]}
      onClick={(event) => { event.stopPropagation(); onSelect(item.id) }}
      userData={{ itemId: item.id }}
    >
      <group position={[widthM / 2, baseY, depthM / 2]}>
        {createElement(getEquipmentVisual(item), { item, widthM, depthM, heightM })}
        <mesh position={[0, heightM / 2, 0]} visible={selected}>
          <boxGeometry args={[widthM + .025, heightM + .025, depthM + .025]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#ff8c63" threshold={12} />
        </mesh>
        <Html position={[0, heightM + .13, 0]} center distanceFactor={8} className={`scene-label${selected ? ' selected' : ''}`}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(item.id) }} aria-label={`Select ${item.label} in 3D`}>{item.label}</button>
        </Html>
      </group>
    </group>
  )
}

export { equipmentSelectionDescriptor } from './equipment-selection'
