import { BoxPart, KitchenSurfaceMaterial, Knob } from './parts'
import type { EquipmentVisualProps } from './types'

function Burner({ x, y, z, size }: { x: number; y: number; z: number; size: number }) {
  return <group position={[x, y, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[size * .26, size * .055, 10, 28]} />
      <KitchenSurfaceMaterial material="castIron" />
    </mesh>
    <mesh castShadow><boxGeometry args={[size * .82, .022, .028]} /><KitchenSurfaceMaterial material="castIron" /></mesh>
    <mesh rotation={[0, Math.PI / 2, 0]} castShadow><boxGeometry args={[size * .82, .022, .028]} /><KitchenSurfaceMaterial material="castIron" /></mesh>
    <mesh position={[0, .008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[size * .12, 20]} />
      <KitchenSurfaceMaterial material="blackEnamel" />
    </mesh>
  </group>
}

function RangeVisual({ widthM: w, depthM: d, heightM: h, burners, oven }: EquipmentVisualProps & {
  burners: 4 | 6
  oven: boolean
}) {
  const columns = burners / 2
  const burnerSize = Math.min(w / columns, d / 2) * .72
  return <group>
    <BoxPart position={[0, h * .42, 0]} size={[w, h * .84, d]} material="brushedSteel" />
    <BoxPart position={[0, h * .89, 0]} size={[w, .065, d]} material="darkSteel" radius={.01} />
    {Array.from({ length: burners }, (_, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return <Burner
        key={index}
        x={-w * .34 + column * (w * .68 / Math.max(1, columns - 1))}
        y={h * .935}
        z={-d * .25 + row * d * .5}
        size={burnerSize}
      />
    })}
    <BoxPart position={[0, h * 1.02, -d / 2 + .025]} size={[w, h * .23, .05]} material="brushedSteel" radius={.008} />
    <BoxPart position={[0, h * .7, d / 2 + .02]} size={[w * .96, h * .17, .04]} material="darkSteel" radius={.008} />
    {Array.from({ length: burners }, (_, index) => <Knob key={index} x={-w * .38 + index * (w * .76 / Math.max(1, burners - 1))} y={h * .7} z={d / 2 + .052} />)}
    {oven ? <group>
      <BoxPart position={[0, h * .33, d / 2 + .025]} size={[w * .84, h * .5, .045]} material="blackEnamel" radius={.015} />
      <BoxPart position={[0, h * .34, d / 2 + .054]} size={[w * .66, h * .31, .015]} material="glass" radius={.008} />
      <mesh position={[0, h * .59, d / 2 + .073]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.014, .014, w * .58, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
    </group> : <group>
      {[-1, 1].map((side) => <BoxPart key={side} position={[side * w * .235, h * .34, d / 2 + .025]} size={[w * .44, h * .48, .04]} color="#aeb9b6" radius={.009} />)}
      <BoxPart position={[0, h * .1, d / 2 + .052]} size={[w * .72, .045, .025]} material="darkSteel" radius={.006} />
    </group>}
  </group>
}

export function FourBurnerVisual(props: EquipmentVisualProps) { return <RangeVisual {...props} burners={4} oven={false} /> }
FourBurnerVisual.displayName = 'FourBurnerVisual'

export function SixBurnerVisual(props: EquipmentVisualProps) { return <RangeVisual {...props} burners={6} oven={false} /> }
SixBurnerVisual.displayName = 'SixBurnerVisual'

export function RangeOvenVisual(props: EquipmentVisualProps) { return <RangeVisual {...props} burners={6} oven /> }
RangeOvenVisual.displayName = 'RangeOvenVisual'

function FlatTopSurface({ w, d, h }: { w: number; d: number; h: number }) {
  return <group>
    <BoxPart position={[0, h * .91, 0]} size={[w, .055, d * .92]} material="castIron" radius={.006} />
    <BoxPart position={[0, h * .99, -d * .46]} size={[w, h * .19, .035]} material="darkSteel" radius={.006} />
    <BoxPart position={[w * .37, h * .86, d * .43]} size={[w * .18, .045, d * .1]} material="blackEnamel" radius={.004} />
  </group>
}

export function FlatTopVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .42, 0]} size={[w, h * .84, d]} material="brushedSteel" />
    <FlatTopSurface w={w} d={d} h={h} />
    <BoxPart position={[0, h * .68, d / 2 + .025]} size={[w * .95, h * .18, .04]} material="darkSteel" radius={.008} />
    {[-.25, 0, .25].map((x) => <Knob key={x} x={w * x} y={h * .68} z={d / 2 + .054} />)}
    <BoxPart position={[0, h * .29, d / 2 + .025]} size={[w * .78, h * .48, .04]} color="#b8c2bf" radius={.009} />
  </group>
}
FlatTopVisual.displayName = 'FlatTopVisual'

