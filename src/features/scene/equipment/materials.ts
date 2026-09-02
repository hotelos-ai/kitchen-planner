export type KitchenMaterialName =
  | 'brushedSteel'
  | 'darkSteel'
  | 'castIron'
  | 'blackEnamel'
  | 'rubber'
  | 'glass'
  | 'ceramic'
  | 'copper'
  | 'whiteUniform'

export type KitchenMaterialDescriptor = {
  color: string
  metalness: number
  roughness: number
  clearcoat?: number
  clearcoatRoughness?: number
  transmission?: number
  transparent?: boolean
  opacity?: number
}

export const KITCHEN_MATERIALS: Record<KitchenMaterialName, KitchenMaterialDescriptor> = {
  brushedSteel: {
    color: '#cbd3d1',
    metalness: .88,
    roughness: .24,
    clearcoat: .1,
    clearcoatRoughness: .28,
  },
  darkSteel: { color: '#59635f', metalness: .72, roughness: .32 },
  castIron: { color: '#202522', metalness: .5, roughness: .58 },
  blackEnamel: {
    color: '#171b19',
    metalness: .18,
    roughness: .22,
    clearcoat: .72,
    clearcoatRoughness: .18,
  },
  rubber: { color: '#202321', metalness: 0, roughness: .86 },
  glass: {
    color: '#9fb8b4',
    metalness: 0,
    roughness: .08,
    transmission: .72,
    transparent: true,
    opacity: .42,
  },
  ceramic: {
    color: '#e8e5dc',
    metalness: 0,
    roughness: .3,
    clearcoat: .4,
    clearcoatRoughness: .2,
  },
  copper: { color: '#9d5e3f', metalness: .76, roughness: .3 },
  whiteUniform: { color: '#f6f3ea', metalness: 0, roughness: .7 },
}

export function resolveKitchenMaterial(
  material: KitchenMaterialName,
  overrides: Partial<KitchenMaterialDescriptor> = {},
): KitchenMaterialDescriptor {
  const resolved = { ...KITCHEN_MATERIALS[material] }
  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== undefined) Object.assign(resolved, { [key]: value })
  })
  return resolved
}

export function resolveAppearanceSkinMaterial(skinId: string | undefined): Partial<KitchenMaterialDescriptor> {
  const skin = APPEARANCE_SKINS.find((candidate) => candidate.skinId === skinId)
  return skin ? { color: skin.colorHex, metalness: skin.metalness, roughness: skin.roughness } : {}
}
import { APPEARANCE_SKINS } from '../../../domain/catalog/appearance-skins'
