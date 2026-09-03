import { z } from 'zod'
import { operationalProfileSchema } from '../../domain/project-schema'

const idSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'IDs may contain only letters, numbers, dots, underscores, colons, and hyphens')

const nameSchema = z.string().trim().min(1).max(160)
const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000)
const dimensionSchema = z.number().finite().positive().max(100_000)
const rotationSchema = z.number().finite().min(-1_000_000).max(1_000_000)

const pointSchema = z.object({
  xMm: coordinateSchema,
  yMm: coordinateSchema,
}).strict()

const dimensionsSchema = z.object({
  widthMm: dimensionSchema,
  depthMm: dimensionSchema,
  heightMm: dimensionSchema.optional(),
}).strict()

const componentIdsSchema = z.array(idSchema).min(1).max(500).refine(
  (ids) => new Set(ids).size === ids.length,
  'Component IDs must be unique',
)

const rectSchema = z.object({
  id: idSchema,
  xMm: coordinateSchema,
  yMm: coordinateSchema,
  widthMm: dimensionSchema,
  depthMm: dimensionSchema,
}).strict()
const pillarSchema = rectSchema.extend({ shape: z.literal('round').optional() })

const openingSchema = z.object({
  id: idSchema,
  label: nameSchema,
  kind: z.enum(['door', 'service-window', 'sealed-opening']),
  wall: z.enum(['top', 'right', 'bottom', 'left']),
  segmentIndex: z.number().int().nonnegative().max(999).optional(),
  offsetMm: z.number().finite().nonnegative().max(1_000_000),
  widthMm: dimensionSchema,
  sillHeightMm: z.number().finite().nonnegative().max(100_000).optional(),
  heightMm: dimensionSchema.optional(),
  flow: z.enum(['entry', 'clean-out', 'dirty-in', 'closed']).optional(),
  swingDepthMm: z.number().finite().nonnegative().max(100_000).optional(),
}).strict()

const storageZoneSchema = rectSchema.extend({
  label: nameSchema,
  adjacent: z.boolean(),
}).strict()

