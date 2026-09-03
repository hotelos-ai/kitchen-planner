import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import type { Architecture, Opening, Pillar, StorageZone } from '../domain/project'
import { appStateStore } from '../state/app-state-store'
import type { WebMcpToolDefinition } from './model-context'
import {
  currentRevision,
  diagnosticsSummary,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

export type ArchitectureToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
}

const idSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'IDs may contain only letters, numbers, dots, underscores, colons, and hyphens')
const labelSchema = z.string().trim().min(1).max(160)
const coordinateSchema = z.number().finite().nonnegative().max(1_000_000)
const dimensionSchema = z.number().finite().positive().max(100_000)
const nullableDimensionSchema = z.union([dimensionSchema, z.null()])

const pointSchema = z.object({ xMm: coordinateSchema, yMm: coordinateSchema }).strict()
const openingSchema = z.object({
  id: idSchema,
  label: labelSchema,
  kind: z.enum(['door', 'service-window', 'sealed-opening']),
  wall: z.enum(['top', 'right', 'bottom', 'left']),
  segmentIndex: z.number().int().nonnegative().max(999).optional(),
  offsetMm: coordinateSchema,
  widthMm: dimensionSchema,
  sillHeightMm: coordinateSchema.optional(),
  heightMm: dimensionSchema.optional(),
  flow: z.enum(['entry', 'clean-out', 'dirty-in', 'closed']).optional(),
  swingDepthMm: coordinateSchema.optional(),
}).strict()
const pillarSchema = z.object({
  id: idSchema,
  xMm: coordinateSchema,
  yMm: coordinateSchema,
  widthMm: dimensionSchema,
  depthMm: dimensionSchema,
}).strict()
const storageZoneSchema = z.object({
  id: idSchema,
  label: labelSchema,
  xMm: coordinateSchema,
  yMm: coordinateSchema,
  widthMm: dimensionSchema,
  depthMm: dimensionSchema,
  adjacent: z.boolean(),
}).strict()

const roomPatchSchema = z.object({
  widthMm: dimensionSchema.optional(),
  depthMm: dimensionSchema.optional(),
  wallHeightMm: dimensionSchema.optional(),
  roomPolygon: z.array(pointSchema).min(3).max(1_000).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Room patch cannot be empty')
const openingPatchSchema = z.object({
  label: labelSchema.optional(),
  kind: z.enum(['door', 'service-window', 'sealed-opening']).optional(),
  wall: z.enum(['top', 'right', 'bottom', 'left']).optional(),
  segmentIndex: z.union([z.number().int().nonnegative().max(999), z.null()]).optional(),
  offsetMm: coordinateSchema.optional(),
  widthMm: dimensionSchema.optional(),
  sillHeightMm: z.union([coordinateSchema, z.null()]).optional(),
  heightMm: nullableDimensionSchema.optional(),
  flow: z.union([z.enum(['entry', 'clean-out', 'dirty-in', 'closed']), z.null()]).optional(),
  swingDepthMm: z.union([coordinateSchema, z.null()]).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Opening patch cannot be empty')
const pillarPatchSchema = z.object({
  xMm: coordinateSchema.optional(),
  yMm: coordinateSchema.optional(),
  widthMm: dimensionSchema.optional(),
  depthMm: dimensionSchema.optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Pillar patch cannot be empty')
const storageZonePatchSchema = z.object({
  label: labelSchema.optional(),
  xMm: coordinateSchema.optional(),
  yMm: coordinateSchema.optional(),
  widthMm: dimensionSchema.optional(),
  depthMm: dimensionSchema.optional(),
  adjacent: z.boolean().optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, 'Storage-zone patch cannot be empty')

const architectureEditSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('update_room'), patch: roomPatchSchema }).strict(),
  z.object({ type: z.literal('add_opening'), opening: openingSchema }).strict(),
  z.object({ type: z.literal('update_opening'), id: idSchema, patch: openingPatchSchema }).strict(),
  z.object({ type: z.literal('remove_opening'), id: idSchema }).strict(),
  z.object({ type: z.literal('add_pillar'), pillar: pillarSchema }).strict(),
  z.object({ type: z.literal('update_pillar'), id: idSchema, patch: pillarPatchSchema }).strict(),
  z.object({ type: z.literal('remove_pillar'), id: idSchema }).strict(),
  z.object({ type: z.literal('add_storage_zone'), storageZone: storageZoneSchema }).strict(),
  z.object({ type: z.literal('update_storage_zone'), id: idSchema, patch: storageZonePatchSchema }).strict(),
  z.object({ type: z.literal('remove_storage_zone'), id: idSchema }).strict(),
])

const editArchitectureInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  variantId: idSchema.optional(),
  operations: z.array(architectureEditSchema).min(1).max(200),
  intent: z.string().trim().min(1).max(2_000).optional(),
}).strict()

type ArchitectureEdit = z.infer<typeof architectureEditSchema>
type ArchitectureElement = Opening | Pillar | StorageZone

type FacadeFailure = {
  ok: false
  revision: number
  code: string
  message: string
  issues?: unknown
  operationIndex?: number
}

type FacadePreview = {
  ok: true
  revision: number
  previewToken: string
  warnings: string[]
  diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] }
}

