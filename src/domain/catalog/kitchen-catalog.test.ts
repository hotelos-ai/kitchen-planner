import { describe, expect, it } from 'vitest'
import { KITCHEN_CATALOG, createCatalogEquipmentItem, filterCatalog, getCatalogEntry, searchCatalog } from './kitchen-catalog'
import { STORAGE_CATALOG } from './storage-catalog'
import { catalogEntrySchema } from './types'
import { APPEARANCE_SKINS } from './appearance-skins'

const requiredCategories = [
  'cooking-hot-line',
  'ovens-holding',
  'refrigeration-ice',
  'preparation',
  'beverage-service',
  'warewashing-sanitation',
  'waste-janitorial',
  'ventilation-utilities',
  'architecture',
  'storage',
  'custom',
] as const

const requiredStorageIds = [
  'storage-wall-shelf',
  'storage-overshelf',
  'storage-freestanding-shelving',
  'storage-mobile-rack',
  'storage-dunnage-rack',
  'storage-ingredient-bins',
  'storage-pot-rack',
  'storage-dish-rack',
  'storage-tray-rack',
  'storage-overhead-rack',
] as const

describe('commercial kitchen catalog', () => {
  it('exports a parsed, broad, uniquely identified catalog', () => {
    expect(Object.isFrozen(KITCHEN_CATALOG)).toBe(true)
    expect(KITCHEN_CATALOG.length).toBeGreaterThanOrEqual(60)
    expect(new Set(KITCHEN_CATALOG.map((entry) => entry.catalogId)).size).toBe(KITCHEN_CATALOG.length)
    requiredCategories.forEach((category) => expect(KITCHEN_CATALOG.some((entry) => entry.category === category)).toBe(true))
  })

  it('provides every required field and ordered dimension ranges', () => {
    const skinIds = new Set(APPEARANCE_SKINS.map((skin) => skin.skinId))
    KITCHEN_CATALOG.forEach((entry) => {
      expect(catalogEntrySchema.safeParse(entry).success, entry.catalogId).toBe(true)
      ;(['widthMm', 'depthMm', 'heightMm'] as const).forEach((axis) => {
        expect(entry.minimumDimensions[axis], `${entry.catalogId}/${axis}/min`).toBeLessThanOrEqual(entry.typicalDimensions[axis])
        expect(entry.typicalDimensions[axis], `${entry.catalogId}/${axis}/max`).toBeLessThanOrEqual(entry.maximumDimensions[axis])
      })
      expect(entry.appearanceSkinIds.every((skinId) => skinIds.has(skinId)), entry.catalogId).toBe(true)
      expect(entry.configurationIds.length, entry.catalogId).toBeGreaterThan(0)
      expect(entry.physicalConfigurations.map((preset) => preset.id), entry.catalogId).toEqual(entry.configurationIds)
      expect(entry.tags.length, entry.catalogId).toBeGreaterThan(0)
    })
  })

  it('covers major commercial equipment families and keeps a custom escape hatch', () => {
    const ids = new Set(KITCHEN_CATALOG.map((entry) => entry.catalogId))
    ;[
      'hot-six-burner-range', 'hot-deep-fryer', 'hot-charbroiler', 'hot-wok-range',
      'oven-combi', 'oven-deck', 'holding-heated-cabinet',
      'cold-upright-refrigerator', 'cold-walk-in-placeholder', 'cold-blast-chiller', 'ice-maker',
      'prep-work-table', 'prep-planetary-mixer', 'prep-food-processor',
      'service-espresso-machine', 'service-hot-pass',
      'wash-three-compartment-sink', 'wash-hood-dishwasher', 'sanitation-hand-sink',
      'waste-mobile-bin', 'janitorial-mop-sink',
      'utility-canopy-hood', 'utility-gas-point',
      'architecture-door', 'architecture-service-window',
      'custom-component',
    ].forEach((id) => expect(ids.has(id), id).toBe(true))
    expect(KITCHEN_CATALOG.find((entry) => entry.catalogId === 'custom-component')).toMatchObject({
      category: 'custom', constructorKey: 'custom-box', configurationIds: ['custom-size'],
    })
  })

  it('provides every specified storage system as a first-class catalog entry', () => {
    const storageIds = new Set(STORAGE_CATALOG.map((entry) => entry.catalogId))
    requiredStorageIds.forEach((id) => expect(storageIds.has(id), id).toBe(true))
    expect(STORAGE_CATALOG.every((entry) => entry.category === 'storage')).toBe(true)
    expect(STORAGE_CATALOG.find((entry) => entry.catalogId === 'storage-wall-shelf')).toMatchObject({
      placementRules: { mounting: 'wall', requiresWall: true }, tags: expect.arrayContaining(['wall-mounted', 'elevated']),
      physicalConfigurations: expect.arrayContaining([expect.objectContaining({ id: 'wall-shelf-two-tier', tierCount: 2, mounting: 'wall' })]),
    })
    expect(STORAGE_CATALOG.find((entry) => entry.catalogId === 'storage-mobile-rack')).toMatchObject({
      placementRules: { mounting: 'floor' }, tags: expect.arrayContaining(['mobile']),
    })
  })

  it('rejects malformed entries and unknown controlled fields', () => {
    const valid = KITCHEN_CATALOG[0]
    expect(catalogEntrySchema.safeParse({ ...valid, executableConstructor: 'alert(1)' }).success).toBe(false)
    expect(catalogEntrySchema.safeParse({ ...valid, typicalDimensions: { ...valid.typicalDimensions, diameterMm: 500 } }).success).toBe(false)
    expect(catalogEntrySchema.safeParse({ ...valid, placementRules: { ...valid.placementRules, arbitraryRule: true } }).success).toBe(false)
  })

  it('searches and filters catalog metadata deterministically', () => {
    expect(searchCatalog('plancha').map((entry) => entry.catalogId)).toContain('hot-griddle')
    expect(searchCatalog('')).toHaveLength(KITCHEN_CATALOG.length)
    expect(filterCatalog(KITCHEN_CATALOG, { category: 'storage' })).toEqual(STORAGE_CATALOG)
    expect(filterCatalog(KITCHEN_CATALOG, { capability: 'dish-wash' }).map((entry) => entry.catalogId)).toContain('wash-hood-dishwasher')
  })

  it('resolves catalog entries into validated equipment data without executable constructors', () => {
    expect(getCatalogEntry('hot-six-burner-range')?.constructorKey).toBe('range-six-burner')
    expect(getCatalogEntry('missing')).toBeUndefined()
    expect(createCatalogEquipmentItem({
      catalogId: 'hot-six-burner-range',
      componentId: 'range-2',
      position: { xMm: 1200, yMm: 800 },
      rotationDeg: 90,
      configurationId: 'range-six-burner-standard',
      skinId: 'stainless-polished',
    })).toMatchObject({
      id: 'range-2', catalogId: 'hot-six-burner-range', label: 'Six-burner range', category: 'cooking',
      xMm: 1200, yMm: 800, rotationDeg: 90, configurationPreset: 'range-six-burner-standard',
      appearanceSkinId: 'stainless-polished', visualPreset: 'range-six-burner',
    })
    expect(() => createCatalogEquipmentItem({ catalogId: 'missing', componentId: 'x', position: { xMm: 0, yMm: 0 } })).toThrow(/unknown catalog/i)
    expect(() => createCatalogEquipmentItem({ catalogId: 'hot-six-burner-range', componentId: 'x', position: { xMm: 0, yMm: 0 }, skinId: 'wood-maple' })).toThrow(/skin/i)
  })

  it('initializes a requested physical preset with that preset dimensions and capabilities', () => {
    const entry = getCatalogEntry('storage-wall-shelf')!
    const preset = entry.physicalConfigurations.find((candidate) => candidate.id === 'wall-shelf-three-tier')!
    const item = createCatalogEquipmentItem({
      catalogId: entry.catalogId,
      componentId: 'configured-shelf',
      position: { xMm: 0, yMm: 0 },
      configurationId: preset.id,
    })

    expect(item).toMatchObject({ configurationPreset: preset.id, ...preset.dimensions })
  })
})
