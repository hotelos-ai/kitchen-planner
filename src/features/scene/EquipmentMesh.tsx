import { Edges, Html } from '@react-three/drei'
import { createElement } from 'react'
import * as THREE from 'three'
import type { EquipmentItem } from '../../domain/project'
import { toWorld } from './ArchitectureMesh'
import { getEquipmentVisual } from './equipment/equipment-visual-registry'
import { AppearanceSkinProvider } from './equipment/parts'
import { equipmentSelectionDescriptor } from './equipment-selection'
import { isElevatedShelf } from './equipment-elevation'
import { shelfElevationsMmForItem } from '../../domain/shelf-elevations'
import { physicalConfigurationDetails } from '../../domain/equipment-configurations'

type Props = {
  item: EquipmentItem
  selected: boolean
  wallHeightMm: number
  elevationOffsetMm?: number
  showLabels?: boolean
  onSelect(id: string): void
}

export function EquipmentMesh({ item, selected, wallHeightMm, elevationOffsetMm = 0, showLabels = true, onSelect }: Props) {
  const selection = equipmentSelectionDescriptor(item)
  const widthM = selection.widthM
  const heightM = selection.heightM
  const depthM = selection.depthM
  const isHood = item.category === 'hood'
  const elevatedShelf = isElevatedShelf(item)
  const elevationsM = elevatedShelf ? shelfElevationsMmForItem(item).map((value) => value / 1000) : []
  const mountingElevationM = elevatedShelf ? (physicalConfigurationDetails(item).elevationMm ?? 0) / 1000 : 0
  const contentBaseY = isHood ? toWorld(wallHeightMm) - heightM - .15 : elevationOffsetMm / 1000
  const visualTopY = elevationsM.length ? Math.max(...elevationsM) + .03 : mountingElevationM > 0 ? mountingElevationM + heightM : heightM
  const visualBottomY = elevationsM.length ? Math.min(Math.min(...elevationsM) - .03, visualTopY - heightM) : mountingElevationM
  const visualHeightM = visualTopY - visualBottomY
  return (
    <group
      position={[toWorld(item.xMm), 0, toWorld(item.yMm)]}
      rotation={[0, -THREE.MathUtils.degToRad(item.rotationDeg), 0]}
      onClick={(event) => { event.stopPropagation(); onSelect(item.id) }}
      userData={{ itemId: item.id }}
    >
      <group position={[widthM / 2, contentBaseY, depthM / 2]}>
        <AppearanceSkinProvider skinId={item.appearanceSkinId}>
          {createElement(getEquipmentVisual(item), { item, widthM, depthM, heightM })}
        </AppearanceSkinProvider>
        <mesh position={[0, visualBottomY + visualHeightM / 2, 0]} visible={selected}>
          <boxGeometry args={[widthM + .025, visualHeightM + .025, depthM + .025]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#ff8c63" threshold={12} />
        </mesh>
        {showLabels && <Html position={[0, visualTopY + .13, 0]} center distanceFactor={8} className={`scene-label${selected ? ' selected' : ''}`}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(item.id) }} aria-label={`Select ${item.label} in 3D`}>{item.label}</button>
        </Html>}
      </group>
    </group>
  )
}

export { equipmentSelectionDescriptor } from './equipment-selection'
