import { createPhysicalConfigurationPresets, parseCatalogEntries, type CatalogDimensions } from './types'

type StorageOptions = {
  id: string
  familyId: string
  name: string
  description: string
  synonyms: string[]
  dimensions: CatalogDimensions
  minimum: CatalogDimensions
  maximum: CatalogDimensions
  capabilities: string[]
  capacity: { workPositions: number; concurrentUnits: number; storageLitres?: number }
  mounting: 'floor' | 'wall' | 'overhead'
  mountingHeightMm?: number
  clearanceFrontMm: number
  configurationIds: string[]
  tags: string[]
  constructorKey: string
}

const storageEntry = (options: StorageOptions) => {
  const clearance = { frontMm: options.clearanceFrontMm, leftMm: 0, rightMm: 0, backMm: 0, topMm: 100, kind: 'storage' as const }
  return {
  catalogId: options.id,
  familyId: options.familyId,
  displayName: options.name,
  category: 'storage',
  description: options.description,
  synonyms: options.synonyms,
  typicalDimensions: options.dimensions,
  minimumDimensions: options.minimum,
  maximumDimensions: options.maximum,
  capabilities: options.capabilities,
  capacity: options.capacity,
  clearance,
  intendedApproachFace: options.mounting === 'overhead' ? 'none' : 'front',
  placementRules: {
    mounting: options.mounting,
    requiresWall: options.mounting === 'wall',
    requiresHood: false,
    utilityRequirements: [],
    allowedZones: ['storage', 'prep', 'service'],
    keepClearOfOpeningsMm: 600,
  },
  configurationIds: options.configurationIds,
  physicalConfigurations: createPhysicalConfigurationPresets({ configurationIds: options.configurationIds, displayName: options.name, typicalDimensions: options.dimensions, maximumDimensions: options.maximum, capabilities: options.capabilities, capacity: options.capacity, clearance, mounting: options.mounting, mountingHeightMm: options.mountingHeightMm, tags: options.tags }),
  appearanceSkinIds: ['stainless-brushed', 'powder-black', 'galvanized'],
  footprint: { shape: 'rectangle', cornerRadiusMm: 12 },
  tags: options.tags,
  constructorKey: options.constructorKey,
  }
}

