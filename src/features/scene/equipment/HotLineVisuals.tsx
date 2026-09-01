import { BoxPart, DARK_STEEL, Knob } from './parts'
import type { EquipmentVisualProps } from './types'

export function SixBurnerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .43, 0]} size={[w, h * .86, d]} />
    <BoxPart position={[0, h * .9, 0]} size={[w, .06, d]} color={DARK_STEEL} />
    {Array.from({ length: 6 }, (_, index) => <group key={index} position={[-w * .31 + (index % 3) * w * .31, h * .945, -d * .24 + Math.floor(index / 3) * d * .48]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[Math.min(w, d) * .09, .014, 8, 20]} /><meshStandardMaterial color="#202623" metalness={.45} roughness={.48} /></mesh>
      <mesh><boxGeometry args={[w * .24, .018, .018]} /><meshStandardMaterial color="#252b29" /></mesh>
    </group>)}
    <BoxPart position={[0, h * 1.03, -d / 2 + .025]} size={[w, h * .22, .05]} />
    {Array.from({ length: 6 }, (_, index) => <Knob key={index} x={-w * .36 + index * w * .145} y={h * .68} z={d / 2 + .018} />)}
  </group>
}
SixBurnerVisual.displayName = 'SixBurnerVisual'

export function FlatTopFryerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .34, 0]} size={[w, h * .68, d]} color="#aab4b0" />
    <BoxPart position={[-w * .19, h * .74, 0]} size={[w * .6, .06, d * .9]} color="#3f4945" />
    <BoxPart position={[w * .34, h * .74, 0]} size={[w * .27, .055, d * .72]} color="#202623" />
    <BoxPart position={[0, h * .87, -d / 2 + .025]} size={[w, h * .25, .05]} />
    {[.26, .42].map((x, index) => <group key={index} position={[w * x, h * .83, 0]}>
      <BoxPart position={[0, 0, 0]} size={[w * .11, .06, d * .42]} color="#56615d" />
      <mesh position={[0, .08, d * .14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.012, .012, d * .34, 8]} /><meshStandardMaterial color="#303936" metalness={.3} /></mesh>
    </group>)}
    {Array.from({ length: 5 }, (_, index) => <Knob key={index} x={-w * .35 + index * w * .175} y={h * .5} z={d / 2 + .018} />)}
    <BoxPart position={[0, h * .22, d / 2 + .012]} size={[w * .78, h * .34, .025]} color="#7c8783" />
  </group>
}
FlatTopFryerVisual.displayName = 'FlatTopFryerVisual'

export function TandoorVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  const radius = Math.min(w, d) * .42
  return <group>
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[radius * .82, radius, h, 18]} /><meshStandardMaterial color="#c2cac7" metalness={.22} roughness={.44} /></mesh>
    <mesh position={[0, h + .01, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[radius * .55, radius * .16, 12, 28]} /><meshStandardMaterial color="#2b302e" roughness={.6} /></mesh>
    <mesh position={[0, h + .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius * .42, 28]} /><meshStandardMaterial color="#171b19" emissive="#7d2d18" emissiveIntensity={.24} /></mesh>
    <BoxPart position={[0, .08, d * .34]} size={[w * .5, .15, .04]} color="#414a47" />
  </group>
}
TandoorVisual.displayName = 'TandoorVisual'

export function CanopyHoodVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .58, 0]} size={[w, h * .62, d]} color="#c1cac7" metalness={.3} roughness={.38} />
    <BoxPart position={[0, h * .16, -d * .34]} size={[w * .94, .035, d * .24]} color="#4f5a56" />
    <BoxPart position={[0, h * .16, 0]} size={[w * .94, .035, d * .24]} color="#4f5a56" />
    <BoxPart position={[0, h * .16, d * .34]} size={[w * .94, .035, d * .24]} color="#4f5a56" />
    {[-.3, .3].map((x) => <mesh key={x} position={[w * x, h * .13, d * .32]}><boxGeometry args={[w * .18, .018, .08]} /><meshStandardMaterial color="#fff4cb" emissive="#fff4cb" emissiveIntensity={.9} /></mesh>)}
  </group>
}
CanopyHoodVisual.displayName = 'CanopyHoodVisual'
