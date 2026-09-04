import type { EquipmentCategory, EquipmentItem, StationCapability } from '../project'
import { STORAGE_CATALOG } from './storage-catalog'
import { accessFlowForConfiguration } from '../equipment-access'
import { createPhysicalConfigurationPresets, parseCatalogEntries, type CatalogCategory, type CatalogDimensions, type CatalogEntry } from './types'

type EntryOptions = {
  id: string
  familyId: string
  name: string
  category: CatalogCategory
  description: string
  synonyms: string[]
  dimensions: CatalogDimensions
  capabilities: string[]
  configurations?: string[]
  skins?: string[]
  workPositions?: number
  concurrentUnits?: number
  storageLitres?: number
  frontClearanceMm?: number
  clearanceKind?: 'work' | 'service' | 'heat' | 'door-swing' | 'maintenance' | 'storage' | 'none'
  approach?: 'front' | 'back' | 'left' | 'right' | 'either-side' | 'none'
  mounting?: 'floor' | 'wall' | 'overhead' | 'counter' | 'architectural'
  mountingHeightMm?: number
  requiresWall?: boolean
  requiresHood?: boolean
  utilities?: Array<'electricity' | 'gas' | 'water' | 'drainage' | 'ventilation' | 'compressed-air'>
  zones?: string[]
  tags: string[]
  constructorKey: string
}

const categoryZones: Record<CatalogCategory, string[]> = {
  'cooking-hot-line': ['hot-line', 'production'],
  'ovens-holding': ['hot-line', 'production', 'service'],
  'refrigeration-ice': ['cold-storage', 'prep', 'service'],
  preparation: ['prep', 'production'],
  'beverage-service': ['beverage', 'service'],
  'warewashing-sanitation': ['warewashing', 'sanitation'],
  'waste-janitorial': ['waste', 'janitorial'],
  'ventilation-utilities': ['utility', 'production'],
  architecture: ['architecture'],
  storage: ['storage'],
  custom: ['unassigned'],
}

const entry = (options: EntryOptions) => {
  const scale = (value: number, factor: number) => Math.max(50, Math.round(value * factor))
  const configurationIds = options.configurations ?? [`${options.id}-standard`]
  const maximumDimensions = {
    widthMm: scale(options.dimensions.widthMm, 2.2),
    depthMm: scale(options.dimensions.depthMm, 1.6),
    heightMm: scale(options.dimensions.heightMm, 1.5),
  }
  const capacity = { workPositions: options.workPositions ?? 1, concurrentUnits: options.concurrentUnits ?? 1, ...(options.storageLitres === undefined ? {} : { storageLitres: options.storageLitres }) }
  const clearance = { frontMm: options.frontClearanceMm ?? 900, leftMm: 100, rightMm: 100, backMm: 50, topMm: options.requiresHood ? 1200 : 100, kind: options.clearanceKind ?? 'work' as const }
  const mounting = options.mounting ?? 'floor'
  return {
    catalogId: options.id,
    familyId: options.familyId,
    displayName: options.name,
    category: options.category,
    description: options.description,
    synonyms: options.synonyms,
    typicalDimensions: options.dimensions,
    minimumDimensions: {
      widthMm: scale(options.dimensions.widthMm, 0.55),
      depthMm: scale(options.dimensions.depthMm, 0.65),
      heightMm: scale(options.dimensions.heightMm, 0.55),
    },
    maximumDimensions,
    capabilities: options.capabilities,
    capacity,
    clearance,
    intendedApproachFace: options.approach ?? 'front',
    placementRules: {
      mounting,
      requiresWall: options.requiresWall ?? false,
      requiresHood: options.requiresHood ?? false,
      utilityRequirements: options.utilities ?? [],
      allowedZones: options.zones ?? categoryZones[options.category],
      keepClearOfOpeningsMm: 600,
    },
    configurationIds,
    physicalConfigurations: createPhysicalConfigurationPresets({ configurationIds, displayName: options.name, typicalDimensions: options.dimensions, maximumDimensions, capabilities: options.capabilities, capacity, clearance, mounting, mountingHeightMm: options.mountingHeightMm, tags: options.tags }),
    appearanceSkinIds: options.skins ?? ['stainless-brushed', 'stainless-polished', 'powder-black'],
    footprint: { shape: 'rectangle', cornerRadiusMm: 12 },
    tags: options.tags,
    constructorKey: options.constructorKey,
  }
}

