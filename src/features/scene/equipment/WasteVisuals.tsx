import { BoxPart, KitchenSurfaceMaterial } from './parts'
import type { EquipmentVisualProps } from './types'

const safe = (value: number, minimum = .05) => Math.max(minimum, value)

function BinBody({ widthM, depthM, heightM, color, lidColor = '#202825' }: {
  widthM: number
  depthM: number
  heightM: number
  color: string
  lidColor?: string
}) {
  const bodyHeight = safe(heightM * .78, .3)
  const baseY = Math.max(.07, heightM * .08)
  return <group>
    <BoxPart position={[0, baseY + bodyHeight / 2, 0]} size={[safe(widthM * .9), bodyHeight, safe(depthM * .86)]} material="rubber" color={color} roughness={.72} radius={.045} />
    <BoxPart position={[0, baseY + bodyHeight + .035, -.025]} size={[safe(widthM), .075, safe(depthM * .96)]} material="rubber" color={lidColor} roughness={.66} radius={.035} />
    <BoxPart position={[0, baseY + bodyHeight * .72, depthM * .44]} size={[safe(widthM * .42), .045, .025]} material="rubber" color="#18201d" radius={.008} />
  </group>
}

function Wheel({ x, z, radius }: { x: number; z: number; radius: number }) {
  return <mesh position={[x, radius, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
    <cylinderGeometry args={[radius, radius, .055, 16]} />
    <KitchenSurfaceMaterial material="rubber" color="#151918" roughness={.8} />
  </mesh>
}

export function WasteMobileBinVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const wheelRadius = Math.max(.045, Math.min(.11, heightM * .09))
  return <group>
    <BinBody widthM={widthM} depthM={depthM} heightM={heightM} color="#40594e" />
    {[-1, 1].map((side) => <Wheel key={side} x={side * widthM * .34} z={-depthM * .35} radius={wheelRadius} />)}
    <BoxPart position={[0, heightM * .76, -depthM * .52]} size={[safe(widthM * .62), .035, .045]} material="rubber" color="#202825" radius={.01} />
  </group>
}
WasteMobileBinVisual.displayName = 'WasteMobileBinVisual'

export function WasteCompostBinVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  return <group>
    <BinBody widthM={widthM} depthM={depthM} heightM={heightM} color="#5d5637" lidColor="#6f8b43" />
    <BoxPart position={[0, .035, depthM * .42]} size={[safe(widthM * .34), .035, .1]} material="darkSteel" radius={.012} />
  </group>
}
WasteCompostBinVisual.displayName = 'WasteCompostBinVisual'

export function WasteSortingStationVisual({ widthM, depthM, heightM }: EquipmentVisualProps) {
  const colors = ['#47514d', '#376f8d', '#66853f']
  const compartmentWidth = widthM / colors.length
  return <group>
    {colors.map((lidColor, index) => <group key={lidColor} position={[(index - 1) * compartmentWidth, 0, 0]}>
      <BinBody widthM={compartmentWidth * .94} depthM={depthM} heightM={heightM} color="#555d59" lidColor={lidColor} />
      <BoxPart position={[0, heightM * .83, depthM * .46]} size={[safe(compartmentWidth * .5), .065, .025]} material="rubber" color={lidColor} radius={.008} />
    </group>)}
  </group>
}
WasteSortingStationVisual.displayName = 'WasteSortingStationVisual'
