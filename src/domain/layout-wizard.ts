import { z } from 'zod'
import { workspaceOperationSchema, type WorkspaceOperation } from '../core/workspace/workspace-operation'
import type { KitchenProject } from './project'
import { architectureSchema, operationalProfileSchema } from './project-schema'

const idSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'IDs may contain only letters, numbers, dots, underscores, colons, and hyphens')
const nameSchema = z.string().trim().min(1).max(160)
const commonDraftFields = {
  name: nameSchema,
  profile: operationalProfileSchema,
  essentialCatalogIds: z.array(idSchema).max(500).optional(),
}

export const layoutWizardDraftSchema = z.discriminatedUnion('mode', [
  z.object({
    ...commonDraftFields,
    mode: z.literal('duplicate'),
    sourceVariantId: idSchema.optional(),
  }).strict(),
  z.object({
    ...commonDraftFields,
    mode: z.literal('blank-existing'),
    sourceVariantId: idSchema,
  }).strict(),
  z.object({
    ...commonDraftFields,
    mode: z.literal('rectangle'),
    sourceVariantId: idSchema.optional(),
    architecture: architectureSchema,
  }).strict(),
  z.object({
    ...commonDraftFields,
    mode: z.literal('polygon'),
    sourceVariantId: idSchema.optional(),
    architecture: architectureSchema,
  }).strict(),
])

export type LayoutWizardDraft = z.input<typeof layoutWizardDraftSchema>

export type LayoutWizardBuildContext = {
  project: KitchenProject
  newVariantId: string
  componentIds?: readonly string[]
}

const variantExists = (project: KitchenProject, variantId: string) =>
  project.variants.some((variant) => variant.id === variantId)

const architectureOperation = (
  draft: Extract<z.output<typeof layoutWizardDraftSchema>, { mode: 'rectangle' | 'polygon' }>,
  variantId: string,
): WorkspaceOperation => {
  if (draft.mode === 'rectangle') {
    const { widthMm, depthMm, wallHeightMm, openings, pillars, storageZones } = draft.architecture
    return workspaceOperationSchema.parse({
      type: 'update_architecture',
      variantId,
      patch: {
        widthMm,
        depthMm,
        wallHeightMm,
        roomPolygon: [
          { xMm: 0, yMm: 0 },
          { xMm: widthMm, yMm: 0 },
          { xMm: widthMm, yMm: depthMm },
          { xMm: 0, yMm: depthMm },
        ],
        openings,
        pillars,
        storageZones,
        locked: false,
      },
    })
  }

  const { architecture } = draft
  return workspaceOperationSchema.parse({
    type: 'update_architecture',
    variantId,
    patch: {
      widthMm: architecture.widthMm,
      depthMm: architecture.depthMm,
      wallHeightMm: architecture.wallHeightMm,
      roomPolygon: architecture.roomPolygon.map((point) => ({ xMm: point.x, yMm: point.y })),
      openings: architecture.openings,
      pillars: architecture.pillars,
      storageZones: architecture.storageZones,
      locked: false,
    },
  })
}

export function buildLayoutWizardOperations(
  input: LayoutWizardDraft,
  context: LayoutWizardBuildContext,
): WorkspaceOperation[] {
  const draft = layoutWizardDraftSchema.parse(input)
  const newVariantId = idSchema.parse(context.newVariantId)
  if (variantExists(context.project, newVariantId)) throw new Error(`Layout ${newVariantId} already exists.`)

  const parentVariantId = draft.mode === 'duplicate' || draft.mode === 'blank-existing'
    ? draft.sourceVariantId ?? context.project.activeVariantId
    : draft.sourceVariantId ?? context.project.activeVariantId
  if (!variantExists(context.project, parentVariantId)) throw new Error(`Source layout ${parentVariantId} does not exist.`)

  const catalogIds = draft.essentialCatalogIds ?? []
  if (context.componentIds && context.componentIds.length !== catalogIds.length) {
    throw new Error('A component ID is required for every selected essential.')
  }
  const componentIds = (context.componentIds ?? catalogIds.map((_, index) => `${newVariantId}-essential-${index + 1}`))
    .map((componentId) => idSchema.parse(componentId))
  if (new Set(componentIds).size !== componentIds.length) throw new Error('Essential component IDs must be unique.')

  const operations: WorkspaceOperation[] = [workspaceOperationSchema.parse({
    type: 'create_layout',
    variantId: newVariantId,
    parentVariantId,
    name: draft.name,
    equipmentMode: draft.mode === 'duplicate' ? 'duplicate' : 'empty',
  })]

  if (draft.mode === 'rectangle' || draft.mode === 'polygon') {
    operations.push(architectureOperation(draft, newVariantId))
  }
  operations.push(workspaceOperationSchema.parse({
    type: 'update_operational_profile',
    variantId: newVariantId,
    patch: draft.profile,
  }))
  catalogIds.forEach((catalogId, index) => operations.push(workspaceOperationSchema.parse({
    type: 'add_component',
    variantId: newVariantId,
    componentId: componentIds[index],
    catalogId,
    position: { xMm: 500 + (index % 4) * 1_200, yMm: 500 + Math.floor(index / 4) * 1_200 },
  })))
  operations.push(workspaceOperationSchema.parse({ type: 'activate_layout', variantId: newVariantId }))
  return operations
}

export function submitLayoutWizardDraft<TResult>(
  draft: LayoutWizardDraft | null,
  context: LayoutWizardBuildContext,
  applyOperations: (operations: readonly WorkspaceOperation[], intent: string) => TResult,
): TResult | { ok: false; code: 'wizard-cancelled' } {
  if (draft === null) return { ok: false, code: 'wizard-cancelled' }
  return applyOperations(buildLayoutWizardOperations(draft, context), `Create layout ${draft.name.trim()}`)
}
