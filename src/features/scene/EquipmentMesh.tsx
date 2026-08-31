import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { EquipmentItem } from '../../domain/project'
import { toWorld } from './ArchitectureMesh'

const CATEGORY_COLORS: Record<EquipmentItem['category'], string> = {
  cooking: '#b95f47', cold: '#5f8f94', prep: '#819275', washing: '#a48748',
  landing: '#aa925d', storage: '#897f70', hood: '#9da9a5', custom: '#826f94',
}

function Detail({ item, width, height, depth }: { item: EquipmentItem; width: number; height: number; depth: number }) {
  const top = height / 2 + 0.008
  if (item.id === 'six-burner') {
    return <>{Array.from({ length: 6 }, (_, index) => <mesh key={index} position={[-width * .3 + (index % 3) * width * .3, top, -depth * .23 + Math.floor(index / 3) * depth * .46]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[Math.min(width, depth) * .09, .012, 8, 20]} /><meshStandardMaterial color="#252a28" /></mesh>)}</>
  }
  if (item.id === 'tandoor') {
    return <mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[Math.min(width, depth) * .24, .035, 12, 32]} /><meshStandardMaterial color="#292f2c" /></mesh>
  }
  if (item.id === 'flat-top-fryer') {
    return <><mesh position={[-width * .19, top, 0]}><boxGeometry args={[width * .55, .025, depth * .7]} /><meshStandardMaterial color="#363c39" /></mesh><mesh position={[width * .27, top, 0]}><boxGeometry args={[width * .25, .035, depth * .55]} /><meshStandardMaterial color="#222725" /></mesh></>
  }
  if (item.category === 'washing') {
    return <>{Array.from({ length: item.id === 'double-sink' ? 2 : 1 }, (_, index) => <mesh key={index} position={[(index - (item.id === 'double-sink' ? .5 : 0)) * width * .42, top, 0]}><boxGeometry args={[width * (item.id === 'double-sink' ? .36 : .58), .018, depth * .55]} /><meshStandardMaterial color="#60706c" /></mesh>)}</>
  }
  if (item.category === 'cold') {
    return <><mesh position={[0, 0, depth / 2 + .007]}><boxGeometry args={[.012, height * .78, .018]} /><meshStandardMaterial color="#d8e6e5" /></mesh><mesh position={[width * .36, 0, depth / 2 + .02]}><sphereGeometry args={[.018, 8, 8]} /><meshStandardMaterial color="#283330" /></mesh></>
  }
  return null
}

type Props = {
  item: EquipmentItem
  selected: boolean
  wallHeightMm: number
  onSelect(id: string): void
}

export function EquipmentMesh({ item, selected, wallHeightMm, onSelect }: Props) {
  const width = toWorld(item.widthMm)
  const height = toWorld(item.heightMm)
  const depth = toWorld(item.depthMm)
  const isHood = item.category === 'hood'
  const y = isHood ? toWorld(wallHeightMm) - height / 2 - .15 : height / 2
  return (
    <group
      position={[toWorld(item.xMm), 0, toWorld(item.yMm)]}
      rotation={[0, -THREE.MathUtils.degToRad(item.rotationDeg), 0]}
      onClick={(event) => { event.stopPropagation(); onSelect(item.id) }}
    >
      <group position={[width / 2, y, depth / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={CATEGORY_COLORS[item.category]} roughness={isHood ? .35 : .68} metalness={isHood ? .58 : .14} transparent={isHood} opacity={isHood ? .72 : 1} />
          <Edges color={selected ? '#ff9c78' : '#33403c'} threshold={20} />
        </mesh>
        {!isHood && <Detail item={item} width={width} height={height} depth={depth} />}
        <Html position={[0, height / 2 + .12, 0]} center distanceFactor={8} className={`scene-label${selected ? ' selected' : ''}`}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(item.id) }} aria-label={`Select ${item.label} in 3D`}>{item.label}</button>
        </Html>
        {selected && <mesh position={[0, -y + .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[Math.max(width, depth) * .58, Math.max(width, depth) * .64, 36]} /><meshBasicMaterial color="#e56f4e" transparent opacity={.8} side={THREE.DoubleSide} /></mesh>}
      </group>
    </group>
  )
}