type FacadeApply = {
  ok: true
  revision: number
  warnings: string[]
  diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] }
}

const isFailure = (result: unknown): result is FacadeFailure =>
  typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false

function objectSchema(required: string[], properties: Record<string, unknown>) {
  return { type: 'object', additionalProperties: false, required, properties }
}

const enumSchema = (values: string[]) => ({ type: 'string', enum: values })
const nullableNumber = { type: ['number', 'null'] }
const pointJsonSchema = () => objectSchema(['xMm', 'yMm'], { xMm: { type: 'number' }, yMm: { type: 'number' } })
const roomJsonSchema = () => objectSchema([], {
  widthMm: { type: 'number' }, depthMm: { type: 'number' }, wallHeightMm: { type: 'number' },
  roomPolygon: { type: 'array', minItems: 3, items: pointJsonSchema() },
})
const openingFields = (patch: boolean) => ({
  ...(!patch ? { id: { type: 'string' } } : {}),
  label: { type: 'string' },
  kind: enumSchema(['door', 'service-window', 'sealed-opening']),
  wall: enumSchema(['top', 'right', 'bottom', 'left']),
  segmentIndex: patch ? nullableNumber : { type: 'number' },
  offsetMm: { type: 'number' }, widthMm: { type: 'number' },
  sillHeightMm: patch ? nullableNumber : { type: 'number' },
  heightMm: patch ? nullableNumber : { type: 'number' },
  flow: patch ? { type: ['string', 'null'], enum: ['entry', 'clean-out', 'dirty-in', 'closed', null] } : enumSchema(['entry', 'clean-out', 'dirty-in', 'closed']),
  swingDepthMm: patch ? nullableNumber : { type: 'number' },
})
const openingJsonSchema = () => objectSchema(['id', 'label', 'kind', 'wall', 'offsetMm', 'widthMm'], openingFields(false))
const openingPatchJsonSchema = () => objectSchema([], openingFields(true))
const rectFields = (includeId: boolean) => ({
  ...(includeId ? { id: { type: 'string' } } : {}),
  xMm: { type: 'number' }, yMm: { type: 'number' }, widthMm: { type: 'number' }, depthMm: { type: 'number' },
})
const pillarJsonSchema = () => objectSchema(['id', 'xMm', 'yMm', 'widthMm', 'depthMm'], rectFields(true))
const pillarPatchJsonSchema = () => objectSchema([], rectFields(false))
const storageZoneJsonSchema = () => objectSchema(['id', 'label', 'xMm', 'yMm', 'widthMm', 'depthMm', 'adjacent'], { ...rectFields(true), label: { type: 'string' }, adjacent: { type: 'boolean' } })
const storageZonePatchJsonSchema = () => objectSchema([], { ...rectFields(false), label: { type: 'string' }, adjacent: { type: 'boolean' } })

const inputSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  required: ['expectedRevision', 'operations'],
  properties: {
    expectedRevision: { type: 'number', description: 'Revision returned by the latest read; a mismatch rejects the whole edit.' },
    variantId: { type: 'string', description: 'Layout to edit; defaults to the active layout.' },
    intent: { type: 'string', description: 'Short human-readable reason for the edit.' },
    operations: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      description: 'Granular architecture edits, applied in order and committed together.',
      items: {
        oneOf: [
          objectSchema(['type', 'patch'], { type: enumSchema(['update_room']), patch: roomJsonSchema() }),
          objectSchema(['type', 'opening'], { type: enumSchema(['add_opening']), opening: openingJsonSchema() }),
          objectSchema(['type', 'id', 'patch'], { type: enumSchema(['update_opening']), id: { type: 'string' }, patch: openingPatchJsonSchema() }),
          objectSchema(['type', 'id'], { type: enumSchema(['remove_opening']), id: { type: 'string' } }),
          objectSchema(['type', 'pillar'], { type: enumSchema(['add_pillar']), pillar: pillarJsonSchema() }),
          objectSchema(['type', 'id', 'patch'], { type: enumSchema(['update_pillar']), id: { type: 'string' }, patch: pillarPatchJsonSchema() }),
          objectSchema(['type', 'id'], { type: enumSchema(['remove_pillar']), id: { type: 'string' } }),
          objectSchema(['type', 'storageZone'], { type: enumSchema(['add_storage_zone']), storageZone: storageZoneJsonSchema() }),
          objectSchema(['type', 'id', 'patch'], { type: enumSchema(['update_storage_zone']), id: { type: 'string' }, patch: storageZonePatchJsonSchema() }),
          objectSchema(['type', 'id'], { type: enumSchema(['remove_storage_zone']), id: { type: 'string' } }),
        ],
      },
    },
  },
}

const allElementIds = (architecture: Architecture) => new Set([
  ...architecture.openings.map((value) => value.id),
  ...architecture.pillars.map((value) => value.id),
  ...architecture.storageZones.map((value) => value.id),
])

const replaceById = <T extends ArchitectureElement>(values: T[], id: string, replacement: T): T[] =>
  values.map((value) => value.id === id ? replacement : value)

const withoutId = <T extends ArchitectureElement>(values: T[], id: string): T[] =>
  values.filter((value) => value.id !== id)

const withNullablePatch = <T extends ArchitectureElement>(value: T, patch: object): T => {
  const candidate = { ...value } as Record<string, unknown>
  for (const [key, next] of Object.entries(patch)) {
    if (next === null) delete candidate[key]
    else candidate[key] = next
  }
  return candidate as unknown as T
}

const findById = <T extends ArchitectureElement>(values: T[], id: string): T | undefined =>
  values.find((value) => value.id === id)

const isCanonicalRectangle = (architecture: Architecture): boolean => {
  const expected = [
    { x: 0, y: 0 },
    { x: architecture.widthMm, y: 0 },
    { x: architecture.widthMm, y: architecture.depthMm },
    { x: 0, y: architecture.depthMm },
  ]
  return architecture.roomPolygon.length === expected.length
    && architecture.roomPolygon.every((point, index) => point.x === expected[index].x && point.y === expected[index].y)
}

type EditFailure = { code: string; message: string; operationIndex?: number }

const editFailure = (code: string, message: string, operationIndex?: number): EditFailure => ({
  code,
  message,
  ...(operationIndex === undefined ? {} : { operationIndex }),
})

