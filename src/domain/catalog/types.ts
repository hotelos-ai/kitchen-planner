import { z } from 'zod'

const stableIdSchema = z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9-]*$/)
const nonnegativeLengthSchema = z.number().finite().nonnegative().max(100_000)
const positiveLengthSchema = z.number().finite().positive().max(100_000)

export const catalogCategorySchema = z.enum([
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
])

export const catalogDimensionsSchema = z.object({
  widthMm: positiveLengthSchema,
  depthMm: positiveLengthSchema,
  heightMm: positiveLengthSchema,
}).strict()

export const catalogCapacitySchema = z.object({
  workPositions: z.number().int().nonnegative().max(100),
  concurrentUnits: z.number().int().nonnegative().max(10_000),
  storageLitres: z.number().finite().nonnegative().max(1_000_000).optional(),
}).strict()

export const catalogClearanceSchema = z.object({
  frontMm: nonnegativeLengthSchema,
  leftMm: nonnegativeLengthSchema,
  rightMm: nonnegativeLengthSchema,
  backMm: nonnegativeLengthSchema,
  topMm: nonnegativeLengthSchema,
  kind: z.enum(['work', 'service', 'heat', 'door-swing', 'maintenance', 'storage', 'none']),
}).strict()

export const placementRulesSchema = z.object({
  mounting: z.enum(['floor', 'wall', 'overhead', 'counter', 'architectural']),
  requiresWall: z.boolean(),
  requiresHood: z.boolean(),
  utilityRequirements: z.array(z.enum(['electricity', 'gas', 'water', 'drainage', 'ventilation', 'compressed-air'])),
  allowedZones: z.array(stableIdSchema).min(1),
  keepClearOfOpeningsMm: nonnegativeLengthSchema,
}).strict()

export const physicalConfigurationPresetSchema = z.object({
  id: stableIdSchema,
  label: z.string().trim().min(1).max(200),
  dimensions: catalogDimensionsSchema,
  capabilities: z.array(stableIdSchema).max(100),
  capacity: catalogCapacitySchema,
  clearance: catalogClearanceSchema,
  mounting: z.enum(['floor', 'wall', 'overhead', 'counter', 'architectural']),
  mobile: z.boolean(),
  tierCount: z.number().int().positive().max(100).optional(),
  elevationMm: nonnegativeLengthSchema.optional(),
}).strict()

const footprintSchema = z.discriminatedUnion('shape', [
  z.object({ shape: z.literal('rectangle'), cornerRadiusMm: nonnegativeLengthSchema }).strict(),
  z.object({ shape: z.literal('circle') }).strict(),
  z.object({
    shape: z.literal('polygon'),
    points: z.array(z.object({ xMm: z.number().finite(), yMm: z.number().finite() }).strict()).min(3).max(100),
  }).strict(),
])

export const catalogEntrySchema = z.object({
  catalogId: stableIdSchema,
  familyId: stableIdSchema,
  displayName: z.string().trim().min(1).max(160),
  category: catalogCategorySchema,
  description: z.string().trim().min(1).max(1_000),
  synonyms: z.array(z.string().trim().min(1).max(100)).max(50),
  typicalDimensions: catalogDimensionsSchema,
  minimumDimensions: catalogDimensionsSchema,
  maximumDimensions: catalogDimensionsSchema,
  capabilities: z.array(stableIdSchema).max(100),
  capacity: catalogCapacitySchema,
  clearance: catalogClearanceSchema,
  intendedApproachFace: z.enum(['front', 'back', 'left', 'right', 'either-side', 'none']),
  placementRules: placementRulesSchema,
  configurationIds: z.array(stableIdSchema).min(1).max(100),
  physicalConfigurations: z.array(physicalConfigurationPresetSchema).min(1).max(100),
  appearanceSkinIds: z.array(stableIdSchema).min(1).max(100),
  footprint: footprintSchema,
  tags: z.array(stableIdSchema).min(1).max(100),
  constructorKey: stableIdSchema,
}).strict()

