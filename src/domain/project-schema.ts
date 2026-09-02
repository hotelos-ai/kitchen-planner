import { z } from 'zod'

const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const rectSchema = z.object({
  id: z.string().min(1),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  widthMm: z.number().positive().finite(),
  depthMm: z.number().positive().finite(),
}).strict()

const capabilitySchema = z.enum([
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
])

const clearanceSchema = z.object({
  frontMm: z.number().nonnegative().finite(),
  leftMm: z.number().nonnegative().finite().optional(),
  rightMm: z.number().nonnegative().finite().optional(),
  backMm: z.number().nonnegative().finite().optional(),
  kind: z.enum(['work', 'door-swing', 'heat', 'service']),
}).strict()

export const equipmentSchema = z.object({
  id: z.string().min(1),
  catalogId: z.string().min(1).optional(),
  label: z.string().min(1),
  category: z.enum(['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom']),
  widthMm: z.number().positive().finite(),
  depthMm: z.number().positive().finite(),
  heightMm: z.number().positive().finite(),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  rotationDeg: z.number().finite(),
  dimensionsLocked: z.boolean(),
  movable: z.boolean(),
  removable: z.boolean(),
  capabilities: z.array(capabilitySchema),
  clearance: clearanceSchema.optional(),
  approximate: z.boolean().optional(),
  notes: z.string().optional(),
  visualPreset: z.string().min(1).optional(),
  configurationPreset: z.string().min(1).optional(),
  appearanceSkinId: z.string().min(1).optional(),
}).strict()

export const architectureSchema = z.object({
  widthMm: z.number().positive().finite(),
  depthMm: z.number().positive().finite(),
  wallHeightMm: z.number().positive().finite(),
  roomPolygon: z.array(pointSchema).min(3),
  openings: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.enum(['door', 'service-window', 'sealed-opening']),
    wall: z.enum(['top', 'right', 'bottom', 'left']),
    segmentIndex: z.number().int().nonnegative().max(999).optional(),
    offsetMm: z.number().nonnegative().finite(),
    widthMm: z.number().positive().finite(),
    sillHeightMm: z.number().nonnegative().finite().optional(),
    heightMm: z.number().positive().finite().optional(),
    flow: z.enum(['entry', 'clean-out', 'dirty-in', 'closed']).optional(),
    swingDepthMm: z.number().nonnegative().finite().optional(),
  }).strict()),
  pillars: z.array(rectSchema),
  storageZones: z.array(rectSchema.extend({ label: z.string().min(1), adjacent: z.boolean() }).strict()),
  locked: z.boolean(),
}).strict()

const staffAssignmentSchema = z.object({
  role: z.enum(['head-chef', 'sous-chef', 'cdp', 'busser-washer']),
  count: z.number().int().nonnegative(),
}).strict()

export const operationalProfileSchema = z.object({
  covers: z.number().int().positive().optional(),
  peakDurationMinutes: z.number().positive().finite().optional(),
  arrivalPattern: z.enum(['seating-wave', 'steady', 'two-waves']).optional(),
  serviceStyle: z.string().min(1).optional(),
  menuAssumptions: z.array(z.string().min(1)).optional(),
  staff: z.array(staffAssignmentSchema).optional(),
  targetCapacityPerHour: z.number().positive().finite().optional(),
}).strict()

export const autoLayoutPermissionsSchema = z.object({
  placement: z.boolean(),
  equipmentRedesign: z.boolean(),
  architecture: z.boolean(),
}).strict()

export const layoutConstraintsSchema = z.object({
  lockedComponentIds: z.array(z.string().min(1)).optional(),
  lockedArchitectureElementIds: z.array(z.string().min(1)).optional(),
  minimumAisleMm: z.number().positive().finite().optional(),
  noGoZones: z.array(rectSchema).optional(),
  permissions: autoLayoutPermissionsSchema.optional(),
}).strict()

export const adoptedExperimentManifestSchema = z.object({
  id: z.string().min(1),
  baselineVariantId: z.string().min(1),
  finalistId: z.string().min(1),
  createdAt: z.string().datetime(),
  scenarioIds: z.array(z.string().min(1)).min(1),
  seeds: z.array(z.number().int()).min(1),
  confirmationSeeds: z.array(z.number().int()),
  permissions: autoLayoutPermissionsSchema,
  budget: z.object({
    maxDurationMs: z.number().int().positive().optional(),
    maxEvaluations: z.number().int().positive().optional(),
  }).strict().refine((budget) => Object.keys(budget).length > 0, 'At least one search budget is required'),
  objective: z.string().min(1),
  resultHash: z.string().min(1).optional(),
  resultMetrics: z.record(z.string(), z.number().finite()).optional(),
}).strict()

export const variantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).optional(),
  architecture: architectureSchema,
  equipment: z.array(equipmentSchema),
  operationalProfile: operationalProfileSchema.optional(),
  layoutConstraints: layoutConstraintsSchema.optional(),
  adoptedExperimentManifest: adoptedExperimentManifestSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  covers: z.number().int().positive(),
  durationMinutes: z.number().positive().finite(),
  arrivalPattern: z.enum(['seating-wave', 'steady', 'two-waves']),
  cookToOrderRatio: z.number().min(0).max(1),
  seed: z.number().int(),
  staff: z.array(staffAssignmentSchema).min(1),
  checks: z.object({ collisions: z.boolean(), doorSwings: z.boolean(), dirtyCleanCrossings: z.boolean() }).strict(),
  taskDurations: z.partialRecord(capabilitySchema, z.object({ minSeconds: z.number().positive().finite(), maxSeconds: z.number().positive().finite() }).strict()).optional(),
  stationCapacities: z.record(z.string(), z.number().int().positive()).optional(),
}).strict()

export const projectSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  name: z.string().min(1),
  displayUnit: z.enum(['mm', 'cm', 'in', 'ft']),
  snapMm: z.number().positive().finite(),
  architecture: architectureSchema,
  variants: z.array(variantSchema).min(1),
  scenarios: z.array(scenarioSchema).min(1),
  activeVariantId: z.string().min(1),
  activeScenarioId: z.string().min(1),
}).strict().superRefine((project, context) => {
  if (!project.variants.some((variant) => variant.id === project.activeVariantId)) {
    context.addIssue({ code: 'custom', path: ['activeVariantId'], message: 'Active layout variant does not exist' })
  }
  if (!project.scenarios.some((scenario) => scenario.id === project.activeScenarioId)) {
    context.addIssue({ code: 'custom', path: ['activeScenarioId'], message: 'Active simulation scenario does not exist' })
  }
})