const architecturePatchSchema = z.object({
  widthMm: dimensionSchema.optional(),
  depthMm: dimensionSchema.optional(),
  wallHeightMm: dimensionSchema.optional(),
  roomPolygon: z.array(pointSchema).min(3).max(1_000).optional(),
  openings: z.array(openingSchema).max(1_000).optional(),
  pillars: z.array(pillarSchema).max(1_000).optional(),
  storageZones: z.array(storageZoneSchema).max(1_000).optional(),
  locked: z.boolean().optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Architecture patch cannot be empty')

const stationCapabilitySchema = z.enum([
  'flat-top-cook',
  'fryer-cook',
  'range-cook',
  'tandoor-cook',
  'cold-retrieval',
  'food-prep',
  'finish-plate',
  'clean-window',
  'dirty-window',
  'dirty-landing',
  'dish-pre-rinse',
  'dish-wash',
  'clean-landing',
  'hand-wash',
  'mix',
])

const componentPatchSchema = z.object({
  label: nameSchema.optional(),
  xMm: coordinateSchema.optional(),
  yMm: coordinateSchema.optional(),
  category: z.enum(['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom']).optional(),
  heightMm: dimensionSchema.optional(),
  capabilities: z.array(stationCapabilitySchema).max(100).optional(),
  clearance: z.object({
    frontMm: z.number().finite().nonnegative().max(100_000),
    leftMm: z.number().finite().nonnegative().max(100_000).optional(),
    rightMm: z.number().finite().nonnegative().max(100_000).optional(),
    backMm: z.number().finite().nonnegative().max(100_000).optional(),
    kind: z.enum(['work', 'door-swing', 'heat', 'service']),
  }).strict().optional(),
  approximate: z.boolean().optional(),
  notes: z.string().max(4_000).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Component patch cannot be empty')

const durationRangeSchema = z.object({
  minSeconds: z.number().finite().positive().max(86_400),
  maxSeconds: z.number().finite().positive().max(86_400),
}).strict().refine((range) => range.minSeconds <= range.maxSeconds, 'Minimum duration cannot exceed maximum duration')

const scenarioChecksPatchSchema = z.object({
  collisions: z.boolean().optional(),
  doorSwings: z.boolean().optional(),
  dirtyCleanCrossings: z.boolean().optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Checks patch cannot be empty')

const scenarioPatchSchema = z.object({
  name: nameSchema.optional(),
  covers: z.number().int().positive().max(100_000).optional(),
  durationMinutes: z.number().finite().positive().max(10_080).optional(),
  arrivalPattern: z.enum(['seating-wave', 'steady', 'two-waves']).optional(),
  cookToOrderRatio: z.number().finite().min(0).max(1).optional(),
  seed: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
  staff: z.array(z.object({
    role: z.enum(['head-chef', 'sous-chef', 'cdp', 'busser-washer']),
    count: z.number().int().nonnegative().max(100),
  }).strict()).min(1).max(100).optional(),
  checks: scenarioChecksPatchSchema.optional(),
  taskDurations: z.partialRecord(stationCapabilitySchema, durationRangeSchema).optional(),
  stationCapacities: z.record(idSchema, z.number().int().positive().max(100)).optional(),
  serviceStyle: nameSchema.optional(),
  variability: z.enum(['low', 'typical', 'high']).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Scenario patch cannot be empty')

const operationalProfilePatchSchema = operationalProfileSchema.partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Operational profile patch cannot be empty')

const variantId = { variantId: idSchema }

export const workspaceOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_layout'),
    ...variantId,
    name: nameSchema,
    parentVariantId: idSchema.optional(),
    equipmentMode: z.enum(['duplicate', 'empty']),
  }).strict(),
  z.object({ type: z.literal('activate_layout'), ...variantId }).strict(),
  z.object({ type: z.literal('rename_layout'), ...variantId, name: nameSchema }).strict(),
  z.object({ type: z.literal('remove_layout'), ...variantId }).strict(),
  z.object({
    type: z.literal('add_component'),
    ...variantId,
    componentId: idSchema,
    catalogId: idSchema,
    position: pointSchema,
    dimensions: dimensionsSchema.optional(),
    rotationDeg: rotationSchema.optional(),
    configurationId: idSchema.optional(),
    skinId: idSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('add_custom_component'),
    ...variantId,
    componentId: idSchema,
    label: nameSchema,
    position: pointSchema,
    dimensions: dimensionsSchema,
    rotationDeg: rotationSchema.optional(),
    capabilities: z.array(idSchema).max(100).optional(),
  }).strict(),
  z.object({ type: z.literal('configure_component'), ...variantId, componentId: idSchema, configurationId: idSchema }).strict(),
  z.object({ type: z.literal('skin_component'), ...variantId, componentId: idSchema, skinId: idSchema }).strict(),
  z.object({ type: z.literal('update_component'), ...variantId, componentId: idSchema, patch: componentPatchSchema }).strict(),
  z.object({ type: z.literal('move_components'), ...variantId, componentIds: componentIdsSchema, anchor: pointSchema }).strict(),
  z.object({ type: z.literal('nudge_components'), ...variantId, componentIds: componentIdsSchema, delta: pointSchema }).strict(),
  z.object({ type: z.literal('rotate_components'), ...variantId, componentIds: componentIdsSchema, deltaDeg: rotationSchema }).strict(),
  z.object({ type: z.literal('resize_component'), ...variantId, componentId: idSchema, dimensions: dimensionsSchema }).strict(),
  z.object({ type: z.literal('set_component_dimensions_lock'), ...variantId, componentId: idSchema, locked: z.boolean() }).strict(),
  z.object({
    type: z.literal('duplicate_components'),
    ...variantId,
    components: z.array(z.object({ componentId: idSchema, duplicateId: idSchema }).strict()).min(1).max(500),
    offset: pointSchema.optional(),
  }).strict(),
  z.object({ type: z.literal('lock_components'), ...variantId, componentIds: componentIdsSchema, locked: z.boolean() }).strict(),
  z.object({ type: z.literal('remove_components'), ...variantId, componentIds: componentIdsSchema }).strict(),
  z.object({ type: z.literal('update_architecture'), ...variantId, patch: architecturePatchSchema }).strict(),
  z.object({ type: z.literal('update_operational_profile'), ...variantId, patch: operationalProfilePatchSchema }).strict(),
  z.object({
    type: z.literal('update_workspace_settings'),
    ...variantId,
    patch: z.object({ displayUnit: z.enum(['mm', 'cm', 'in', 'ft']).optional(), snapMm: dimensionSchema.optional() }).strict()
      .refine((patch) => Object.keys(patch).length > 0, 'Workspace settings patch cannot be empty'),
  }).strict(),
  z.object({ type: z.literal('update_scenario'), ...variantId, scenarioId: idSchema, patch: scenarioPatchSchema }).strict(),
  z.object({
    type: z.literal('adopt_auto_layout_result'),
    ...variantId,
    runId: idSchema,
    resultId: idSchema,
    newVariantId: idSchema,
    name: nameSchema,
  }).strict(),
])

export type WorkspaceOperation = z.infer<typeof workspaceOperationSchema>

export const WORKSPACE_OPERATION_TYPES: WorkspaceOperation['type'][] = [
  'create_layout',
  'activate_layout',
  'rename_layout',
  'remove_layout',
  'add_component',
  'add_custom_component',
  'configure_component',
  'skin_component',
  'update_component',
  'move_components',
  'nudge_components',
  'rotate_components',
  'resize_component',
  'set_component_dimensions_lock',
  'duplicate_components',
  'lock_components',
  'remove_components',
  'update_architecture',
  'update_operational_profile',
  'update_workspace_settings',
  'update_scenario',
  'adopt_auto_layout_result',
]