const rawKitchenEquipment = [
  entry({ id: 'hot-six-burner-range', familyId: 'range', name: 'Six-burner range', category: 'cooking-hot-line', description: 'Commercial open-burner range for sautéing, boiling, and pan work.', synonyms: ['cooker', 'stove', 'six ring'], dimensions: { widthMm: 1200, depthMm: 900, heightMm: 900 }, capabilities: ['range-cook'], configurations: ['range-six-burner-standard', 'range-six-burner-oven-base'], requiresHood: true, utilities: ['gas', 'ventilation'], tags: ['floor-mounted', 'hot-line', 'gas'], constructorKey: 'range-six-burner' }),
  entry({ id: 'hot-four-burner-range', familyId: 'range', name: 'Four-burner range', category: 'cooking-hot-line', description: 'Compact commercial open-burner range for pan and stock-pot cooking.', synonyms: ['four ring', 'compact range'], dimensions: { widthMm: 800, depthMm: 800, heightMm: 900 }, capabilities: ['range-cook'], requiresHood: true, utilities: ['gas', 'ventilation'], tags: ['floor-mounted', 'hot-line'], constructorKey: 'range-four-burner' }),
  entry({ id: 'hot-deep-fryer', familyId: 'fryer', name: 'Twin-basket deep fryer', category: 'cooking-hot-line', description: 'Floor fryer with two baskets for high-throughput fried production.', synonyms: ['chip fryer', 'basket fryer'], dimensions: { widthMm: 600, depthMm: 800, heightMm: 1100 }, capabilities: ['fryer-cook'], configurations: ['fryer-single-vat', 'fryer-twin-vat'], requiresHood: true, utilities: ['gas', 'ventilation'], clearanceKind: 'heat', tags: ['floor-mounted', 'hot-line', 'fryer'], constructorKey: 'fryer-twin-basket' }),
  entry({ id: 'hot-griddle', familyId: 'griddle', name: 'Flat-top griddle', category: 'cooking-hot-line', description: 'Smooth commercial griddle for plancha, breakfast, and à la minute cooking.', synonyms: ['plancha', 'flat top', 'hot plate'], dimensions: { widthMm: 900, depthMm: 750, heightMm: 900 }, capabilities: ['flat-top-cook'], configurations: ['griddle-smooth', 'griddle-half-ribbed'], requiresHood: true, utilities: ['gas', 'ventilation'], tags: ['floor-mounted', 'hot-line'], constructorKey: 'griddle-flat-top' }),
  entry({ id: 'hot-charbroiler', familyId: 'broiler', name: 'Charbroiler', category: 'cooking-hot-line', description: 'Open-grate charbroiler for high-heat grilling and marked finishes.', synonyms: ['char grill', 'lava grill', 'barbecue grill'], dimensions: { widthMm: 900, depthMm: 800, heightMm: 900 }, capabilities: ['flat-top-cook'], requiresHood: true, utilities: ['gas', 'ventilation'], clearanceKind: 'heat', tags: ['floor-mounted', 'hot-line', 'grill'], constructorKey: 'charbroiler-open-grate' }),
  entry({ id: 'hot-tandoor', familyId: 'tandoor', name: 'Commercial tandoor', category: 'cooking-hot-line', description: 'Insulated clay-lined commercial tandoor for breads and skewered cooking.', synonyms: ['clay oven', 'tandoori oven'], dimensions: { widthMm: 700, depthMm: 700, heightMm: 900 }, capabilities: ['tandoor-cook'], requiresHood: true, utilities: ['gas', 'ventilation'], clearanceKind: 'heat', tags: ['floor-mounted', 'hot-line', 'solid-fuel-review'], constructorKey: 'tandoor-round' }),
  entry({ id: 'hot-wok-range', familyId: 'wok-range', name: 'Two-ring wok range', category: 'cooking-hot-line', description: 'High-output water-cooled wok range with two cooking rings.', synonyms: ['wok burner', 'chinese range'], dimensions: { widthMm: 1400, depthMm: 900, heightMm: 850 }, capabilities: ['range-cook'], configurations: ['wok-range-one-ring', 'wok-range-two-ring'], requiresHood: true, utilities: ['gas', 'water', 'drainage', 'ventilation'], tags: ['floor-mounted', 'hot-line', 'wok'], constructorKey: 'wok-range' }),
  entry({ id: 'hot-induction-suite', familyId: 'induction', name: 'Four-zone induction suite', category: 'cooking-hot-line', description: 'Electric induction suite for responsive pan cooking with low ambient heat.', synonyms: ['induction hob', 'electric range'], dimensions: { widthMm: 800, depthMm: 800, heightMm: 900 }, capabilities: ['range-cook'], configurations: ['induction-two-zone', 'induction-four-zone'], utilities: ['electricity'], tags: ['floor-mounted', 'hot-line', 'electric'], constructorKey: 'induction-suite' }),
  entry({ id: 'hot-tilting-pan', familyId: 'bratt-pan', name: 'Tilting bratt pan', category: 'cooking-hot-line', description: 'Large tilting pan for braising, shallow frying, boiling, and batch sauces.', synonyms: ['bratt pan', 'tilting skillet'], dimensions: { widthMm: 1200, depthMm: 950, heightMm: 1050 }, capabilities: ['range-cook'], concurrentUnits: 30, requiresHood: true, utilities: ['gas', 'water', 'drainage', 'ventilation'], tags: ['floor-mounted', 'batch-cooking'], constructorKey: 'tilting-bratt-pan' }),
  entry({ id: 'hot-boiling-pan', familyId: 'kettle', name: 'Boiling pan', category: 'cooking-hot-line', description: 'Jacketed boiling kettle for soups, stocks, sauces, and batch liquids.', synonyms: ['steam kettle', 'soup kettle'], dimensions: { widthMm: 900, depthMm: 900, heightMm: 1200 }, capabilities: ['range-cook'], concurrentUnits: 40, requiresHood: true, utilities: ['electricity', 'water', 'drainage', 'ventilation'], tags: ['floor-mounted', 'batch-cooking'], constructorKey: 'boiling-kettle' }),

  entry({ id: 'oven-combi', familyId: 'combi-oven', name: 'Combi oven', category: 'ovens-holding', description: 'Programmable convection-steam oven for roasting, steaming, and regeneration.', synonyms: ['combination oven', 'combi steamer'], dimensions: { widthMm: 900, depthMm: 850, heightMm: 1100 }, capabilities: ['range-cook'], configurations: ['combi-six-tray', 'combi-ten-tray', 'combi-twenty-tray'], concurrentUnits: 10, utilities: ['electricity', 'water', 'drainage', 'ventilation'], tags: ['oven', 'programmable', 'steam'], constructorKey: 'oven-combi' }),
  entry({ id: 'oven-convection', familyId: 'convection-oven', name: 'Convection oven', category: 'ovens-holding', description: 'Fan-assisted commercial oven for even roasting and baking.', synonyms: ['fan oven', 'roasting oven'], dimensions: { widthMm: 900, depthMm: 900, heightMm: 1100 }, capabilities: ['range-cook'], concurrentUnits: 8, utilities: ['electricity'], tags: ['oven', 'baking'], constructorKey: 'oven-convection' }),
  entry({ id: 'oven-deck', familyId: 'deck-oven', name: 'Two-deck oven', category: 'ovens-holding', description: 'Independent stone-deck chambers for breads, pizza, or roasting.', synonyms: ['bakery oven', 'stone deck oven'], dimensions: { widthMm: 1200, depthMm: 1100, heightMm: 1500 }, capabilities: ['range-cook'], configurations: ['deck-oven-one', 'deck-oven-two', 'deck-oven-three'], concurrentUnits: 12, utilities: ['electricity', 'ventilation'], tags: ['oven', 'bakery', 'floor-mounted'], constructorKey: 'oven-deck' }),
  entry({ id: 'oven-pizza', familyId: 'pizza-oven', name: 'Pizza oven', category: 'ovens-holding', description: 'High-temperature hearth oven for pizza and flatbreads.', synonyms: ['hearth oven', 'stone oven'], dimensions: { widthMm: 1400, depthMm: 1300, heightMm: 1600 }, capabilities: ['range-cook'], concurrentUnits: 6, requiresHood: true, utilities: ['gas', 'ventilation'], tags: ['oven', 'pizza', 'high-temperature'], constructorKey: 'oven-pizza' }),
  entry({ id: 'oven-salamander', familyId: 'salamander', name: 'Salamander grill', category: 'ovens-holding', description: 'Overhead finishing grill for gratinating, browning, and toast.', synonyms: ['cheese melter', 'overfired broiler'], dimensions: { widthMm: 800, depthMm: 500, heightMm: 600 }, capabilities: ['finish-plate'], mounting: 'wall', requiresWall: true, requiresHood: true, utilities: ['electricity', 'ventilation'], tags: ['wall-mounted', 'finishing'], constructorKey: 'salamander-grill' }),
  entry({ id: 'oven-microwave', familyId: 'microwave', name: 'Commercial microwave', category: 'ovens-holding', description: 'Heavy-duty programmable microwave for rapid heating and regeneration.', synonyms: ['rapid oven', 'microwave oven'], dimensions: { widthMm: 520, depthMm: 650, heightMm: 400 }, capabilities: ['finish-plate'], mounting: 'counter', utilities: ['electricity'], tags: ['countertop', 'rapid-cook'], constructorKey: 'oven-microwave' }),
  entry({ id: 'holding-heated-cabinet', familyId: 'hot-holding', name: 'Heated holding cabinet', category: 'ovens-holding', description: 'Insulated mobile cabinet for maintaining plated or bulk food temperature.', synonyms: ['hot cupboard', 'warming cabinet'], dimensions: { widthMm: 750, depthMm: 850, heightMm: 1700 }, capabilities: ['finish-plate'], concurrentUnits: 20, utilities: ['electricity'], tags: ['mobile', 'hot-holding'], constructorKey: 'holding-heated-cabinet' }),
  entry({ id: 'holding-proofing-cabinet', familyId: 'proofing', name: 'Proofing cabinet', category: 'ovens-holding', description: 'Humidity-controlled cabinet for dough fermentation and bakery staging.', synonyms: ['prover', 'dough cabinet'], dimensions: { widthMm: 750, depthMm: 850, heightMm: 1900 }, capabilities: ['food-prep'], concurrentUnits: 20, utilities: ['electricity', 'water'], tags: ['mobile', 'bakery'], constructorKey: 'holding-proofing-cabinet' }),
  entry({ id: 'holding-bain-marie', familyId: 'bain-marie', name: 'Bain-marie hot well', category: 'ovens-holding', description: 'Wet or dry hot well for holding gastronorm pans at service.', synonyms: ['steam table', 'hot well'], dimensions: { widthMm: 1200, depthMm: 700, heightMm: 900 }, capabilities: ['finish-plate'], configurations: ['bain-marie-two-pan', 'bain-marie-four-pan'], concurrentUnits: 4, utilities: ['electricity', 'water', 'drainage'], tags: ['service', 'hot-holding'], constructorKey: 'holding-bain-marie' }),

  entry({ id: 'cold-upright-refrigerator', familyId: 'upright-cold', name: 'Upright refrigerator', category: 'refrigeration-ice', description: 'Reach-in upright refrigerator for chilled ingredient and product storage.', synonyms: ['reach-in fridge', 'upright fridge'], dimensions: { widthMm: 700, depthMm: 800, heightMm: 2000 }, capabilities: ['cold-retrieval'], configurations: ['upright-fridge-one-door', 'upright-fridge-two-door'], storageLitres: 650, utilities: ['electricity'], tags: ['floor-mounted', 'refrigerated'], constructorKey: 'cold-upright-fridge' }),
  entry({ id: 'cold-upright-freezer', familyId: 'upright-cold', name: 'Upright freezer', category: 'refrigeration-ice', description: 'Reach-in upright freezer for frozen ingredient and product storage.', synonyms: ['reach-in freezer', 'vertical freezer'], dimensions: { widthMm: 700, depthMm: 800, heightMm: 2000 }, capabilities: ['cold-retrieval'], storageLitres: 600, utilities: ['electricity'], tags: ['floor-mounted', 'frozen'], constructorKey: 'cold-upright-freezer' }),
  entry({ id: 'cold-undercounter-refrigerator', familyId: 'undercounter-cold', name: 'Undercounter refrigerator', category: 'refrigeration-ice', description: 'Low refrigerated cabinet positioned beneath a preparation surface.', synonyms: ['counter fridge', 'low fridge'], dimensions: { widthMm: 1200, depthMm: 700, heightMm: 850 }, capabilities: ['cold-retrieval'], configurations: ['undercounter-two-door', 'undercounter-three-door'], storageLitres: 300, utilities: ['electricity'], tags: ['undercounter', 'refrigerated'], constructorKey: 'cold-undercounter-fridge' }),
  entry({ id: 'cold-prep-counter', familyId: 'prep-cold', name: 'Refrigerated prep counter', category: 'refrigeration-ice', description: 'Refrigerated base with ingredient pans and preparation worktop.', synonyms: ['saladette', 'pizza prep fridge'], dimensions: { widthMm: 1500, depthMm: 750, heightMm: 1100 }, capabilities: ['cold-retrieval', 'food-prep'], workPositions: 2, storageLitres: 350, utilities: ['electricity'], tags: ['prep', 'refrigerated', 'counter'], constructorKey: 'cold-prep-counter' }),
  entry({ id: 'cold-walk-in-placeholder', familyId: 'walk-in-cold', name: 'Walk-in cold room', category: 'refrigeration-ice', description: 'Architectural placeholder for a walk-in refrigerator enclosure and door.', synonyms: ['cold room', 'walk-in fridge'], dimensions: { widthMm: 2400, depthMm: 2400, heightMm: 2400 }, capabilities: ['cold-retrieval'], workPositions: 2, storageLitres: 8000, utilities: ['electricity'], tags: ['architectural', 'walk-in', 'refrigerated'], constructorKey: 'cold-walk-in-room' }),
  entry({ id: 'cold-walk-in-freezer-placeholder', familyId: 'walk-in-cold', name: 'Walk-in freezer', category: 'refrigeration-ice', description: 'Architectural placeholder for a walk-in frozen store enclosure and door.', synonyms: ['freezer room', 'walk-in frozen store'], dimensions: { widthMm: 2400, depthMm: 2400, heightMm: 2400 }, capabilities: ['cold-retrieval'], workPositions: 2, storageLitres: 7500, utilities: ['electricity'], tags: ['architectural', 'walk-in', 'frozen'], constructorKey: 'cold-walk-in-freezer' }),
  entry({ id: 'cold-blast-chiller', familyId: 'blast-chiller', name: 'Blast chiller', category: 'refrigeration-ice', description: 'Rapid pull-down cabinet for controlled chilling of cooked food.', synonyms: ['shock chiller', 'rapid chiller'], dimensions: { widthMm: 800, depthMm: 850, heightMm: 1700 }, capabilities: ['cold-retrieval'], concurrentUnits: 10, utilities: ['electricity', 'drainage'], tags: ['floor-mounted', 'rapid-chill'], constructorKey: 'cold-blast-chiller' }),
  entry({ id: 'cold-chest-freezer', familyId: 'chest-cold', name: 'Chest freezer', category: 'refrigeration-ice', description: 'Top-opening frozen storage cabinet for bulk products.', synonyms: ['deep freezer', 'box freezer'], dimensions: { widthMm: 1200, depthMm: 700, heightMm: 850 }, capabilities: ['cold-retrieval'], storageLitres: 400, utilities: ['electricity'], tags: ['floor-mounted', 'frozen'], constructorKey: 'cold-chest-freezer' }),
  entry({ id: 'ice-maker', familyId: 'ice-system', name: 'Commercial ice maker', category: 'refrigeration-ice', description: 'Self-contained machine for producing cubed service ice.', synonyms: ['ice machine', 'cube ice maker'], dimensions: { widthMm: 700, depthMm: 700, heightMm: 1700 }, capabilities: ['cold-retrieval'], concurrentUnits: 50, utilities: ['electricity', 'water', 'drainage'], tags: ['ice', 'floor-mounted'], constructorKey: 'cold-ice-maker' }),
  entry({ id: 'ice-bin', familyId: 'ice-system', name: 'Insulated ice bin', category: 'refrigeration-ice', description: 'Insulated service bin for holding and scooping ice.', synonyms: ['ice well', 'ice storage'], dimensions: { widthMm: 800, depthMm: 600, heightMm: 850 }, capabilities: ['cold-retrieval'], storageLitres: 180, utilities: ['drainage'], tags: ['ice', 'service'], constructorKey: 'cold-ice-bin' }),

  entry({ id: 'prep-work-table', familyId: 'work-table', name: 'Stainless work table', category: 'preparation', description: 'General-purpose stainless preparation table with open base.', synonyms: ['prep bench', 'work bench', 'stainless table'], dimensions: { widthMm: 1500, depthMm: 700, heightMm: 850 }, capabilities: ['food-prep', 'finish-plate'], configurations: ['work-table-open-base', 'work-table-undershelf', 'work-table-drawers'], workPositions: 2, tags: ['floor-mounted', 'prep', 'worktop'], constructorKey: 'prep-work-table' }),
  entry({ id: 'prep-chef-table', familyId: 'work-table', name: 'Chef preparation table', category: 'preparation', description: 'Chef table with drawers, undershelf, and raised splashback.', synonyms: ['chef bench', 'mise en place table'], dimensions: { widthMm: 1800, depthMm: 800, heightMm: 900 }, capabilities: ['food-prep', 'finish-plate'], workPositions: 2, tags: ['floor-mounted', 'prep', 'storage-base'], constructorKey: 'prep-chef-table' }),
  entry({ id: 'prep-sink-table', familyId: 'prep-sink', name: 'Preparation sink table', category: 'preparation', description: 'Single-bowl food preparation sink integrated into a work table.', synonyms: ['veg sink', 'food prep sink'], dimensions: { widthMm: 1200, depthMm: 700, heightMm: 900 }, capabilities: ['food-prep'], workPositions: 1, utilities: ['water', 'drainage'], tags: ['floor-mounted', 'prep', 'sink'], constructorKey: 'prep-sink-table' }),
  entry({ id: 'prep-planetary-mixer', familyId: 'mixer', name: 'Planetary mixer', category: 'preparation', description: 'Bench or floor mixer for doughs, batters, creams, and fillings.', synonyms: ['stand mixer', 'dough mixer'], dimensions: { widthMm: 650, depthMm: 750, heightMm: 1200 }, capabilities: ['mix'], configurations: ['mixer-twenty-litre', 'mixer-forty-litre', 'mixer-sixty-litre'], concurrentUnits: 1, utilities: ['electricity'], tags: ['prep', 'mixing'], constructorKey: 'prep-planetary-mixer' }),
  entry({ id: 'prep-spiral-mixer', familyId: 'mixer', name: 'Spiral dough mixer', category: 'preparation', description: 'High-torque spiral mixer for bread and pizza dough production.', synonyms: ['dough kneader', 'bakery mixer'], dimensions: { widthMm: 700, depthMm: 900, heightMm: 1300 }, capabilities: ['mix'], concurrentUnits: 1, utilities: ['electricity'], tags: ['prep', 'bakery', 'mixing'], constructorKey: 'prep-spiral-mixer' }),
  entry({ id: 'prep-food-processor', familyId: 'processor', name: 'Food processor', category: 'preparation', description: 'Commercial cutter-mixer for chopping, slicing, grating, and emulsifying.', synonyms: ['robot coupe', 'cutter mixer'], dimensions: { widthMm: 400, depthMm: 550, heightMm: 650 }, capabilities: ['food-prep'], mounting: 'counter', utilities: ['electricity'], tags: ['countertop', 'prep-machine'], constructorKey: 'prep-food-processor' }),
  entry({ id: 'prep-meat-slicer', familyId: 'slicer', name: 'Meat slicer', category: 'preparation', description: 'Commercial gravity-feed slicer for cooked meats, cheese, and produce.', synonyms: ['deli slicer', 'cold cut slicer'], dimensions: { widthMm: 600, depthMm: 750, heightMm: 600 }, capabilities: ['food-prep'], mounting: 'counter', utilities: ['electricity'], tags: ['countertop', 'prep-machine'], constructorKey: 'prep-meat-slicer' }),
  entry({ id: 'prep-vacuum-packer', familyId: 'vacuum-packer', name: 'Chamber vacuum packer', category: 'preparation', description: 'Chamber sealer for portioning, storage, and sous-vide preparation.', synonyms: ['vac pack', 'chamber sealer'], dimensions: { widthMm: 650, depthMm: 700, heightMm: 1000 }, capabilities: ['food-prep'], utilities: ['electricity'], tags: ['prep-machine', 'packaging'], constructorKey: 'prep-vacuum-packer' }),
  entry({ id: 'prep-scale', familyId: 'scale', name: 'Bench scale', category: 'preparation', description: 'Washable digital bench scale for portioning and recipe control.', synonyms: ['weighing scale', 'portion scale'], dimensions: { widthMm: 350, depthMm: 400, heightMm: 150 }, capabilities: ['food-prep'], mounting: 'counter', utilities: ['electricity'], tags: ['countertop', 'portioning'], constructorKey: 'prep-bench-scale' }),
  entry({ id: 'prep-mobile-table', familyId: 'work-table', name: 'Mobile prep table', category: 'preparation', description: 'Lockable-caster preparation table for flexible production layouts.', synonyms: ['rolling bench', 'mobile worktop'], dimensions: { widthMm: 1200, depthMm: 700, heightMm: 900 }, capabilities: ['food-prep', 'finish-plate'], workPositions: 2, tags: ['mobile', 'prep', 'worktop'], constructorKey: 'prep-mobile-table' }),

  entry({ id: 'service-espresso-machine', familyId: 'coffee', name: 'Two-group espresso machine', category: 'beverage-service', description: 'Commercial espresso machine for staffed coffee service.', synonyms: ['coffee machine', 'barista machine'], dimensions: { widthMm: 800, depthMm: 650, heightMm: 550 }, capabilities: ['beverage-service'], configurations: ['espresso-two-group', 'espresso-three-group'], mounting: 'counter', utilities: ['electricity', 'water', 'drainage'], tags: ['countertop', 'coffee', 'service'], constructorKey: 'service-espresso-machine' }),
  entry({ id: 'service-coffee-brewer', familyId: 'coffee', name: 'Batch coffee brewer', category: 'beverage-service', description: 'Filter coffee brewer with insulated servers for volume service.', synonyms: ['filter brewer', 'batch brewer'], dimensions: { widthMm: 500, depthMm: 600, heightMm: 800 }, capabilities: ['beverage-service'], mounting: 'counter', utilities: ['electricity', 'water'], tags: ['countertop', 'coffee'], constructorKey: 'service-coffee-brewer' }),
  entry({ id: 'service-tea-boiler', familyId: 'hot-beverage', name: 'Hot-water boiler', category: 'beverage-service', description: 'Counter-mounted hot-water dispenser for tea and beverage service.', synonyms: ['tea urn', 'water boiler'], dimensions: { widthMm: 400, depthMm: 500, heightMm: 700 }, capabilities: ['beverage-service'], mounting: 'counter', utilities: ['electricity', 'water'], tags: ['countertop', 'hot-beverage'], constructorKey: 'service-water-boiler' }),
  entry({ id: 'service-beverage-dispenser', familyId: 'cold-beverage', name: 'Cold beverage dispenser', category: 'beverage-service', description: 'Refrigerated multi-bowl dispenser for juices and prepared drinks.', synonyms: ['juice dispenser', 'drink machine'], dimensions: { widthMm: 650, depthMm: 500, heightMm: 750 }, capabilities: ['beverage-service'], mounting: 'counter', utilities: ['electricity'], tags: ['countertop', 'cold-beverage'], constructorKey: 'service-beverage-dispenser' }),
  entry({ id: 'service-bar-sink', familyId: 'service-sink', name: 'Bar sink station', category: 'beverage-service', description: 'Compact sink and drainboard for beverage preparation and glass rinsing.', synonyms: ['cocktail sink', 'glass wash sink'], dimensions: { widthMm: 1200, depthMm: 600, heightMm: 900 }, capabilities: ['beverage-service', 'dish-pre-rinse'], utilities: ['water', 'drainage'], tags: ['floor-mounted', 'bar', 'sink'], constructorKey: 'service-bar-sink' }),
  entry({ id: 'service-hot-pass', familyId: 'service-pass', name: 'Heated service pass', category: 'beverage-service', description: 'Plating and pickup counter with overhead heat lamps.', synonyms: ['hot pass', 'expedite counter', 'chef pass'], dimensions: { widthMm: 1800, depthMm: 800, heightMm: 1500 }, capabilities: ['finish-plate', 'clean-window'], configurations: ['hot-pass-lamp', 'hot-pass-heated-base'], workPositions: 2, utilities: ['electricity'], tags: ['service', 'pass', 'plating'], constructorKey: 'service-hot-pass' }),
  entry({ id: 'service-counter', familyId: 'service-counter', name: 'Service counter', category: 'beverage-service', description: 'Dry service and pickup counter for plated food, trays, or beverages.', synonyms: ['pickup counter', 'front counter'], dimensions: { widthMm: 1800, depthMm: 700, heightMm: 1000 }, capabilities: ['finish-plate'], skins: ['stainless-brushed', 'powder-black', 'wood-maple'], workPositions: 2, tags: ['service', 'counter'], constructorKey: 'service-counter' }),

  entry({ id: 'wash-three-compartment-sink', familyId: 'pot-sink', name: 'Three-compartment sink', category: 'warewashing-sanitation', description: 'Three-bowl sink for manual wash, rinse, and sanitize workflows.', synonyms: ['triple sink', 'pot wash sink'], dimensions: { widthMm: 2100, depthMm: 750, heightMm: 900 }, capabilities: ['dish-pre-rinse', 'dish-wash'], workPositions: 2, utilities: ['water', 'drainage'], tags: ['floor-mounted', 'warewashing', 'sink'], constructorKey: 'wash-three-compartment-sink' }),
  entry({ id: 'wash-pre-rinse-sink', familyId: 'pre-rinse', name: 'Pre-rinse sink', category: 'warewashing-sanitation', description: 'Soiled-dish pre-rinse station with spray arm and landing space.', synonyms: ['spray sink', 'scrap sink'], dimensions: { widthMm: 900, depthMm: 750, heightMm: 1400 }, capabilities: ['dish-pre-rinse'], utilities: ['water', 'drainage'], tags: ['floor-mounted', 'warewashing'], constructorKey: 'wash-pre-rinse-sink' }),
  entry({ id: 'wash-undercounter-dishwasher', familyId: 'dishwasher', name: 'Undercounter dishwasher', category: 'warewashing-sanitation', description: 'Compact commercial dishwasher for glasses and light dish loads.', synonyms: ['glasswasher', 'front-load dishwasher'], dimensions: { widthMm: 600, depthMm: 650, heightMm: 850 }, capabilities: ['dish-wash'], concurrentUnits: 1, utilities: ['electricity', 'water', 'drainage'], tags: ['undercounter', 'warewashing'], constructorKey: 'wash-undercounter-dishwasher' }),
  entry({ id: 'wash-hood-dishwasher', familyId: 'dishwasher', name: 'Pass-through hood dishwasher', category: 'warewashing-sanitation', description: 'Hood-type pass-through dishwasher for rack-based high-volume washing.', synonyms: ['pass-through dishwasher', 'hood machine'], dimensions: { widthMm: 750, depthMm: 850, heightMm: 1500 }, capabilities: ['dish-wash'], configurations: ['hood-dishwasher-straight', 'hood-dishwasher-corner'], concurrentUnits: 2, utilities: ['electricity', 'water', 'drainage', 'ventilation'], tags: ['floor-mounted', 'warewashing', 'high-volume'], constructorKey: 'wash-hood-dishwasher' }),
  entry({ id: 'wash-flight-dishwasher', familyId: 'dishwasher', name: 'Flight conveyor dishwasher', category: 'warewashing-sanitation', description: 'Continuous conveyor dishwashing system for institutional volumes.', synonyms: ['rack conveyor', 'flight machine'], dimensions: { widthMm: 3600, depthMm: 1000, heightMm: 1800 }, capabilities: ['dish-wash'], concurrentUnits: 12, utilities: ['electricity', 'water', 'drainage', 'ventilation'], tags: ['floor-mounted', 'warewashing', 'conveyor'], constructorKey: 'wash-flight-dishwasher' }),
  entry({ id: 'wash-dirty-landing', familyId: 'landing-table', name: 'Dirty landing table', category: 'warewashing-sanitation', description: 'Receiving and sorting table for incoming soiled dishes and trays.', synonyms: ['soil table', 'dirty dish table'], dimensions: { widthMm: 1200, depthMm: 750, heightMm: 900 }, capabilities: ['dirty-window', 'dirty-landing'], workPositions: 2, tags: ['warewashing', 'dirty-side', 'landing'], constructorKey: 'wash-dirty-landing' }),
  entry({ id: 'wash-clean-landing', familyId: 'landing-table', name: 'Clean landing table', category: 'warewashing-sanitation', description: 'Drainable table for clean rack landing and unloading.', synonyms: ['clean dish table', 'outfeed table'], dimensions: { widthMm: 1200, depthMm: 750, heightMm: 900 }, capabilities: ['clean-landing'], workPositions: 2, tags: ['warewashing', 'clean-side', 'landing'], constructorKey: 'wash-clean-landing' }),
  entry({ id: 'sanitation-hand-sink', familyId: 'hand-sink', name: 'Handwash sink', category: 'warewashing-sanitation', description: 'Dedicated compact handwashing basin with splashback.', synonyms: ['hand basin', 'handwash station'], dimensions: { widthMm: 450, depthMm: 400, heightMm: 850 }, capabilities: ['hand-wash'], mounting: 'wall', mountingHeightMm: 850, requiresWall: true, utilities: ['water', 'drainage'], tags: ['wall-mounted', 'sanitation', 'sink'], constructorKey: 'sanitation-hand-sink' }),
  entry({ id: 'sanitation-sterilizer', familyId: 'sterilizer', name: 'Knife sterilizer', category: 'warewashing-sanitation', description: 'Wall-mounted hot-water or UV cabinet for knife sanitation.', synonyms: ['knife sanitiser', 'utensil sterilizer'], dimensions: { widthMm: 500, depthMm: 200, heightMm: 700 }, capabilities: ['sanitation'], mounting: 'wall', requiresWall: true, utilities: ['electricity', 'water'], tags: ['wall-mounted', 'sanitation'], constructorKey: 'sanitation-knife-sterilizer' }),
  entry({ id: 'sanitation-chemical-dispenser', familyId: 'chemical-system', name: 'Chemical dosing station', category: 'warewashing-sanitation', description: 'Wall-mounted controlled dispenser for cleaning chemicals.', synonyms: ['soap dosing', 'chemical pump'], dimensions: { widthMm: 400, depthMm: 250, heightMm: 600 }, capabilities: ['sanitation'], mounting: 'wall', requiresWall: true, utilities: ['water'], tags: ['wall-mounted', 'chemical'], constructorKey: 'sanitation-chemical-dispenser' }),

  entry({ id: 'waste-mobile-bin', familyId: 'waste-bin', name: 'Mobile waste bin', category: 'waste-janitorial', description: 'Lidded wheeled bin for general kitchen waste collection.', synonyms: ['wheelie bin', 'trash bin', 'garbage can'], dimensions: { widthMm: 600, depthMm: 700, heightMm: 1000 }, capabilities: ['waste-collection'], concurrentUnits: 1, storageLitres: 240, clearanceKind: 'none', tags: ['mobile', 'waste', 'lidded'], constructorKey: 'waste-mobile-bin' }),
  entry({ id: 'waste-compost-bin', familyId: 'waste-bin', name: 'Food-waste bin', category: 'waste-janitorial', description: 'Lidded food-waste or compost bin for separated organics.', synonyms: ['compost bin', 'organic waste bin'], dimensions: { widthMm: 500, depthMm: 550, heightMm: 850 }, capabilities: ['waste-collection'], storageLitres: 120, clearanceKind: 'none', tags: ['mobile', 'waste', 'organic'], constructorKey: 'waste-compost-bin' }),
  entry({ id: 'waste-bin-station', familyId: 'waste-sort', name: 'Waste sorting station', category: 'waste-janitorial', description: 'Multi-stream station for landfill, recycling, and food waste.', synonyms: ['recycling station', 'bin bank'], dimensions: { widthMm: 1500, depthMm: 650, heightMm: 1000 }, capabilities: ['waste-collection'], concurrentUnits: 3, storageLitres: 360, clearanceKind: 'none', tags: ['waste', 'sorting', 'floor-mounted'], constructorKey: 'waste-sorting-station' }),
  entry({ id: 'janitorial-mop-sink', familyId: 'janitorial-sink', name: 'Mop sink', category: 'waste-janitorial', description: 'Low janitorial basin for filling and emptying mop buckets.', synonyms: ['slop sink', 'cleaners sink'], dimensions: { widthMm: 700, depthMm: 700, heightMm: 500 }, capabilities: ['janitorial'], utilities: ['water', 'drainage'], tags: ['floor-mounted', 'janitorial', 'sink'], constructorKey: 'janitorial-mop-sink' }),
  entry({ id: 'janitorial-chemical-cabinet', familyId: 'chemical-storage', name: 'Chemical cabinet', category: 'waste-janitorial', description: 'Lockable segregated cabinet for janitorial chemicals and supplies.', synonyms: ['cleaning cupboard', 'coshh cabinet'], dimensions: { widthMm: 900, depthMm: 500, heightMm: 1800 }, capabilities: ['secure-storage'], storageLitres: 600, tags: ['floor-mounted', 'janitorial', 'lockable'], constructorKey: 'janitorial-chemical-cabinet' }),
  entry({ id: 'waste-grease-interceptor-placeholder', familyId: 'grease-system', name: 'Grease interceptor placeholder', category: 'waste-janitorial', description: 'Reserved maintenance envelope for a grease interceptor requiring professional sizing.', synonyms: ['grease trap', 'fat interceptor'], dimensions: { widthMm: 1000, depthMm: 700, heightMm: 700 }, capabilities: ['waste-treatment'], workPositions: 0, utilities: ['drainage'], clearanceKind: 'maintenance', tags: ['utility', 'professional-review', 'grease'], constructorKey: 'waste-grease-interceptor' }),

  entry({ id: 'utility-canopy-hood', familyId: 'ventilation-hood', name: 'Canopy extraction hood', category: 'ventilation-utilities', description: 'Commercial canopy placeholder for capture and extraction above hot equipment.', synonyms: ['extract hood', 'kitchen canopy'], dimensions: { widthMm: 2400, depthMm: 1200, heightMm: 600 }, capabilities: ['ventilation'], workPositions: 0, mounting: 'overhead', utilities: ['electricity', 'ventilation'], approach: 'none', tags: ['overhead', 'ventilation', 'professional-review'], constructorKey: 'utility-canopy-hood' }),
  entry({ id: 'utility-condensate-hood', familyId: 'ventilation-hood', name: 'Condensate hood', category: 'ventilation-utilities', description: 'Condensate canopy placeholder above steam-producing equipment.', synonyms: ['steam hood', 'dishwasher hood'], dimensions: { widthMm: 1600, depthMm: 1100, heightMm: 500 }, capabilities: ['ventilation'], workPositions: 0, mounting: 'overhead', utilities: ['ventilation'], approach: 'none', tags: ['overhead', 'ventilation'], constructorKey: 'utility-condensate-hood' }),
  entry({ id: 'utility-makeup-air-placeholder', familyId: 'ventilation-air', name: 'Make-up air unit', category: 'ventilation-utilities', description: 'Reserved space for a professionally designed make-up air unit or terminal.', synonyms: ['supply air', 'replacement air'], dimensions: { widthMm: 1200, depthMm: 800, heightMm: 600 }, capabilities: ['ventilation'], workPositions: 0, mounting: 'overhead', utilities: ['electricity', 'ventilation'], approach: 'none', tags: ['overhead', 'professional-review'], constructorKey: 'utility-makeup-air' }),
  entry({ id: 'utility-gas-point', familyId: 'utility-point', name: 'Gas connection point', category: 'ventilation-utilities', description: 'Planning marker for a professionally installed gas connection.', synonyms: ['gas outlet', 'gas stub'], dimensions: { widthMm: 200, depthMm: 100, heightMm: 300 }, capabilities: ['gas-connection'], workPositions: 0, mounting: 'wall', requiresWall: true, utilities: ['gas'], approach: 'none', tags: ['wall-mounted', 'gas', 'professional-review'], constructorKey: 'utility-gas-point' }),
  entry({ id: 'utility-electrical-point', familyId: 'utility-point', name: 'Electrical connection point', category: 'ventilation-utilities', description: 'Planning marker for a dedicated electrical outlet or isolator.', synonyms: ['power outlet', 'isolator'], dimensions: { widthMm: 200, depthMm: 100, heightMm: 300 }, capabilities: ['electrical-connection'], workPositions: 0, mounting: 'wall', requiresWall: true, utilities: ['electricity'], approach: 'none', tags: ['wall-mounted', 'electricity', 'professional-review'], constructorKey: 'utility-electrical-point' }),
  entry({ id: 'utility-water-point', familyId: 'utility-point', name: 'Water connection point', category: 'ventilation-utilities', description: 'Planning marker for a potable water connection and isolation.', synonyms: ['water outlet', 'water stub'], dimensions: { widthMm: 200, depthMm: 100, heightMm: 300 }, capabilities: ['water-connection'], workPositions: 0, mounting: 'wall', requiresWall: true, utilities: ['water'], approach: 'none', tags: ['wall-mounted', 'water', 'professional-review'], constructorKey: 'utility-water-point' }),
  entry({ id: 'utility-drain-point', familyId: 'utility-point', name: 'Drain connection point', category: 'ventilation-utilities', description: 'Planning marker for a trapped waste or equipment drain connection.', synonyms: ['waste outlet', 'floor waste'], dimensions: { widthMm: 250, depthMm: 250, heightMm: 100 }, capabilities: ['drainage-connection'], workPositions: 0, mounting: 'architectural', utilities: ['drainage'], approach: 'none', tags: ['floor-mounted', 'drainage', 'professional-review'], constructorKey: 'utility-drain-point' }),
  entry({ id: 'utility-floor-drain', familyId: 'drainage', name: 'Floor drain', category: 'ventilation-utilities', description: 'Architectural floor-drain placeholder for washdown and equipment discharge.', synonyms: ['floor gully', 'trench drain'], dimensions: { widthMm: 300, depthMm: 300, heightMm: 100 }, capabilities: ['drainage-connection'], workPositions: 0, mounting: 'architectural', utilities: ['drainage'], approach: 'none', tags: ['architectural', 'drainage', 'professional-review'], constructorKey: 'utility-floor-drain' }),

  entry({ id: 'architecture-door', familyId: 'opening', name: 'Door opening', category: 'architecture', description: 'Configurable architectural door opening and swing envelope.', synonyms: ['entry door', 'staff door'], dimensions: { widthMm: 900, depthMm: 150, heightMm: 2100 }, capabilities: ['entry-flow'], configurations: ['door-single-swing', 'door-double-swing', 'door-sliding'], workPositions: 0, clearanceKind: 'door-swing', mounting: 'architectural', approach: 'none', tags: ['architectural', 'opening'], constructorKey: 'architecture-door' }),
  entry({ id: 'architecture-service-window', familyId: 'opening', name: 'Service window', category: 'architecture', description: 'Architectural service opening for clean pickup or dirty return flow.', synonyms: ['pass window', 'service hatch'], dimensions: { widthMm: 900, depthMm: 200, heightMm: 900 }, capabilities: ['clean-window', 'dirty-window'], configurations: ['window-clean-out', 'window-dirty-in'], workPositions: 1, mounting: 'architectural', approach: 'front', tags: ['architectural', 'opening', 'service'], constructorKey: 'architecture-service-window' }),
  entry({ id: 'architecture-pillar', familyId: 'structure', name: 'Structural pillar', category: 'architecture', description: 'Fixed structural obstruction represented in plan and navigation.', synonyms: ['column', 'post'], dimensions: { widthMm: 400, depthMm: 400, heightMm: 2800 }, capabilities: ['obstruction'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'fixed', 'obstruction'], constructorKey: 'architecture-pillar' }),
  entry({ id: 'architecture-partition', familyId: 'structure', name: 'Partition wall', category: 'architecture', description: 'Internal partition segment for room and zone definition.', synonyms: ['internal wall', 'divider'], dimensions: { widthMm: 2400, depthMm: 150, heightMm: 2800 }, capabilities: ['obstruction'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'fixed', 'wall'], constructorKey: 'architecture-partition' }),
  entry({ id: 'architecture-service-zone', familyId: 'zone', name: 'Service zone', category: 'architecture', description: 'Non-solid planning zone for service staging or circulation intent.', synonyms: ['staging zone', 'pickup zone'], dimensions: { widthMm: 1800, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 2, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone', 'non-solid'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-no-go-zone', familyId: 'zone', name: 'No-go zone', category: 'architecture', description: 'Explicit planning exclusion zone for safety, access, or services.', synonyms: ['keep clear zone', 'exclusion area'], dimensions: { widthMm: 1000, depthMm: 1000, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone', 'no-go'], constructorKey: 'architecture-no-go-zone' }),

  entry({ id: 'architecture-door-double', familyId: 'opening', name: 'Double door', category: 'architecture', description: 'Wide double-swing entrance for trolleys and deliveries.', synonyms: ['double swing door'], dimensions: { widthMm: 1800, depthMm: 150, heightMm: 2100 }, capabilities: ['entry-flow'], configurations: ['door-double-swing'], workPositions: 0, clearanceKind: 'door-swing', mounting: 'architectural', approach: 'none', tags: ['architectural', 'opening'], constructorKey: 'architecture-door' }),
  entry({ id: 'architecture-door-sliding', familyId: 'opening', name: 'Sliding door', category: 'architecture', description: 'Space-saving sliding entrance for tight corridors.', synonyms: ['pocket door'], dimensions: { widthMm: 1200, depthMm: 150, heightMm: 2100 }, capabilities: ['entry-flow'], configurations: ['door-sliding'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'opening'], constructorKey: 'architecture-door' }),
  entry({ id: 'architecture-staff-door', familyId: 'opening', name: 'Staff entrance door', category: 'architecture', description: 'Dedicated staff and receiving entrance.', synonyms: ['staff entry'], dimensions: { widthMm: 900, depthMm: 150, heightMm: 2100 }, capabilities: ['entry-flow'], workPositions: 0, clearanceKind: 'door-swing', mounting: 'architectural', approach: 'none', tags: ['architectural', 'opening'], constructorKey: 'architecture-door' }),
  entry({ id: 'architecture-window', familyId: 'opening', name: 'Regular window', category: 'architecture', description: 'A glazed wall opening for natural light, separate from clean and dirty service passes.', synonyms: ['natural light window', 'glazing', 'daylight window'], dimensions: { widthMm: 1200, depthMm: 150, heightMm: 1200 }, capabilities: [], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'opening', 'window', 'natural-light'], constructorKey: 'architecture-window' }),
  entry({ id: 'architecture-dirty-window', familyId: 'opening', name: 'Dirty return window', category: 'architecture', description: 'Return opening for dirty dishes and warewashing flow.', synonyms: ['dish return hatch'], dimensions: { widthMm: 900, depthMm: 200, heightMm: 900 }, capabilities: ['dirty-window'], workPositions: 1, clearanceKind: 'none', mounting: 'architectural', approach: 'front', tags: ['architectural', 'opening', 'service'], constructorKey: 'architecture-service-window' }),
  entry({ id: 'architecture-pass-hatch', familyId: 'opening', name: 'Pass-through hatch', category: 'architecture', description: 'Compact pass-through for plated food or trays.', synonyms: ['serving hatch'], dimensions: { widthMm: 600, depthMm: 200, heightMm: 900 }, capabilities: ['clean-window'], workPositions: 1, clearanceKind: 'none', mounting: 'architectural', approach: 'front', tags: ['architectural', 'opening', 'service'], constructorKey: 'architecture-service-window' }),
  entry({ id: 'architecture-column-round', familyId: 'structure', name: 'Round column', category: 'architecture', description: 'Circular structural column.', synonyms: ['round pillar', 'cylinder column'], dimensions: { widthMm: 500, depthMm: 500, heightMm: 2800 }, capabilities: ['obstruction'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'fixed', 'obstruction', 'round'], constructorKey: 'architecture-pillar' }),
  entry({ id: 'architecture-counter-divider', familyId: 'structure', name: 'Counter-height divider', category: 'architecture', description: 'Half-height divider separating work areas without blocking light.', synonyms: ['half wall', 'counter divider'], dimensions: { widthMm: 1800, depthMm: 900, heightMm: 1100 }, capabilities: ['obstruction'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'fixed', 'obstruction'], constructorKey: 'architecture-partition' }),
  entry({ id: 'architecture-soffit', familyId: 'structure', name: 'Soffit / duct marker', category: 'architecture', description: 'Reserved envelope for extraction ducting or structural soffit.', synonyms: ['duct zone', 'bulkhead'], dimensions: { widthMm: 1200, depthMm: 600, heightMm: 400 }, capabilities: ['obstruction'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'fixed', 'obstruction'], constructorKey: 'architecture-partition' }),
  entry({ id: 'architecture-prep-zone', familyId: 'zone', name: 'Prep zone', category: 'architecture', description: 'Food preparation work zone.', synonyms: ['preparation area'], dimensions: { widthMm: 1800, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 2, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-cooking-zone', familyId: 'zone', name: 'Cooking zone', category: 'architecture', description: 'Hot-line cooking zone with heat adjacency.', synonyms: ['hot line area'], dimensions: { widthMm: 2400, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 2, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-cold-prep-zone', familyId: 'zone', name: 'Cold prep zone', category: 'architecture', description: 'Chilled preparation and garnish zone.', synonyms: ['cold area'], dimensions: { widthMm: 1500, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 2, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-wash-zone', familyId: 'zone', name: 'Wash & sanitation zone', category: 'architecture', description: 'Warewashing and sanitation zone.', synonyms: ['dish area'], dimensions: { widthMm: 2100, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 2, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-dry-storage-zone', familyId: 'zone', name: 'Dry storage zone', category: 'architecture', description: 'Dry goods and consumables storage zone.', synonyms: ['storage area'], dimensions: { widthMm: 2400, depthMm: 1200, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-clean-corridor', familyId: 'zone', name: 'Clean corridor', category: 'architecture', description: 'Clean circulation route for food out.', synonyms: ['clean flow'], dimensions: { widthMm: 1200, depthMm: 6000, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'architecture-dirty-corridor', familyId: 'zone', name: 'Dirty corridor', category: 'architecture', description: 'Return circulation route for dirty ware.', synonyms: ['dirty flow'], dimensions: { widthMm: 1200, depthMm: 6000, heightMm: 100 }, capabilities: ['zone-marker'], workPositions: 0, clearanceKind: 'none', mounting: 'architectural', approach: 'none', tags: ['architectural', 'zone'], constructorKey: 'architecture-zone' }),
  entry({ id: 'custom-component', familyId: 'custom', name: 'Custom component', category: 'custom', description: 'Generic dimensioned component for uncommon equipment or planning placeholders.', synonyms: ['other equipment', 'generic box', 'custom item'], dimensions: { widthMm: 600, depthMm: 600, heightMm: 850 }, capabilities: [], configurations: ['custom-size'], skins: ['stainless-brushed', 'powder-black', 'powder-white', 'wood-maple'], workPositions: 0, tags: ['custom', 'escape-hatch'], constructorKey: 'custom-box' }),
]

export const KITCHEN_CATALOG = parseCatalogEntries([...rawKitchenEquipment, ...STORAGE_CATALOG])

export function getCatalogEntry(catalogId: string): CatalogEntry | undefined {
  return KITCHEN_CATALOG.find((entry) => entry.catalogId === catalogId)
}

export function searchCatalog(query: string, entries: readonly CatalogEntry[] = KITCHEN_CATALOG): readonly CatalogEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return Object.freeze([...entries])
  return Object.freeze(entries.filter((catalogEntry) => {
    const text = [catalogEntry.displayName, catalogEntry.description, catalogEntry.familyId, catalogEntry.category, ...catalogEntry.synonyms, ...catalogEntry.tags].join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  }))
}

export function filterCatalog(entries: readonly CatalogEntry[], filters: { category?: CatalogCategory; capability?: string }): readonly CatalogEntry[] {
  return Object.freeze(entries.filter((catalogEntry) =>
    (!filters.category || catalogEntry.category === filters.category)
    && (!filters.capability || catalogEntry.capabilities.includes(filters.capability)),
  ))
}

type CreateCatalogEquipmentInput = {
  catalogId: string
  componentId: string
  position: { xMm: number; yMm: number }
  dimensions?: Partial<CatalogDimensions>
  rotationDeg?: number
  configurationId?: string
  skinId?: string
}

const equipmentCategory = (catalogEntry: CatalogEntry): EquipmentCategory => {
  if (catalogEntry.category === 'cooking-hot-line' || catalogEntry.category === 'ovens-holding') return 'cooking'
  if (catalogEntry.category === 'refrigeration-ice') return 'cold'
  if (catalogEntry.category === 'preparation' || catalogEntry.category === 'beverage-service') return 'prep'
  if (catalogEntry.category === 'warewashing-sanitation') return catalogEntry.capabilities.some((capability) => capability.includes('landing') || capability.includes('window')) ? 'landing' : 'washing'
  if (catalogEntry.category === 'storage' || catalogEntry.category === 'waste-janitorial') return 'storage'
  if (catalogEntry.catalogId.includes('hood')) return 'hood'
  return 'custom'
}

const stationCapabilities = new Set<StationCapability>([
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
])

export function createCatalogEquipmentItem(input: CreateCatalogEquipmentInput): EquipmentItem {
  const catalogEntry = getCatalogEntry(input.catalogId)
  if (!catalogEntry) throw new Error(`Unknown catalog component: ${input.catalogId}`)
  const configurationId = input.configurationId ?? catalogEntry.configurationIds[0]
  if (!catalogEntry.configurationIds.includes(configurationId)) throw new Error(`Configuration ${configurationId} is not supported by ${catalogEntry.displayName}.`)
  const physicalConfiguration = catalogEntry.physicalConfigurations.find((preset) => preset.id === configurationId)
  if (!physicalConfiguration) throw new Error(`Physical configuration ${configurationId} is unavailable for ${catalogEntry.displayName}.`)
  const dimensions = { ...physicalConfiguration.dimensions, ...input.dimensions }
  ;(['widthMm', 'depthMm', 'heightMm'] as const).forEach((axis) => {
    if (dimensions[axis] < catalogEntry.minimumDimensions[axis] || dimensions[axis] > catalogEntry.maximumDimensions[axis]) {
      throw new Error(`${axis} is outside the supported range for ${catalogEntry.displayName}.`)
    }
  })
  const skinId = input.skinId ?? catalogEntry.appearanceSkinIds[0]
  if (!catalogEntry.appearanceSkinIds.includes(skinId)) throw new Error(`Skin ${skinId} is not supported by ${catalogEntry.displayName}.`)
  const clearanceKind = ['door-swing', 'heat', 'service'].includes(physicalConfiguration.clearance.kind)
    ? physicalConfiguration.clearance.kind as 'door-swing' | 'heat' | 'service'
    : 'work'
  return {
    id: input.componentId,
    catalogId: catalogEntry.catalogId,
    label: catalogEntry.displayName,
    category: equipmentCategory(catalogEntry),
    ...dimensions,
    xMm: input.position.xMm,
    yMm: input.position.yMm,
    rotationDeg: input.rotationDeg ?? 0,
    dimensionsLocked: false,
    movable: catalogEntry.category !== 'architecture',
    removable: true,
    capabilities: physicalConfiguration.capabilities.filter((capability): capability is StationCapability => stationCapabilities.has(capability as StationCapability)),
    clearance: { frontMm: physicalConfiguration.clearance.frontMm, leftMm: physicalConfiguration.clearance.leftMm, rightMm: physicalConfiguration.clearance.rightMm, backMm: physicalConfiguration.clearance.backMm, kind: clearanceKind },
    accessFlow: accessFlowForConfiguration(configurationId),
    visualPreset: catalogEntry.constructorKey,
    configurationPreset: configurationId,
    appearanceSkinId: skinId,
  }
}
