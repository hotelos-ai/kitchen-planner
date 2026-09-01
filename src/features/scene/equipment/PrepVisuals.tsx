import { BoxPart, DARK_STEEL, STEEL, TubularLeg } from './parts'
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

export function MixerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  const radius = Math.min(w, d) * .3
  return <group>
    <BoxPart position={[0, .06, 0]} size={[w * .55, .12, d * .55]} color={DARK_STEEL} />
    <BoxPart position={[-w * .22, h * .42, 0]} size={[w * .18, h * .72, d * .3]} color="#7c8783" />
    <BoxPart position={[0, h * .79, 0]} size={[w * .58, h * .22, d * .4]} color="#9fa9a5" />
    <mesh position={[w * .1, h * .42, 0]}><sphereGeometry args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={STEEL} metalness={.3} roughness={.38} side={2} /></mesh>
    <mesh position={[w * .1, h * .56, 0]}><cylinderGeometry args={[.012, .012, h * .35, 10]} /><meshStandardMaterial color={DARK_STEEL} metalness={.28} /></mesh>
    <mesh position={[w * .1, h * .38, 0]}><torusGeometry args={[radius * .52, .01, 8, 20]} /><meshStandardMaterial color={DARK_STEEL} /></mesh>
  </group>
}
MixerVisual.displayName = 'MixerVisual'