const applyEdits = (
  source: Architecture,
  edits: ArchitectureEdit[],
  lockedElementIds: ReadonlySet<string>,
): { architecture: Architecture; changedIds: string[] } | EditFailure => {
  let architecture = structuredClone(source)
  const changedIds: string[] = []

  for (let operationIndex = 0; operationIndex < edits.length; operationIndex += 1) {
    const edit = edits[operationIndex]
    if (edit.type === 'update_room') {
      if (lockedElementIds.has('room')) return editFailure('locked-architecture-element', 'The room geometry is locked.', operationIndex)
      const patch = edit.patch
      const changesDimensions = patch.widthMm !== undefined || patch.depthMm !== undefined
      if (changesDimensions && patch.roomPolygon === undefined && !isCanonicalRectangle(architecture)) {
        return editFailure('room-polygon-required', 'Changing the dimensions of a non-rectangular room requires an explicit roomPolygon.', operationIndex)
      }
      const widthMm = patch.widthMm ?? architecture.widthMm
      const depthMm = patch.depthMm ?? architecture.depthMm
      const roomPolygon = patch.roomPolygon
        ? patch.roomPolygon.map((point) => ({ x: point.xMm, y: point.yMm }))
        : changesDimensions
          ? [{ x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: depthMm }, { x: 0, y: depthMm }]
          : architecture.roomPolygon
      const inferredWidth = patch.roomPolygon && patch.widthMm === undefined ? Math.max(...roomPolygon.map((point) => point.x)) : widthMm
      const inferredDepth = patch.roomPolygon && patch.depthMm === undefined ? Math.max(...roomPolygon.map((point) => point.y)) : depthMm
      if (inferredWidth <= 0 || inferredDepth <= 0 || roomPolygon.some((point) => point.x > inferredWidth || point.y > inferredDepth)) {
        return editFailure('invalid-room-geometry', 'Room vertices must fit within positive widthMm and depthMm bounds.', operationIndex)
      }
      architecture = { ...architecture, ...patch, widthMm: inferredWidth, depthMm: inferredDepth, roomPolygon }
      changedIds.push('room')
      continue
    }

    const targetId = 'id' in edit ? edit.id : edit.type === 'add_opening'
      ? edit.opening.id : edit.type === 'add_pillar' ? edit.pillar.id : edit.storageZone.id
    if (lockedElementIds.has(targetId)) return editFailure('locked-architecture-element', `Architecture element ${targetId} is locked.`, operationIndex)

    if (edit.type === 'add_opening' || edit.type === 'add_pillar' || edit.type === 'add_storage_zone') {
      if (allElementIds(architecture).has(targetId)) return editFailure('duplicate-id', `Architecture element ${targetId} already exists.`, operationIndex)
    }

    switch (edit.type) {
      case 'add_opening':
        architecture.openings.push(edit.opening)
        break
      case 'update_opening': {
        const value = findById(architecture.openings, edit.id)
        if (!value) return editFailure('missing-architecture-element', `Opening ${edit.id} does not exist.`, operationIndex)
        architecture.openings = replaceById(architecture.openings, edit.id, withNullablePatch(value, edit.patch))
        break
      }
      case 'remove_opening':
        if (!findById(architecture.openings, edit.id)) return editFailure('missing-architecture-element', `Opening ${edit.id} does not exist.`, operationIndex)
        architecture.openings = withoutId(architecture.openings, edit.id)
        break
      case 'add_pillar':
        architecture.pillars.push(edit.pillar)
        break
      case 'update_pillar': {
        const value = findById(architecture.pillars, edit.id)
        if (!value) return editFailure('missing-architecture-element', `Pillar ${edit.id} does not exist.`, operationIndex)
        architecture.pillars = replaceById(architecture.pillars, edit.id, withNullablePatch(value, edit.patch))
        break
      }
      case 'remove_pillar':
        if (!findById(architecture.pillars, edit.id)) return editFailure('missing-architecture-element', `Pillar ${edit.id} does not exist.`, operationIndex)
        architecture.pillars = withoutId(architecture.pillars, edit.id)
        break
      case 'add_storage_zone':
        architecture.storageZones.push(edit.storageZone)
        break
      case 'update_storage_zone': {
        const value = findById(architecture.storageZones, edit.id)
        if (!value) return editFailure('missing-architecture-element', `Storage zone ${edit.id} does not exist.`, operationIndex)
        architecture.storageZones = replaceById(architecture.storageZones, edit.id, withNullablePatch(value, edit.patch))
        break
      }
      case 'remove_storage_zone':
        if (!findById(architecture.storageZones, edit.id)) return editFailure('missing-architecture-element', `Storage zone ${edit.id} does not exist.`, operationIndex)
        architecture.storageZones = withoutId(architecture.storageZones, edit.id)
        break
    }
    changedIds.push(targetId)
  }

  return { architecture, changedIds: [...new Set(changedIds)] }
}