export const catalogSchema = z.array(catalogEntrySchema).superRefine((entries, context) => {
  const seen = new Set<string>()
  entries.forEach((entry, index) => {
    if (seen.has(entry.catalogId)) context.addIssue({ code: 'custom', path: [index, 'catalogId'], message: 'Catalog IDs must be unique' })
    seen.add(entry.catalogId)
    const configurationIds = new Set(entry.configurationIds)
    if (configurationIds.size !== entry.configurationIds.length
      || entry.physicalConfigurations.length !== entry.configurationIds.length
      || entry.physicalConfigurations.some((preset) => !configurationIds.has(preset.id))) {
      context.addIssue({ code: 'custom', path: [index, 'physicalConfigurations'], message: 'Physical presets must correspond one-to-one with configuration IDs' })
    }
    ;(['widthMm', 'depthMm', 'heightMm'] as const).forEach((axis) => {
      if (entry.minimumDimensions[axis] > entry.typicalDimensions[axis] || entry.typicalDimensions[axis] > entry.maximumDimensions[axis]) {
        context.addIssue({ code: 'custom', path: [index, 'typicalDimensions', axis], message: 'Dimensions must satisfy minimum <= typical <= maximum' })
      }
    })
  })
})

export type CatalogCategory = z.infer<typeof catalogCategorySchema>
export type CatalogDimensions = z.infer<typeof catalogDimensionsSchema>
export type CatalogEntry = z.infer<typeof catalogEntrySchema>

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, twenty: 20 }

export function createPhysicalConfigurationPresets(input: {
  configurationIds: readonly string[]
  displayName: string
  typicalDimensions: CatalogDimensions
  maximumDimensions: CatalogDimensions
  capabilities: readonly string[]
  capacity: z.infer<typeof catalogCapacitySchema>
  clearance: z.infer<typeof catalogClearanceSchema>
  mounting: z.infer<typeof placementRulesSchema>['mounting']
  mountingHeightMm?: number
  tags: readonly string[]
}) {
  return input.configurationIds.map((id, index) => {
    const ratio = index / Math.max(1, input.configurationIds.length - 1)
    const dimension = (axis: keyof CatalogDimensions) => {
      const interpolated = Math.round(
        (input.typicalDimensions[axis] + (input.maximumDimensions[axis] - input.typicalDimensions[axis]) * ratio) / 10,
      ) * 10
      return Math.max(input.typicalDimensions[axis], Math.min(input.maximumDimensions[axis], interpolated))
    }
    const tierToken = id.split('-').find((token) => numberWords[token] !== undefined || /^\d+$/.test(token))
    const tierCount = tierToken ? numberWords[tierToken] ?? Number(tierToken) : undefined
    return {
      id,
      label: `${input.displayName} · ${id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}`,
      dimensions: { widthMm: dimension('widthMm'), depthMm: dimension('depthMm'), heightMm: dimension('heightMm') },
      capabilities: [...input.capabilities],
      capacity: structuredClone(input.capacity),
      clearance: structuredClone(input.clearance),
      mounting: input.mounting,
      mobile: input.tags.includes('mobile') || id.includes('mobile'),
      ...(tierCount ? { tierCount } : {}),
      ...(input.mounting === 'wall' ? { elevationMm: Math.max(input.mountingHeightMm ?? 1_500, input.typicalDimensions.heightMm) } : {}),
      ...(input.mounting === 'overhead' ? { elevationMm: Math.max(input.mountingHeightMm ?? 2_000, input.typicalDimensions.heightMm) } : {}),
    }
  })
}

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => deepFreeze(child))
    Object.freeze(value)
  }
  return value
}

export function parseCatalogEntries(input: unknown): readonly CatalogEntry[] {
  return deepFreeze(catalogSchema.parse(input))
}
