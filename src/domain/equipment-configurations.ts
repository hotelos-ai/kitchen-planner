import type {
  ClearanceSpec,
  EquipmentCategory,
  EquipmentItem,
  StationCapability,
} from './project'
import { getCatalogEntry } from './catalog/kitchen-catalog'

export type EquipmentConfigurationFamily =
  | 'refrigeration'
  | 'hot-line'
  | 'prep-landing'
  | 'washing'
  | 'ventilation'
  | 'catalog'

export type EquipmentConfiguration = {
  id: string
  family: EquipmentConfigurationFamily
  label: string
  description: string
  category: EquipmentCategory
  widthMm: number
  depthMm: number
  heightMm: number
  capabilities: StationCapability[]
  clearance: ClearanceSpec
  visualPreset: string
  notes?: string
}

const configuration = (
  id: string,
  family: EquipmentConfigurationFamily,
  label: string,
  category: EquipmentCategory,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  capabilities: StationCapability[],
  clearance: ClearanceSpec,
  visualPreset: string,
  description = label,
): EquipmentConfiguration => ({
  id,
  family,
  label,
  description,
  category,
  widthMm,
  depthMm,
  heightMm,
  capabilities,
  clearance,
  visualPreset,
})

export const EQUIPMENT_CONFIGURATIONS: readonly EquipmentConfiguration[] = [
  configuration('cold-upright-single', 'refrigeration', 'Upright single-door refrigerator', 'cold', 700, 800, 1950, ['cold-retrieval'], { kind: 'door-swing', frontMm: 900 }, 'upright-freezer'),
  configuration('cold-upright-double', 'refrigeration', 'Upright two-door refrigerator', 'cold', 1400, 850, 2000, ['cold-retrieval'], { kind: 'door-swing', frontMm: 1100 }, 'two-door-fridge'),
  configuration('cold-undercounter', 'refrigeration', 'Under-counter refrigerator', 'cold', 1200, 700, 850, ['cold-retrieval'], { kind: 'work', frontMm: 900 }, 'undercounter-fridge'),
  configuration('cold-prep-counter', 'refrigeration', 'Refrigerated prep counter', 'cold', 1200, 700, 850, ['cold-retrieval', 'food-prep'], { kind: 'work', frontMm: 900 }, 'prep-fridge'),
  configuration('cold-chest-freezer', 'refrigeration', 'Chest freezer', 'cold', 1200, 700, 850, ['cold-retrieval'], { kind: 'door-swing', frontMm: 700 }, 'chest-freezer'),
  configuration('hot-range-four', 'hot-line', '4-burner range', 'cooking', 800, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1000 }, 'four-burner-range'),
  configuration('hot-range-six', 'hot-line', '6-burner range', 'cooking', 1200, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1100 }, 'six-burner-range'),
  configuration('hot-range-oven', 'hot-line', 'Range with oven', 'cooking', 1200, 900, 900, ['range-cook'], { kind: 'heat', frontMm: 1100 }, 'range-oven'),
  configuration('hot-flat-top', 'hot-line', 'Flat-top griddle', 'cooking', 900, 700, 900, ['flat-top-cook'], { kind: 'heat', frontMm: 1000 }, 'flat-top'),
  configuration('hot-fryer-bank', 'hot-line', 'Twin fryer bank', 'cooking', 700, 700, 900, ['fryer-cook'], { kind: 'heat', frontMm: 1000 }, 'fryer-bank'),
  configuration('hot-flat-fryer', 'hot-line', 'Flat-top + fryer', 'cooking', 1200, 700, 900, ['flat-top-cook', 'fryer-cook'], { kind: 'heat', frontMm: 1000 }, 'flat-top-fryer'),
  configuration('hot-tandoor', 'hot-line', 'Tandoor', 'cooking', 700, 700, 900, ['tandoor-cook'], { kind: 'heat', frontMm: 1000 }, 'tandoor'),
  configuration('prep-open-table', 'prep-landing', 'Open worktable', 'prep', 700, 700, 850, ['food-prep', 'finish-plate'], { kind: 'work', frontMm: 800 }, 'open-table'),
  configuration('prep-enclosed-bench', 'prep-landing', 'Enclosed bench', 'prep', 1200, 700, 850, ['food-prep', 'finish-plate'], { kind: 'work', frontMm: 900 }, 'enclosed-bench'),
  configuration('prep-ingredient-counter', 'prep-landing', 'Ingredient prep counter', 'prep', 1200, 700, 850, ['food-prep'], { kind: 'work', frontMm: 900 }, 'ingredient-counter'),
  configuration('prep-mixer', 'prep-landing', 'Mixer stand', 'prep', 650, 650, 700, ['mix'], { kind: 'work', frontMm: 700 }, 'mixer'),
  configuration('landing-dirty', 'prep-landing', 'Dirty landing', 'landing', 900, 700, 850, ['dirty-landing'], { kind: 'work', frontMm: 800 }, 'landing-table'),
  configuration('landing-clean', 'prep-landing', 'Clean landing', 'landing', 700, 700, 850, ['clean-landing'], { kind: 'work', frontMm: 800 }, 'landing-table'),
  configuration('wash-hand', 'washing', 'Handwash basin', 'washing', 400, 400, 850, ['hand-wash'], { kind: 'work', frontMm: 600 }, 'handwash-sink'),
  configuration('wash-single', 'washing', 'Single sink', 'washing', 700, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 800 }, 'single-sink'),
  configuration('wash-double', 'washing', 'Double sink', 'washing', 1200, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 900 }, 'double-sink'),
  configuration('wash-pre-rinse', 'washing', 'Pre-rinse sink', 'washing', 700, 700, 850, ['dish-pre-rinse'], { kind: 'work', frontMm: 800 }, 'pre-rinse-sink'),
  configuration('wash-undercounter-dishwasher', 'washing', 'Under-counter dishwasher', 'washing', 700, 750, 850, ['dish-wash'], { kind: 'work', frontMm: 900 }, 'dishwasher'),
  configuration('wash-pass-through-dishwasher', 'washing', 'Pass-through dishwasher', 'washing', 750, 800, 1500, ['dish-wash'], { kind: 'work', frontMm: 1000 }, 'pass-through-dishwasher'),
  configuration('hood-wall-canopy', 'ventilation', 'Wall canopy hood', 'hood', 3500, 1100, 600, [], { kind: 'service', frontMm: 0 }, 'canopy-hood'),
  configuration('hood-island-canopy', 'ventilation', 'Island canopy hood', 'hood', 3500, 1600, 600, [], { kind: 'service', frontMm: 0 }, 'island-hood'),
]