const rawStorageCatalog = [
  storageEntry({ id: 'storage-wall-shelf', familyId: 'shelving-wall', name: 'Wall shelf', description: 'Elevated wall-mounted shelf for ingredients, utensils, or small equipment without blocking the floor.', synonyms: ['wall rack', 'floating shelf', 'ingredient shelf'], dimensions: { widthMm: 1200, depthMm: 350, heightMm: 300 }, minimum: { widthMm: 600, depthMm: 250, heightMm: 150 }, maximum: { widthMm: 2400, depthMm: 500, heightMm: 900 }, capabilities: ['elevated-storage'], capacity: { workPositions: 0, concurrentUnits: 12, storageLitres: 180 }, mounting: 'wall', clearanceFrontMm: 500, configurationIds: ['wall-shelf-one-tier', 'wall-shelf-two-tier', 'wall-shelf-three-tier'], tags: ['wall-mounted', 'elevated', 'shelving'], constructorKey: 'storage-wall-shelf' }),
  storageEntry({ id: 'storage-overshelf', familyId: 'shelving-overshelf', name: 'Table overshelf', description: 'One- or two-tier overshelf mounted above a preparation or service table.', synonyms: ['overshelf', 'table shelf', 'chef shelf'], dimensions: { widthMm: 1200, depthMm: 350, heightMm: 700 }, minimum: { widthMm: 600, depthMm: 250, heightMm: 450 }, maximum: { widthMm: 2400, depthMm: 450, heightMm: 1200 }, capabilities: ['elevated-storage', 'pass-storage'], capacity: { workPositions: 0, concurrentUnits: 16, storageLitres: 150 }, mounting: 'overhead', mountingHeightMm: 1_450, clearanceFrontMm: 0, configurationIds: ['overshelf-one-tier', 'overshelf-two-tier'], tags: ['overhead', 'elevated', 'table-mounted'], constructorKey: 'storage-overshelf' }),
  storageEntry({ id: 'storage-freestanding-shelving', familyId: 'shelving-floor', name: 'Industrial stainless-steel shelving', description: 'Typical commercial-kitchen stainless-steel rack with adjustable multi-tier shelves for dry goods, utensils, and smallwares.', synonyms: ['industrial ss shelf', 'stainless steel rack', 'kitchen storage rack', 'wire shelving', 'dry store shelf', 'shelf unit'], dimensions: { widthMm: 1200, depthMm: 500, heightMm: 1800 }, minimum: { widthMm: 600, depthMm: 350, heightMm: 900 }, maximum: { widthMm: 2400, depthMm: 700, heightMm: 2800 }, capabilities: ['dry-storage'], capacity: { workPositions: 0, concurrentUnits: 40, storageLitres: 900 }, mounting: 'floor', clearanceFrontMm: 800, configurationIds: ['shelving-four-tier', 'shelving-five-tier', 'shelving-six-tier'], tags: ['floor-mounted', 'shelving', 'adjustable', 'stainless-steel'], constructorKey: 'storage-freestanding-shelf' }),
  storageEntry({ id: 'storage-mobile-rack', familyId: 'rack-mobile', name: 'Mobile utility rack', description: 'Lockable-caster rack for mobile staging, transport, or flexible storage.', synonyms: ['rolling rack', 'mobile shelf', 'utility cart'], dimensions: { widthMm: 900, depthMm: 600, heightMm: 1700 }, minimum: { widthMm: 500, depthMm: 400, heightMm: 900 }, maximum: { widthMm: 1600, depthMm: 800, heightMm: 2100 }, capabilities: ['mobile-storage', 'staging'], capacity: { workPositions: 0, concurrentUnits: 24, storageLitres: 500 }, mounting: 'floor', clearanceFrontMm: 800, configurationIds: ['mobile-rack-four-tier', 'mobile-rack-six-tier'], tags: ['mobile', 'shelving', 'caster'], constructorKey: 'storage-mobile-rack' }),
  storageEntry({ id: 'storage-dunnage-rack', familyId: 'rack-dunnage', name: 'Dunnage rack', description: 'Low raised rack that keeps bulk goods and cartons clear of the floor.', synonyms: ['floor rack', 'low storage rack', 'pallet rack'], dimensions: { widthMm: 1200, depthMm: 500, heightMm: 300 }, minimum: { widthMm: 600, depthMm: 350, heightMm: 200 }, maximum: { widthMm: 2400, depthMm: 800, heightMm: 500 }, capabilities: ['bulk-storage'], capacity: { workPositions: 0, concurrentUnits: 10, storageLitres: 600 }, mounting: 'floor', clearanceFrontMm: 700, configurationIds: ['dunnage-standard', 'dunnage-heavy-duty'], tags: ['floor-mounted', 'low-level', 'bulk-storage'], constructorKey: 'storage-dunnage-rack' }),
  storageEntry({ id: 'storage-ingredient-bins', familyId: 'ingredient-storage', name: 'Ingredient bin station', description: 'Lidded food-safe bins for flour, rice, grains, and other bulk ingredients.', synonyms: ['flour bins', 'rice bins', 'bulk bins'], dimensions: { widthMm: 900, depthMm: 600, heightMm: 700 }, minimum: { widthMm: 450, depthMm: 400, heightMm: 500 }, maximum: { widthMm: 1800, depthMm: 800, heightMm: 1000 }, capabilities: ['ingredient-storage'], capacity: { workPositions: 1, concurrentUnits: 6, storageLitres: 360 }, mounting: 'floor', clearanceFrontMm: 700, configurationIds: ['ingredient-bin-two', 'ingredient-bin-four', 'ingredient-bin-six'], tags: ['floor-mounted', 'food-safe', 'ingredient-storage'], constructorKey: 'storage-ingredient-bins' }),
  storageEntry({ id: 'storage-pot-rack', familyId: 'rack-pot', name: 'Pot and pan rack', description: 'Heavy-duty rack sized for stock pots, pans, and bulky cookware.', synonyms: ['cookware rack', 'pan rack', 'pot shelf'], dimensions: { widthMm: 1200, depthMm: 600, heightMm: 1800 }, minimum: { widthMm: 700, depthMm: 450, heightMm: 1200 }, maximum: { widthMm: 2400, depthMm: 800, heightMm: 2400 }, capabilities: ['pot-storage'], capacity: { workPositions: 0, concurrentUnits: 24, storageLitres: 800 }, mounting: 'floor', clearanceFrontMm: 900, configurationIds: ['pot-rack-four-tier', 'pot-rack-five-tier'], tags: ['floor-mounted', 'heavy-duty', 'pot-storage'], constructorKey: 'storage-pot-rack' }),
  storageEntry({ id: 'storage-dish-rack', familyId: 'rack-dish', name: 'Dish rack', description: 'Open rack for clean plates, bowls, and crockery near warewashing or service.', synonyms: ['plate rack', 'crockery rack', 'clean dish shelf'], dimensions: { widthMm: 1000, depthMm: 500, heightMm: 1700 }, minimum: { widthMm: 500, depthMm: 350, heightMm: 900 }, maximum: { widthMm: 2000, depthMm: 700, heightMm: 2200 }, capabilities: ['clean-dish-storage'], capacity: { workPositions: 0, concurrentUnits: 120, storageLitres: 450 }, mounting: 'floor', clearanceFrontMm: 800, configurationIds: ['dish-rack-open', 'dish-rack-slotted'], tags: ['floor-mounted', 'warewashing', 'dish-storage'], constructorKey: 'storage-dish-rack' }),
  storageEntry({ id: 'storage-tray-rack', familyId: 'rack-tray', name: 'Tray rack', description: 'Slotted rack for service trays, gastronorm pans, or baking sheets.', synonyms: ['sheet pan rack', 'speed rack', 'gn pan rack'], dimensions: { widthMm: 700, depthMm: 600, heightMm: 1700 }, minimum: { widthMm: 450, depthMm: 450, heightMm: 900 }, maximum: { widthMm: 1000, depthMm: 800, heightMm: 2100 }, capabilities: ['tray-storage'], capacity: { workPositions: 0, concurrentUnits: 20, storageLitres: 280 }, mounting: 'floor', clearanceFrontMm: 800, configurationIds: ['tray-rack-ten-level', 'tray-rack-twenty-level'], tags: ['floor-mounted', 'tray-storage', 'slotted'], constructorKey: 'storage-tray-rack' }),
  storageEntry({ id: 'storage-overhead-rack', familyId: 'rack-overhead', name: 'Overhead hanging rack', description: 'Ceiling- or frame-suspended storage for pots, utensils, or lightweight containers.', synonyms: ['ceiling rack', 'hanging pot rack', 'overhead storage'], dimensions: { widthMm: 1200, depthMm: 600, heightMm: 500 }, minimum: { widthMm: 600, depthMm: 350, heightMm: 250 }, maximum: { widthMm: 2400, depthMm: 900, heightMm: 900 }, capabilities: ['overhead-storage'], capacity: { workPositions: 0, concurrentUnits: 18, storageLitres: 220 }, mounting: 'overhead', clearanceFrontMm: 0, configurationIds: ['overhead-rack-grid', 'overhead-rack-rail'], tags: ['overhead', 'ceiling-mounted', 'elevated'], constructorKey: 'storage-overhead-rack' }),
  storageEntry({ id: 'storage-glass-rack', familyId: 'rack-glass', name: 'Glass rack', description: 'Compartment rack for clean glasses and cups in beverage or service areas.', synonyms: ['cup rack', 'glassware rack', 'glass basket'], dimensions: { widthMm: 600, depthMm: 500, heightMm: 900 }, minimum: { widthMm: 400, depthMm: 350, heightMm: 500 }, maximum: { widthMm: 1200, depthMm: 700, heightMm: 1800 }, capabilities: ['glass-storage'], capacity: { workPositions: 0, concurrentUnits: 80, storageLitres: 180 }, mounting: 'floor', clearanceFrontMm: 700, configurationIds: ['glass-rack-open', 'glass-rack-compartment'], tags: ['service', 'glass-storage', 'shelving'], constructorKey: 'storage-glass-rack' }),
  storageEntry({ id: 'storage-locker', familyId: 'storage-secure', name: 'Secure storage locker', description: 'Lockable cabinet for chemicals, knives, personal items, or controlled stock.', synonyms: ['lockable cabinet', 'secure cupboard', 'staff locker'], dimensions: { widthMm: 900, depthMm: 500, heightMm: 1800 }, minimum: { widthMm: 400, depthMm: 350, heightMm: 900 }, maximum: { widthMm: 1800, depthMm: 700, heightMm: 2200 }, capabilities: ['secure-storage'], capacity: { workPositions: 0, concurrentUnits: 12, storageLitres: 650 }, mounting: 'floor', clearanceFrontMm: 900, configurationIds: ['locker-two-door', 'locker-four-door', 'locker-six-door'], tags: ['floor-mounted', 'lockable', 'secure-storage'], constructorKey: 'storage-locker' }),
]

export const STORAGE_CATALOG = parseCatalogEntries(rawStorageCatalog)
