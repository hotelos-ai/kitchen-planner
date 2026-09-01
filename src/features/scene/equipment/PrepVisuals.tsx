import { BoxPart, DARK_STEEL, KitchenSurfaceMaterial, STEEL, TubularLeg } from './parts'
import type { EquipmentVisualProps } from './types'

export function OpenTableVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h - .035, 0]} size={[w, .07, d]} color={STEEL} />
    {[-.43, .43].flatMap((x) => [-.4, .4].map((z) => <TubularLeg key={`${x}-${z}`} x={w * x} z={d * z} height={h - .07} />))}
    <BoxPart position={[0, h * .28, 0]} size={[w * .88, .04, d * .82]} color="#9aa5a1" />
  </group>
}
OpenTableVisual.displayName = 'OpenTableVisual'

export function LandingTableVisual(props: EquipmentVisualProps) { return <OpenTableVisual {...props} /> }
LandingTableVisual.displayName = 'LandingTableVisual'

function EnclosedBenchBody({ w, d, h }: { w: number; d: number; h: number }) {
  return <group>
    <BoxPart position={[0, h * .46, 0]} size={[w, h * .86, d]} material="brushedSteel" />
    <BoxPart position={[0, h * .94, 0]} size={[w + .035, .07, d + .035]} color="#e0e6e4" radius={.012} />
    <BoxPart position={[-w * .16, h * .49, d / 2 + .027]} size={[w * .62, h * .65, .04]} color="#b8c2bf" radius={.008} />
    <BoxPart position={[w * .16, h * .49, d / 2 + .052]} size={[w * .62, h * .65, .04]} color="#c9d1cf" radius={.008} />
    {[-.1, .1].map((x) => <BoxPart key={x} position={[w * x, h * .49, d / 2 + .078]} size={[.035, h * .16, .016]} material="darkSteel" radius={.005} />)}
    <BoxPart position={[0, h * .08, d / 2 + .025]} size={[w * .94, h * .12, .045]} material="darkSteel" radius={.008} />
  </group>
}

export function EnclosedBenchVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <EnclosedBenchBody w={w} d={d} h={h} />
}
EnclosedBenchVisual.displayName = 'EnclosedBenchVisual'

export function IngredientCounterVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <EnclosedBenchBody w={w} d={d} h={h} />
    <BoxPart position={[0, h * 1.08, -d * .38]} size={[w, h * .28, .045]} material="brushedSteel" radius={.008} />
    {Array.from({ length: 5 }, (_, index) => <group key={index} position={[-w * .38 + index * w * .19, h * 1.01, -d * .17]}>
      <BoxPart position={[0, 0, 0]} size={[w * .16, .045, d * .3]} material="darkSteel" radius={.006} />
      <BoxPart position={[0, .025, 0]} size={[w * .13, .025, d * .25]} color={index % 2 ? '#9a683d' : '#718654'} metalness={0} roughness={.74} radius={.005} />
    </group>)}
  </group>
}
IngredientCounterVisual.displayName = 'IngredientCounterVisual'

export function MixerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  const radius = Math.min(w, d) * .3
  return <group>
    <BoxPart position={[0, .06, 0]} size={[w * .55, .12, d * .55]} color={DARK_STEEL} />
    <BoxPart position={[-w * .22, h * .42, 0]} size={[w * .18, h * .72, d * .3]} color="#7c8783" />
    <BoxPart position={[0, h * .79, 0]} size={[w * .58, h * .22, d * .4]} color="#9fa9a5" />
    <mesh position={[w * .1, h * .42, 0]}><sphereGeometry args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={STEEL} metalness={.86} roughness={.2} side={2} /></mesh>
    <mesh position={[w * .1, h * .56, 0]}><cylinderGeometry args={[.012, .012, h * .35, 10]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
    <mesh position={[w * .1, h * .38, 0]}><torusGeometry args={[radius * .52, .01, 8, 20]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
  </group>
}
MixerVisual.displayName = 'MixerVisual'