function FryerBasket({ x, y, z, width, depth }: { x: number; y: number; z: number; width: number; depth: number }) {
  return <group position={[x, y, z]}>
    <BoxPart position={[0, 0, 0]} size={[width, .035, depth]} material="darkSteel" radius={.004} />
    {[-.38, -.19, 0, .19, .38].map((offset) => <mesh key={offset} position={[width * offset, .045, 0]}><boxGeometry args={[.009, .08, depth * .92]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh>)}
    <mesh position={[0, .08, depth * .7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.012, .012, depth * .65, 10]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>
    <BoxPart position={[0, .08, depth * 1.03]} size={[width * .42, .055, depth * .2]} material="rubber" radius={.012} />
  </group>
}

export function FryerBankVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .42, 0]} size={[w, h * .84, d]} material="brushedSteel" />
    {[-1, 1].map((side) => <group key={side}>
      <BoxPart position={[side * w * .24, h * .9, -d * .08]} size={[w * .43, .075, d * .62]} material="blackEnamel" radius={.012} />
      <FryerBasket x={side * w * .24} y={h * .96} z={-d * .08} width={w * .34} depth={d * .4} />
      <Knob x={side * w * .24} y={h * .65} z={d / 2 + .053} />
      <mesh position={[side * w * .24, h * .26, d / 2 + .057]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.025, .018, .04, 12]} /><KitchenSurfaceMaterial material="copper" /></mesh>
    </group>)}
    <BoxPart position={[0, h * .66, d / 2 + .025]} size={[w * .94, h * .18, .04]} material="darkSteel" radius={.008} />
  </group>
}
FryerBankVisual.displayName = 'FryerBankVisual'

export function FlatTopFryerVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  const flatWidth = w * .62
  const fryerWidth = w * .32
  return <group>
    <BoxPart position={[0, h * .4, 0]} size={[w, h * .8, d]} material="brushedSteel" />
    <group position={[-w * .18, 0, 0]}><FlatTopSurface w={flatWidth} d={d} h={h} /></group>
    <BoxPart position={[w * .32, h * .9, -d * .07]} size={[fryerWidth, .075, d * .62]} material="blackEnamel" radius={.01} />
    <FryerBasket x={w * .32} y={h * .96} z={-d * .07} width={fryerWidth * .72} depth={d * .4} />
    <BoxPart position={[0, h * .65, d / 2 + .025]} size={[w * .96, h * .18, .04]} material="darkSteel" radius={.008} />
    {Array.from({ length: 5 }, (_, index) => <Knob key={index} x={-w * .36 + index * w * .18} y={h * .65} z={d / 2 + .054} />)}
    {[-1, 1].map((side) => <BoxPart key={side} position={[side * w * .24, h * .28, d / 2 + .026]} size={[w * .44, h * .42, .04]} color="#b4bfbb" radius={.008} />)}
  </group>
}
FlatTopFryerVisual.displayName = 'FlatTopFryerVisual'

export function TandoorVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  const radius = Math.min(w, d) * .42
  return <group>
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[radius * .82, radius, h, 24]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh>
    <mesh position={[0, h + .01, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[radius * .55, radius * .16, 14, 36]} /><KitchenSurfaceMaterial material="castIron" /></mesh>
    <mesh position={[0, h + .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius * .42, 32]} /><meshPhysicalMaterial color="#171b19" emissive="#b13f1d" emissiveIntensity={.38} roughness={.72} /></mesh>
    <BoxPart position={[0, .08, d * .34]} size={[w * .5, .15, .04]} material="darkSteel" radius={.01} />
    <mesh position={[0, h * .5, d / 2 + .012]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[radius * .68, .018, 10, 32]} /><KitchenSurfaceMaterial material="copper" /></mesh>
  </group>
}
TandoorVisual.displayName = 'TandoorVisual'

function HoodFilters({ w, d, y, rows = 3 }: { w: number; d: number; y: number; rows?: number }) {
  return <group>{Array.from({ length: rows }, (_, index) => <group key={index} position={[0, y, -d * .32 + index * (d * .64 / Math.max(1, rows - 1))]}>
    <BoxPart position={[0, 0, 0]} size={[w * .92, .035, d * .22]} material="darkSteel" radius={.004} />
    {Array.from({ length: 8 }, (_, slat) => <mesh key={slat} position={[-w * .38 + slat * w * .108, -.022, 0]}><boxGeometry args={[.018, .018, d * .18]} /><KitchenSurfaceMaterial material="brushedSteel" /></mesh>)}
  </group>)}</group>
}

export function CanopyHoodVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .61, 0]} size={[w, h * .56, d]} material="brushedSteel" radius={.018} />
    <BoxPart position={[0, h * .29, -d * .18]} size={[w * .94, h * .18, d * .6]} color="#aeb8b5" radius={.012} />
    <HoodFilters w={w} d={d} y={h * .16} />
    {[-.3, .3].map((x) => <mesh key={x} position={[w * x, h * .12, d * .35]}><boxGeometry args={[w * .18, .018, .08]} /><meshStandardMaterial color="#fff4cb" emissive="#fff4cb" emissiveIntensity={1.4} /></mesh>)}
  </group>
}
CanopyHoodVisual.displayName = 'CanopyHoodVisual'

export function IslandHoodVisual({ widthM: w, depthM: d, heightM: h }: EquipmentVisualProps) {
  return <group>
    <BoxPart position={[0, h * .55, 0]} size={[w, h * .48, d]} material="brushedSteel" radius={.018} />
    <BoxPart position={[0, h * .22, 0]} size={[w * .94, h * .18, d * .9]} color="#aeb8b5" radius={.012} />
    <HoodFilters w={w} d={d} y={h * .11} rows={4} />
    {[-.4, .4].flatMap((x) => [-.32, .32].map((z) => <mesh key={`${x}-${z}`} position={[w * x, h * 1.05, d * z]}><cylinderGeometry args={[.018, .018, h, 12]} /><KitchenSurfaceMaterial material="darkSteel" /></mesh>))}
    {[-.28, .28].flatMap((x) => [-.36, .36].map((z) => <mesh key={`${x}-${z}`} position={[w * x, h * .08, d * z]}><boxGeometry args={[w * .2, .018, .07]} /><meshStandardMaterial color="#fff4cb" emissive="#fff4cb" emissiveIntensity={1.4} /></mesh>))}
  </group>
}
IslandHoodVisual.displayName = 'IslandHoodVisual'