const CONFIGURATION_BY_ID = new Map(EQUIPMENT_CONFIGURATIONS.map((value) => [value.id, value]))

const FAMILY_BY_CATEGORY: Partial<Record<EquipmentCategory, EquipmentConfigurationFamily>> = {
  cold: 'refrigeration',
  cooking: 'hot-line',
  prep: 'prep-landing',
  landing: 'prep-landing',
  washing: 'washing',
  hood: 'ventilation',
}

export const CONFIGURATION_BY_SEED_ID: Record<string, string> = {
  'flat-top-fryer': 'hot-flat-fryer',
  'six-burner': 'hot-range-six',
  tandoor: 'hot-tandoor',
  'upright-freezer': 'cold-upright-single',
  'fridge-clean-prep': 'cold-prep-counter',
  'prep-fridge-counter': 'cold-prep-counter',
  mixer: 'prep-mixer',
  'working-table': 'prep-open-table',
  'double-sink': 'wash-double',
  'two-door-fridge': 'cold-upright-double',
  'dirty-landing': 'landing-dirty',
  'pre-rinse-sink': 'wash-pre-rinse',
  dishwasher: 'wash-undercounter-dishwasher',
  'clean-landing': 'landing-clean',
  handwash: 'wash-hand',
  'hot-line-hood': 'hood-wall-canopy',
}

const sameCapabilities = (left: readonly StationCapability[], right: readonly StationCapability[]) => {
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((value, index) => value === sortedRight[index])
}

const sameClearance = (left: ClearanceSpec | undefined, right: ClearanceSpec) =>
  Boolean(left)
  && left?.kind === right.kind
  && left.frontMm === right.frontMm
  && left.leftMm === right.leftMm
  && left.rightMm === right.rightMm
  && left.backMm === right.backMm

const cloneConfiguration = (value: EquipmentConfiguration): EquipmentConfiguration => structuredClone(value)

const titleCaseId = (value: string) => value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')

