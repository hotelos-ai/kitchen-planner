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

const scenarioStaffAssignmentSchema = staffAssignmentSchema.extend({ count: z.number().int().positive() }).strict()
const taskDurationRangeSchema = z.object({
  minSeconds: z.number().positive().finite(),
  maxSeconds: z.number().positive().finite(),
}).strict().refine((range) => range.minSeconds <= range.maxSeconds, 'Minimum duration cannot exceed maximum duration')

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
  minimumAisleMm: z.number().nonnegative().finite().optional(),
  noGoZones: z.array(rectSchema).optional(),
  permissions: autoLayoutPermissionsSchema.optional(),
}).strict()

export const adoptedExperimentManifestSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1).optional(),
  revision: z.number().int().nonnegative().optional(),
  baselineVariantId: z.string().min(1),
  finalistId: z.string().min(1),
  createdAt: z.string().datetime(),
  scenarioIds: z.array(z.string().min(1)).min(1),
  seeds: z.array(z.number().int()).min(1),
  confirmationSeeds: z.array(z.number().int()),
  permissions: autoLayoutPermissionsSchema,
  lockedComponentIds: z.array(z.string().min(1)).optional(),
  lockedArchitectureElementIds: z.array(z.string().min(1)).optional(),
  hardRules: z.object({
    minimumAisleMm: z.number().nonnegative().finite(),
    bodyRadiusMm: z.number().nonnegative().finite().optional(),
    noGoZones: z.array(rectSchema),
    requiredCapacityByCapability: z.partialRecord(capabilitySchema, z.number().int().positive()).optional(),
  }).strict().optional(),
  budget: z.object({
    maxDurationMs: z.number().int().positive().optional(),
    maxEvaluations: z.number().int().positive().optional(),
  }).strict().refine((budget) => Object.keys(budget).length > 0, 'At least one search budget is required'),
  objective: z.string().min(1),
  priority: z.enum(['balanced', 'service', 'travel', 'minimal-change']).optional(),
  targetP90WaitSeconds: z.number().positive().finite().optional(),
  resultHash: z.string().min(1).optional(),
  resultMetrics: z.record(z.string(), z.number().finite()).optional(),
}).strict()

export const layoutCheckpointSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  label: z.string().min(1),
  createdAt: z.string().datetime(),
  architecture: architectureSchema,
  equipment: z.array(equipmentSchema),
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
  checkpoints: z.array(layoutCheckpointSchema).optional(),
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
  staff: z.array(scenarioStaffAssignmentSchema).min(1),
  checks: z.object({ collisions: z.boolean(), doorSwings: z.boolean(), dirtyCleanCrossings: z.boolean() }).strict(),
  taskDurations: z.partialRecord(capabilitySchema, taskDurationRangeSchema).optional(),
  stationCapacities: z.record(z.string(), z.number().int().positive()).optional(),
  serviceStyle: z.string().min(1).optional(),
  variability: z.enum(['low', 'typical', 'high']).optional(),
}).strict()

export const projectSchema = z.object({
  schemaVersion: z.literal(3),
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
  const duplicateIndexes = (values: readonly string[]) => values.flatMap((value, index) => values.indexOf(value) === index ? [] : [index])
  duplicateIndexes(project.variants.map((variant) => variant.id)).forEach((index) => context.addIssue({ code: 'custom', path: ['variants', index, 'id'], message: 'Layout variant IDs must be unique' }))
  duplicateIndexes(project.scenarios.map((scenario) => scenario.id)).forEach((index) => context.addIssue({ code: 'custom', path: ['scenarios', index, 'id'], message: 'Scenario IDs must be unique' }))
  const variantIds = new Set(project.variants.map((variant) => variant.id))
  const scenarioIds = new Set(project.scenarios.map((scenario) => scenario.id))
  project.variants.forEach((variant, variantIndex) => {
    duplicateIndexes(variant.equipment.map((item) => item.id)).forEach((index) => context.addIssue({ code: 'custom', path: ['variants', variantIndex, 'equipment', index, 'id'], message: 'Component IDs must be unique within a layout' }))
    if (variant.parentId && (!variantIds.has(variant.parentId) || variant.parentId === variant.id)) context.addIssue({ code: 'custom', path: ['variants', variantIndex, 'parentId'], message: 'Parent layout must reference a different existing variant' })
    const architectureElements = [
      ...variant.architecture.openings.map((element, index) => ({ id: element.id, collection: 'openings', index })),
      ...variant.architecture.pillars.map((element, index) => ({ id: element.id, collection: 'pillars', index })),
      ...variant.architecture.storageZones.map((element, index) => ({ id: element.id, collection: 'storageZones', index })),
    ]
    duplicateIndexes(architectureElements.map((element) => element.id)).forEach((duplicateIndex) => {
      const element = architectureElements[duplicateIndex]
      context.addIssue({
        code: 'custom',
        path: ['variants', variantIndex, 'architecture', element.collection, element.index, 'id'],
        message: 'Architecture element IDs must be unique within a layout',
      })
    })
    const componentIds = new Set(variant.equipment.map((item) => item.id))
    variant.layoutConstraints?.lockedComponentIds?.forEach((id, index) => {
      if (!componentIds.has(id)) context.addIssue({ code: 'custom', path: ['variants', variantIndex, 'layoutConstraints', 'lockedComponentIds', index], message: 'Locked component does not exist in this layout' })
    })
    const architectureIds = new Set(['room', ...variant.architecture.openings.map((value) => value.id), ...variant.architecture.pillars.map((value) => value.id), ...variant.architecture.storageZones.map((value) => value.id)])
    variant.layoutConstraints?.lockedArchitectureElementIds?.forEach((id, index) => {
      if (!architectureIds.has(id)) context.addIssue({ code: 'custom', path: ['variants', variantIndex, 'layoutConstraints', 'lockedArchitectureElementIds', index], message: 'Locked architecture element does not exist in this layout' })
    })
    variant.adoptedExperimentManifest?.scenarioIds.forEach((id, index) => {
      if (!scenarioIds.has(id)) context.addIssue({ code: 'custom', path: ['variants', variantIndex, 'adoptedExperimentManifest', 'scenarioIds', index], message: 'Experiment scenario does not exist in this project' })
    })
    const baselineVariantId = variant.adoptedExperimentManifest?.baselineVariantId
    if (baselineVariantId && (!variantIds.has(baselineVariantId) || baselineVariantId === variant.id)) {
      context.addIssue({
        code: 'custom',
        path: ['variants', variantIndex, 'adoptedExperimentManifest', 'baselineVariantId'],
        message: 'Experiment baseline must reference a different existing layout variant',
      })
    }
  })
  if (!project.variants.some((variant) => variant.id === project.activeVariantId)) {
    context.addIssue({ code: 'custom', path: ['activeVariantId'], message: 'Active layout variant does not exist' })
  }
  if (!project.scenarios.some((scenario) => scenario.id === project.activeScenarioId)) {
    context.addIssue({ code: 'custom', path: ['activeScenarioId'], message: 'Active simulation scenario does not exist' })
  }
})
