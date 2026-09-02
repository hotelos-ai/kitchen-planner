import { getCatalogEntry } from '../../../domain/catalog/kitchen-catalog'
import { BoxPart, Foot, TubularLeg } from './parts'
import type { EquipmentVisualProps } from './types'

export function CatalogEquipmentVisual({ item, widthM, depthM, heightM }: EquipmentVisualProps) {
  const entry = getCatalogEntry(item.catalogId ?? '')
  const mounting = entry?.placementRules.mounting ?? 'floor'
  const elevated = mounting === 'wall' || mounting === 'overhead'
  const bodyHeight = Math.max(.08, elevated ? Math.min(.18, heightM * .18) : heightM * .78)
  const bodyY = elevated ? Math.max(.65, heightM - bodyHeight / 2) : bodyHeight / 2 + .08
  const compact = entry?.tags.includes('countertop') || mounting === 'counter'

  return <group>
    <BoxPart
      position={[0, bodyY, 0]}
      size={[Math.max(.06, widthM), bodyHeight, Math.max(.06, depthM)]}
      radius={Math.min(.04, bodyHeight / 4)}
    />
    {!elevated && !compact && [-1, 1].flatMap((x) => [-1, 1].map((z) => <TubularLeg
      key={`${x}-${z}`}
      x={x * Math.max(.02, widthM / 2 - .04)}
      z={z * Math.max(.02, depthM / 2 - .04)}
      height={Math.min(.16, heightM * .18)}
    />))}
    {entry?.tags.includes('mobile') && [-1, 1].flatMap((x) => [-1, 1].map((z) => <Foot
      key={`caster-${x}-${z}`}
      x={x * Math.max(.02, widthM / 2 - .04)}
      z={z * Math.max(.02, depthM / 2 - .04)}
    />))}
    <BoxPart
      position={[0, Math.min(heightM, bodyY + bodyHeight / 2 + .018), depthM / 2 + .012]}
      size={[Math.max(.05, widthM * .54), .025, .025]}
      material="darkSteel"
      radius={.005}
    />
  </group>
}
CatalogEquipmentVisual.displayName = 'CatalogEquipmentVisual'