const workspacePatch = (architecture: Architecture) => ({
  widthMm: architecture.widthMm,
  depthMm: architecture.depthMm,
  wallHeightMm: architecture.wallHeightMm,
  roomPolygon: architecture.roomPolygon.map((point) => ({ xMm: point.x, yMm: point.y })),
  openings: architecture.openings,
  pillars: architecture.pillars,
  storageZones: architecture.storageZones,
})

/**
 * A direct, revision-guarded architecture editor. Granular edits are resolved
 * against one snapshot and compiled to one ordinary workspace operation, so
 * validation, commit atomicity, and undo behavior stay owned by the workspace.
 */
export function createArchitectureTools(deps: ArchitectureToolDependencies): WebMcpToolDefinition[] {
  return [{
    name: 'edit_architecture',
    title: 'Edit room architecture',
    description: 'Directly edit room dimensions, openings, pillars, and storage zones. All ordered edits are validated and committed atomically as one revision and one undo step. Honors architecture locks and requires expectedRevision.',
    inputSchema,
    execute: (input) => {
      try {
        const parsed = parseInput(deps, editArchitectureInput, input)
        if (!parsed.ok) return failure(parsed.revision, 'invalid-input', 'Invalid architecture edit request.', parsed.issues)

        const state = deps.store.getState()
        if (state.revision !== parsed.value.expectedRevision) {
          return failure(state.revision, 'stale-revision', `Expected revision ${parsed.value.expectedRevision}, received ${state.revision}.`)
        }
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', 'The requested layout does not exist.')
        if (variant.architecture.locked) {
          return failure(state.revision, 'locked-architecture', 'Architecture must be explicitly unlocked before it can be changed.')
        }

        const appState = appStateStore.getState()
        appState.setOverlay(null)
        appState.setView('plan')
        appState.setStage('space')

        const edited = applyEdits(
          variant.architecture,
          parsed.value.operations,
          new Set(variant.layoutConstraints?.lockedArchitectureElementIds ?? []),
        )
        if ('code' in edited) return failure(state.revision, edited.code, edited.message, edited.operationIndex === undefined ? undefined : { operationIndex: edited.operationIndex })

        const operation = { type: 'update_architecture', variantId: variant.id, patch: workspacePatch(edited.architecture) }
        const facade = deps.getFacade()
        const intent = parsed.value.intent ?? 'Agent edited the kitchen architecture'
        const preview = facade.previewLayoutChanges({
          expectedRevision: parsed.value.expectedRevision,
          operations: [operation],
          intent,
          source: 'agent',
        }) as FacadePreview | FacadeFailure
        if (isFailure(preview)) return failure(preview.revision, preview.code, preview.message, {
          ...(preview.operationIndex === undefined ? {} : { operationIndex: preview.operationIndex }),
          ...(preview.issues === undefined ? {} : { issues: preview.issues }),
        })

        const applied = facade.applyLayoutChanges({ previewToken: preview.previewToken }) as FacadeApply | FacadeFailure
        if (isFailure(applied)) return failure(applied.revision, applied.code, applied.message)
        const committed = deps.store.getState()
        appStateStore.getState().setLastAgentAction({
          id: `agent-action-${committed.documentId}-${applied.revision}`,
          documentId: committed.documentId,
          intent,
          changedIds: [...edited.changedIds],
          revision: applied.revision,
        })
        return success(applied.revision, {
          variantId: variant.id,
          changedIds: edited.changedIds,
          warnings: applied.warnings,
          diagnostics: diagnosticsSummary(applied.diagnostics),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }]
}