function catalogConfigurations(item: EquipmentItem): EquipmentConfiguration[] {
  const entry = item.catalogId ? getCatalogEntry(item.catalogId) : undefined
  if (!entry) return []
  return entry.configurationIds.map((id, index) => {
    const denominator = Math.max(1, entry.configurationIds.length - 1)
    const ratio = index === 0 ? 0 : index / denominator
    const dimension = (axis: 'widthMm' | 'depthMm' | 'heightMm') => Math.round(
      (entry.typicalDimensions[axis] + (entry.maximumDimensions[axis] - entry.typicalDimensions[axis]) * ratio) / 10,
    ) * 10
    return {
      id,
      family: 'catalog',
      label: `${entry.displayName} · ${titleCaseId(id)}`,
      description: `${titleCaseId(id)} physical configuration for ${entry.displayName}.`,
      category: item.category,
      widthMm: dimension('widthMm'),
      depthMm: dimension('depthMm'),
      heightMm: dimension('heightMm'),
      capabilities: [...item.capabilities],
      clearance: structuredClone(item.clearance ?? { kind: 'work', frontMm: entry.clearance.frontMm }),
      visualPreset: entry.constructorKey,
    }
  })
}

export function inferEquipmentConfiguration(item: EquipmentItem): string | undefined {
  if (item.catalogId) {
    const catalogIds = catalogConfigurations(item).map((configuration) => configuration.id)
    if (item.configurationPreset && catalogIds.includes(item.configurationPreset)) return item.configurationPreset
  }
  if (item.configurationPreset && CONFIGURATION_BY_ID.has(item.configurationPreset)) return item.configurationPreset
  const seeded = CONFIGURATION_BY_SEED_ID[item.id]
  if (seeded) return seeded

  if (item.visualPreset) {
    const visualMatches = EQUIPMENT_CONFIGURATIONS.filter((value) => value.visualPreset === item.visualPreset)
    if (visualMatches.length === 1) return visualMatches[0].id
  }

  const family = FAMILY_BY_CATEGORY[item.category]
  if (!family || item.capabilities.length === 0) return undefined
  const capabilityMatches = EQUIPMENT_CONFIGURATIONS.filter((value) =>
    value.family === family && sameCapabilities(value.capabilities, item.capabilities),
  )
  return capabilityMatches.length === 1 ? capabilityMatches[0].id : undefined
}

export function listCompatibleConfigurations(item: EquipmentItem): EquipmentConfiguration[] {
  const catalogOwned = catalogConfigurations(item)
  if (catalogOwned.length) return catalogOwned.map(cloneConfiguration)
  if (item.category === 'custom') return EQUIPMENT_CONFIGURATIONS.map(cloneConfiguration)
  const selected = item.configurationPreset ? CONFIGURATION_BY_ID.get(item.configurationPreset) : undefined
  const family = selected?.family ?? FAMILY_BY_CATEGORY[item.category]
  if (!family) return []
  return EQUIPMENT_CONFIGURATIONS.filter((value) => value.family === family).map(cloneConfiguration)
}

export function applyEquipmentConfiguration(item: EquipmentItem, configurationId: string): EquipmentItem {
  const selected = CONFIGURATION_BY_ID.get(configurationId)
    ?? catalogConfigurations(item).find((configuration) => configuration.id === configurationId)
  if (!selected) throw new Error(`Unknown equipment configuration: ${configurationId}`)
  const compatible = item.catalogId
    ? catalogConfigurations(item).some((value) => value.id === configurationId)
    : item.category === 'custom'
    || listCompatibleConfigurations(item).some((value) => value.id === configurationId)
  if (!compatible) throw new Error(`Equipment configuration ${configurationId} is not compatible with ${item.category}`)
  return {
    ...item,
    label: item.catalogId ? item.label : selected.label,
    category: selected.category,
    widthMm: selected.widthMm,
    depthMm: selected.depthMm,
    heightMm: selected.heightMm,
    capabilities: [...selected.capabilities],
    clearance: structuredClone(selected.clearance),
    visualPreset: selected.visualPreset,
    configurationPreset: selected.id,
    dimensionsLocked: false,
  }
}

export function isEquipmentConfigurationModified(item: EquipmentItem): boolean {
  if (!item.configurationPreset) return false
  const selected = CONFIGURATION_BY_ID.get(item.configurationPreset)
    ?? catalogConfigurations(item).find((configuration) => configuration.id === item.configurationPreset)
  if (!selected) return false
  return item.label !== selected.label
    || item.category !== selected.category
    || item.widthMm !== selected.widthMm
    || item.depthMm !== selected.depthMm
    || item.heightMm !== selected.heightMm
    || item.visualPreset !== selected.visualPreset
    || !sameCapabilities(item.capabilities, selected.capabilities)
    || !sameClearance(item.clearance, selected.clearance)
}
