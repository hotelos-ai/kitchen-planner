import { BoxPart, Foot, KitchenSurfaceMaterial, TubularLeg } from './parts'
import type { EquipmentVisualProps } from './types'

const safe = (value: number, minimum = .04) => Math.max(minimum, value)
const positions = (count: number) => Array.from({ length: count }, (_, index) => index)

function ShelfDeck({ widthM, depthM, y, thickness = .045 }: { widthM: number; depthM: number; y: number; thickness?: number }) {
  return <BoxPart position={[0, y, 0]} size={[safe(widthM), thickness, safe(depthM)]} radius={.008} />
}

function RackFrame({ widthM, depthM, heightM, tiers = 4, mobile = false }: {
  widthM: number
  depthM: number
  heightM: number
  tiers?: number
  mobile?: boolean
}) {
  const width = safe(widthM, .24)
  const depth = safe(depthM, .2)
  const height = safe(heightM, .35)
  const postHeight = mobile ? Math.max(.2, height - .08) : height
  const inset = .035
  return <group>
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <TubularLeg
      key={`${x}-${z}`}
      x={x * (width / 2 - inset)}
      z={z * (depth / 2 - inset)}
      height={postHeight}
      radius={.018}
    />))}
    {positions(tiers).map((index) => <ShelfDeck
      key={index}
      widthM={width}
      depthM={depth}
      y={(mobile ? .1 : .04) + (postHeight - .08) * (index / Math.max(1, tiers - 1))}
      thickness={.035}
    />)}
    {mobile && [-1, 1].flatMap((x) => [-1, 1].map((z) => <Foot key={`caster-${x}-${z}`} x={x * (width / 2 - inset)} z={z * (depth / 2 - inset)} />))}
  </group>
}

export function StorageWallShelfVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const shelfY = Math.max(.45, heightM - .05)
  return <group>
    <ShelfDeck widthM={widthM} depthM={depthM} y={shelfY} />
    {[-1, 1].map((side) => <group key={side} position={[side * widthM * .35, shelfY - .12, -depthM / 2]}>
      <BoxPart position={[0, 0, 0]} size={[.035, .24, .035]} material="darkSteel" radius={.006} />
      <BoxPart position={[0, .1, depthM * .22]} size={[.035, .035, safe(depthM * .44)]} material="darkSteel" radius={.006} />
    </group>)}
  </group>
}
StorageWallShelfVisual.displayName = 'StorageWallShelfVisual'

export function StorageOvershelfVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const shelfY = Math.max(.45, heightM - .05)
  const postHeight = Math.max(.3, shelfY)
  return <group>
    <ShelfDeck widthM={widthM} depthM={depthM} y={shelfY} />
    {[-1, 1].map((side) => <TubularLeg key={side} x={side * (widthM / 2 - .05)} z={0} height={postHeight} radius={.018} />)}
  </group>
}
StorageOvershelfVisual.displayName = 'StorageOvershelfVisual'

export function StorageRackVisual(props: EquipmentVisualProps) {
  return <RackFrame {...props} />
}
StorageRackVisual.displayName = 'StorageRackVisual'

export function StorageMobileRackVisual(props: EquipmentVisualProps) {
  return <RackFrame {...props} mobile />
}
StorageMobileRackVisual.displayName = 'StorageMobileRackVisual'

export function StorageDunnageVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const platformY = Math.max(.1, Math.min(heightM, .3))
  const slats = 5
  return <group>
    {positions(slats).map((index) => <BoxPart
      key={index}
      position={[(index / (slats - 1) - .5) * (widthM - .06), platformY, 0]}
      size={[safe(widthM / 8), .06, safe(depthM)]}
      radius={.008}
    />)}
    {[-1, 1].map((side) => <BoxPart key={side} position={[0, platformY - .08, side * depthM * .3]} size={[safe(widthM), .06, .07]} material="darkSteel" radius={.008} />)}
  </group>
}
StorageDunnageVisual.displayName = 'StorageDunnageVisual'

export function StorageBinVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const height = safe(heightM, .3)
  return <group>
    <BoxPart position={[0, height * .45, 0]} size={[safe(widthM), height * .9, safe(depthM)]} material="rubber" color="#d8d0b9" roughness={.68} radius={.04} />
    <BoxPart position={[0, height * .92, -.03]} size={[safe(widthM * .96), .055, safe(depthM * .92)]} material="darkSteel" radius={.018} />
    <BoxPart position={[0, height * .68, depthM / 2 + .012]} size={[safe(widthM * .38), .06, .025]} material="darkSteel" radius={.008} />
  </group>
}
StorageBinVisual.displayName = 'StorageBinVisual'

export function StoragePotRackVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const height = safe(heightM, .5)
  return <group>
    <RackFrame widthM={widthM} depthM={depthM} heightM={height} tiers={2} />
    <BoxPart position={[0, height - .08, depthM * .25]} size={[safe(widthM * .9), .035, .035]} material="darkSteel" radius={.006} />
    {positions(5).map((index) => <mesh key={index} position={[(index / 4 - .5) * widthM * .75, height - .16, depthM * .25]}>
      <torusGeometry args={[.035, .008, 8, 12, Math.PI * 1.5]} />
      <KitchenSurfaceMaterial material="darkSteel" />
    </mesh>)}
  </group>
}
StoragePotRackVisual.displayName = 'StoragePotRackVisual'

export function StorageDishRackVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const trayY = Math.max(.08, Math.min(heightM * .25, .22))
  return <group>
    <BoxPart position={[0, trayY / 2, 0]} size={[safe(widthM), safe(trayY), safe(depthM)]} material="darkSteel" radius={.012} />
    {positions(9).map((index) => <BoxPart
      key={index}
      position={[(index / 8 - .5) * widthM * .82, trayY + Math.max(.12, heightM * .28), 0]}
      size={[.012, Math.max(.24, heightM * .55), safe(depthM * .82)]}
      radius={.003}
    />)}
  </group>
}
StorageDishRackVisual.displayName = 'StorageDishRackVisual'

export function StorageTrayRackVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const height = safe(heightM, .5)
  return <group>
    <RackFrame widthM={widthM} depthM={depthM} heightM={height} tiers={2} />
    {positions(8).map((index) => {
      const y = .12 + index * ((height - .2) / 7)
      return <group key={index}>
        <BoxPart position={[-widthM * .32, y, 0]} size={[safe(widthM * .3), .025, safe(depthM * .86)]} radius={.004} />
        <BoxPart position={[widthM * .32, y, 0]} size={[safe(widthM * .3), .025, safe(depthM * .86)]} radius={.004} />
      </group>
    })}
  </group>
}
StorageTrayRackVisual.displayName = 'StorageTrayRackVisual'

export function StorageOverheadVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const deckY = Math.max(.65, heightM * .7)
  const rodHeight = Math.max(.12, heightM - deckY)
  return <group>
    <ShelfDeck widthM={widthM} depthM={depthM} y={deckY} thickness={.055} />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * widthM * .42, deckY + rodHeight / 2, z * depthM * .38]}>
      <cylinderGeometry args={[.012, .012, rodHeight, 10]} />
      <KitchenSurfaceMaterial material="darkSteel" />
    </mesh>))}
  </group>
}
StorageOverheadVisual.displayName = 'StorageOverheadVisual'
