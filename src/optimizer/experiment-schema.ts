import { z } from 'zod'

const rectSchema = z.object({
  id: z.string().min(1), xMm: z.number().finite(), yMm: z.number().finite(),
  widthMm: z.number().positive().finite(), depthMm: z.number().positive().finite(),
}).strict()

const uniqueIntegers = z.array(z.number().int().nonnegative()).min(1).refine((values) => new Set(values).size === values.length, 'Seeds must be unique.')
const uniqueStrings = z.array(z.string().min(1)).refine((values) => new Set(values).size === values.length, 'IDs must be unique.')
const capabilitySchema = z.enum([
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
])
const uniqueRects = z.array(rectSchema).refine((values) => new Set(values.map((value) => value.id)).size === values.length, 'No-go zone IDs must be unique.')

export const optimizerManifestSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  baselineVariantId: z.string().min(1),
  scenarioIds: uniqueStrings.min(1),
  seeds: uniqueIntegers,
  confirmationSeeds: uniqueIntegers,
  permissionTier: z.enum(['A', 'B', 'C']),
  lockedComponentIds: uniqueStrings,
  lockedArchitectureElementIds: uniqueStrings,
  hardRules: z.object({
    minimumAisleMm: z.number().nonnegative().finite(),
    bodyRadiusMm: z.number().nonnegative().finite().optional(),
    noGoZones: uniqueRects,
    requiredCapacityByCapability: z.partialRecord(capabilitySchema, z.number().int().positive()).optional(),
  }).strict(),
  budget: z.object({ maxEvaluations: z.number().int().positive(), maxDurationMs: z.number().int().positive() }).strict(),
  priority: z.enum(['balanced', 'service', 'travel', 'minimal-change']).optional(),
  targetP90WaitSeconds: z.number().positive().finite().optional(),
}).strict().superRefine((manifest, context) => {
  const common = new Set(manifest.seeds)
  manifest.confirmationSeeds.forEach((seed, index) => {
    if (common.has(seed)) context.addIssue({ code: 'custom', path: ['confirmationSeeds', index], message: 'Confirmation seeds must be held out.' })
  })
})
