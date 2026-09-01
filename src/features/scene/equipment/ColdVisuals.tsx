import { BoxPart, Foot, Handle, KitchenSurfaceMaterial, STEEL } from './parts'
import type { EquipmentVisualProps } from './types'

function Vent({ width, y, z }: { width: number; y: number; z: number }) {
  return <group>{Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-width * .36 + index * width * .12, y, z]}><boxGeometry args={[width * .075, .018, .012]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>)}</group>
}

function DoorSeal({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  return <mesh position={[x, y, z]}><boxGeometry args={[width, height, .009]} /><KitchenSurfaceMaterial material="rubber" /></mesh>
}

export function UprightFreezerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h / 2 + .04, 0]} size={[w, h - .08, d]} material="brushedSteel" />
    <DoorSeal x={0} y={h * .54} z={d / 2 + .014} width={w * .925} height={h * .745} />
    <BoxPart position={[0, h * .54, d / 2 + .025]} size={[w * .89, h * .71, .032]} color="#dce3e1" radius={.012} />
    <Handle x={w * .34} y={h * .57} z={d / 2 + .04} length={h * .42} />
    <Vent width={w} y={h * .1} z={d / 2 + .03} />
    {[-.38, .38].map((x) => <Foot key={x} x={w * x} z={d * .36} />)}
  </group>
}
UprightFreezerVisual.displayName = 'UprightFreezerVisual'

export function TwoDoorFridgeVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h / 2 + .04, 0]} size={[w, h - .08, d]} material="brushedSteel" />
    {[-1, 1].map((side) => <group key={side}>
      <DoorSeal x={side * w * .245} y={h * .55} z={d / 2 + .014} width={w * .475} height={h * .735} />
      <BoxPart position={[side * w * .245, h * .55, d / 2 + .025]} size={[w * .445, h * .695, .032]} color="#dde4e2" radius={.012} />
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

export function UndercounterFridgeVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .45, 0]} size={[w, h * .9, d]} material="brushedSteel" />
    <BoxPart position={[0, h * .94, 0]} size={[w + .035, .065, d + .035]} color="#e1e7e5" radius={.012} />
    {[-1, 1].map((side) => <group key={side}>
      <DoorSeal x={side * w * .245} y={h * .48} z={d / 2 + .017} width={w * .47} height={h * .67} />
      <BoxPart position={[side * w * .245, h * .48, d / 2 + .029]} size={[w * .44, h * .63, .034]} color="#d7dfdc" radius={.01} />
      <Handle x={side * w * .245} y={h * .73} z={d / 2 + .058} vertical={false} length={w * .31} />
    </group>)}
    <Vent width={w * .8} y={h * .12} z={d / 2 + .045} />
    {[-.42, -.14, .14, .42].map((x) => <Foot key={x} x={w * x} z={d * .37} />)}
  </group>
}
UndercounterFridgeVisual.displayName = 'UndercounterFridgeVisual'

export function ChestFreezerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .43, 0]} size={[w, h * .86, d]} color="#d5dddb" />
    {[-1, 1].map((side) => <group key={side}>
      <BoxPart position={[side * w * .245, h * .895, 0]} size={[w * .48, .07, d * .96]} color="#edf1ef" radius={.018} />
      <mesh position={[side * w * .245, h * .865, -d * .47]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.018, .018, w * .38, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
      <Handle x={side * w * .245} y={h * .84} z={d / 2 + .038} vertical={false} length={w * .27} />
    </group>)}
    <Vent width={w * .55} y={h * .16} z={d / 2 + .035} />
    <BoxPart position={[0, .055, 0]} size={[w * .9, .11, d * .88]} material="darkSteel" radius={.012} />
  </group>
}
ChestFreezerVisual.displayName = 'ChestFreezerVisual'
