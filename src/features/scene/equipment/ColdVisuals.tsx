import { BoxPart, Foot, Handle, STEEL } from './parts'
import type { EquipmentVisualProps } from './types'

function Vent({ width, y, z }: { width: number; y: number; z: number }) {
  return <group>{Array.from({ length: 6 }, (_, index) => <mesh key={index} position={[-width * .32 + index * width * .13, y, z]}><boxGeometry args={[width * .08, .018, .012]} /><meshStandardMaterial color="#3e4945" /></mesh>)}</group>
}

export function UprightFreezerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h / 2 + .04, 0]} size={[w, h - .08, d]} color="#d3dcda" />
    <BoxPart position={[0, h * .54, d / 2 + .012]} size={[w * .91, h * .73, .025]} color="#c6d0cd" />
    <Handle x={w * .34} y={h * .57} z={d / 2 + .04} length={h * .42} />
    <Vent width={w} y={h * .1} z={d / 2 + .03} />
    {[-.38, .38].map((x) => <Foot key={x} x={w * x} z={d * .36} />)}
  </group>
}
UprightFreezerVisual.displayName = 'UprightFreezerVisual'

export function TwoDoorFridgeVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h / 2 + .04, 0]} size={[w, h - .08, d]} color="#c8d1ce" />
    {[-1, 1].map((side) => <group key={side}>
      <BoxPart position={[side * w * .245, h * .55, d / 2 + .014]} size={[w * .47, h * .72, .028]} color="#d5ddda" />
      <Handle x={side * w * .08} y={h * .55} z={d / 2 + .045} length={h * .38} />
    </group>)}
    <Vent width={w} y={h * .12} z={d / 2 + .03} />
    {[-.42, -.14, .14, .42].map((x) => <Foot key={x} x={w * x} z={d * .37} />)}
  </group>
}
TwoDoorFridgeVisual.displayName = 'TwoDoorFridgeVisual'

export function PrepFridgeVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .42, 0]} size={[w, h * .84, d]} color="#c7d2cf" />
    <BoxPart position={[0, h * .87, 0]} size={[w + .03, .06, d + .03]} color={STEEL} />
    {[-1, 1].map((side) => <group key={side}>
      <BoxPart position={[side * w * .245, h * .42, d / 2 + .015]} size={[w * .47, h * .7, .03]} color="#d6dedb" />
      <Handle x={side * w * .09} y={h * .5} z={d / 2 + .045} length={h * .3} />
    </group>)}
    {Array.from({ length: 5 }, (_, index) => <BoxPart key={index} position={[-w * .36 + index * w * .18, h * .93, -d * .25]} size={[w * .15, .035, d * .23]} color="#77827e" />)}
  </group>
}
PrepFridgeVisual.displayName = 'PrepFridgeVisual'
