import { BoxPart, DARK_STEEL, Handle, KitchenSurfaceMaterial, STEEL, TubularLeg } from './parts'
import type { EquipmentVisualProps } from './types'

function Faucet({ x = 0, height, z }: { x?: number; height: number; z: number }) {
  return <group position={[x, height, z]}><mesh><cylinderGeometry args={[.014, .014, .22, 12]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh><mesh position={[0, .1, .07]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.07, .014, 10, 24, Math.PI]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh></group>
}

function SinkBase({ w, d, h, basins }: { w: number; d: number; h: number; basins: number }) {
  return <group>
    <BoxPart position={[0, h * .88, 0]} size={[w, .08, d]} color={STEEL} />
    <BoxPart position={[0, h * .99, -d / 2 + .025]} size={[w, .22, .05]} color={STEEL} />
    {[-.43, .43].flatMap((x) => [-.4, .4].map((z) => <TubularLeg key={`${x}-${z}`} x={w * x} z={d * z} height={h * .84} />))}
    {Array.from({ length: basins }, (_, index) => <group key={index} position={[(index - (basins - 1) / 2) * w * .43, h * .93, 0]}>
      <BoxPart position={[0, 0, 0]} size={[w * (basins === 2 ? .36 : .58), .045, d * .58]} color="#596762" />
      <BoxPart position={[0, .025, 0]} size={[w * (basins === 2 ? .3 : .5), .02, d * .49]} color="#26312d" />
    </group>)}
  </group>
}

export function DoubleSinkVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group><SinkBase w={w} d={d} h={h} basins={2} /><Faucet height={h * 1.08} z={-d * .32} /></group>
}
DoubleSinkVisual.displayName = 'DoubleSinkVisual'

export function SingleSinkVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group><SinkBase w={w} d={d} h={h} basins={1} /><Faucet height={h * 1.08} z={-d * .32} /></group>
}
SingleSinkVisual.displayName = 'SingleSinkVisual'

export function HandwashVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group><SinkBase w={w} d={d} h={h} basins={1} /><Faucet height={h * 1.08} z={-d * .28} /></group>
}
HandwashVisual.displayName = 'HandwashVisual'

export function PreRinseVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group><SinkBase w={w} d={d} h={h} basins={1} /><Faucet height={h * 1.12} z={-d * .3} /><mesh position={[w * .24, h * 1.26, -d * .34]}><cylinderGeometry args={[.012, .012, h * .7, 10]} /><meshStandardMaterial color={DARK_STEEL} metalness={.75} /></mesh><mesh position={[w * .24, h * 1.59, -d * .16]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[d * .18, .012, 8, 20, Math.PI]} /><meshStandardMaterial color={DARK_STEEL} metalness={.75} /></mesh><Handle x={w * .24} y={h * 1.45} z={d * .02} vertical={false} length={.2} /></group>
}
PreRinseVisual.displayName = 'PreRinseVisual'

export function DishwasherVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h / 2, 0]} size={[w, h, d]} color="#b9c3c0" />
    <BoxPart position={[0, h * .47, d / 2 + .018]} size={[w * .9, h * .67, .036]} color="#ced6d3" />
    <Handle x={0} y={h * .7} z={d / 2 + .055} vertical={false} length={w * .56} />
    <BoxPart position={[0, h * .89, d / 2 + .022]} size={[w * .9, h * .12, .04]} color="#4e5a56" />
    <mesh position={[w * .31, h * .89, d / 2 + .05]}><circleGeometry args={[.028, 14]} /><meshStandardMaterial color="#65b7a9" emissive="#65b7a9" emissiveIntensity={.5} /></mesh>
    <group position={[0, h + .035, 0]}>{Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-w * .36 + index * w * .12, 0, 0]}><boxGeometry args={[.012, .06, d * .7]} /><meshStandardMaterial color={DARK_STEEL} metalness={.65} /></mesh>)}</group>
  </group>
}
DishwasherVisual.displayName = 'DishwasherVisual'

export function PassThroughDishwasherVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .22, 0]} size={[w, h * .44, d]} material="brushedSteel" />
    <BoxPart position={[0, h * .68, -d * .38]} size={[w * .9, h * .72, d * .22]} color="#aeb9b6" radius={.012} />
    <BoxPart position={[0, h * .62, d / 2 + .028]} size={[w * .88, h * .48, .045]} material="darkSteel" radius={.012} />
    <BoxPart position={[0, h * .62, d / 2 + .058]} size={[w * .72, h * .34, .018]} material="glass" radius={.008} />
    <Handle x={0} y={h * .86} z={d / 2 + .082} vertical={false} length={w * .62} />
    <BoxPart position={[0, h * .43, 0]} size={[w * .94, .055, d * .9]} material="darkSteel" radius={.006} />
    <group position={[0, h * .47, 0]}>{Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[-w * .38 + index * w * .108, 0, 0]}><boxGeometry args={[.012, .055, d * .72]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh>)}</group>
    <BoxPart position={[0, h * .31, d / 2 + .035]} size={[w * .9, h * .12, .055]} material="blackEnamel" radius={.008} />
    <mesh position={[w * .31, h * .31, d / 2 + .068]}><circleGeometry args={[.027, 18]} /><meshStandardMaterial color="#65b7a9" emissive="#65b7a9" emissiveIntensity={.7} /></mesh>
    {[-.41, .41].map((x) => <mesh key={x} position={[w * x, h * .73, d * .3]}><cylinderGeometry args={[.016, .016, h * .55, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>)}
  </group>
}
PassThroughDishwasherVisual.displayName = 'PassThroughDishwasherVisual'
