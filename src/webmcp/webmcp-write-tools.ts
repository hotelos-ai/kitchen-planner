import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { workspaceOperationSchema } from '../core/workspace/workspace-operation'
import { appStateStore } from '../state/app-state-store'
import type { JsonSchemaObject, WebMcpToolDefinition } from './model-context'
import {
  currentRevision,
  diagnosticsSummary,
  failure,
  parseInput,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

export type WriteToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
}

const previewInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  operations: z.array(workspaceOperationSchema).min(1).max(200),
  intent: z.string().max(2_000).optional(),
}).strict()

const applyInput = z.object({
  previewToken: z.string().min(1).max(200).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  operations: z.array(workspaceOperationSchema).min(1).max(200).optional(),
  intent: z.string().max(2_000).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
}).strict().superRefine((input, context) => {
  const directFields = input.expectedRevision !== undefined || input.operations !== undefined || input.idempotencyKey !== undefined
  if (input.previewToken && directFields) context.addIssue({ code: 'custom', message: 'Use either previewToken or direct batch fields, not both.' })
  if (!input.previewToken) {
    if (input.expectedRevision === undefined) context.addIssue({ code: 'custom', path: ['expectedRevision'], message: 'expectedRevision is required for direct apply.' })
    if (!input.operations) context.addIssue({ code: 'custom', path: ['operations'], message: 'operations are required for direct apply.' })
  }
})

const historyInput = z.object({
  direction: z.enum(['undo', 'redo']),
}).strict()

export const workspaceOperationJsonSchema = z.toJSONSchema(workspaceOperationSchema, {
  target: 'draft-7',
}) as Record<string, unknown>
delete workspaceOperationJsonSchema.$schema

type Schema = Record<string, unknown>

const stringSchema: Schema = { type: 'string' }
const numberSchema: Schema = { type: 'number' }
const booleanSchema: Schema = { type: 'boolean' }
const strictObject = (properties: Record<string, unknown>, required: string[] = []): Schema => ({
  type: 'object',
  additionalProperties: false,
  ...(required.length === 0 ? {} : { required }),
  properties,
})
const strictPatch = (properties: Record<string, unknown>): Schema => ({ ...strictObject(properties), minProperties: 1 })
const operationBranch = (
  type: string | string[],
  properties: string[] = [],
  required: string[] = [],
): Schema => ({
  additionalProperties: false,
  required: ['type', 'variantId', ...required],
  properties: {
    type: Array.isArray(type) ? { type: 'string', enum: type } : { const: type },
    variantId: {},
    ...Object.fromEntries(properties.map((property) => [property, {}])),
  },
})

const componentPatchSchema = strictPatch({
  label: stringSchema, xMm: numberSchema, yMm: numberSchema,
  category: { type: 'string', enum: ['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom'] },
  heightMm: numberSchema, capabilities: { type: 'array', items: stringSchema },
  clearance: { type: 'object' },
  approximate: booleanSchema, notes: stringSchema,
})
const architecturePatchSchema = strictPatch({
  widthMm: numberSchema, depthMm: numberSchema, wallHeightMm: numberSchema,
  roomPolygon: { type: 'array', minItems: 3, items: { type: 'object' } },
  openings: { type: 'array', items: { type: 'object' } },
  pillars: { type: 'array', items: { type: 'object' } },
  storageZones: { type: 'array', items: { type: 'object' } },
  locked: booleanSchema,
})
const operationalProfilePatchSchema = strictPatch({
  covers: numberSchema, peakDurationMinutes: numberSchema, arrivalPattern: stringSchema, serviceStyle: stringSchema,
  menuAssumptions: { type: 'array', items: stringSchema },
  staff: { type: 'array', items: { type: 'object' } },
  targetCapacityPerHour: numberSchema,
})
const scenarioPatchSchema = strictPatch({
  name: stringSchema, covers: numberSchema, durationMinutes: numberSchema, arrivalPattern: stringSchema,
  cookToOrderRatio: numberSchema, seed: numberSchema, serviceStyle: stringSchema, variability: stringSchema,
  staff: { type: 'array', items: { type: 'object' } }, checks: { type: 'object' }, taskDurations: { type: 'object' },
  stationCapacities: { type: 'object' }, menuItems: { type: 'array', items: { type: 'object' } },
})

/** Compact registration-time schema. Runtime parsing still applies every detailed numeric and enum constraint. */
export const registeredWorkspaceOperationSchema: Schema = {
  type: 'object',
  oneOf: [
    operationBranch('create_layout', ['name', 'parentVariantId', 'equipmentMode'], ['name', 'equipmentMode']),
    operationBranch(['activate_layout', 'remove_layout']),
    operationBranch('rename_layout', ['name'], ['name']),
    operationBranch('add_component', ['componentId', 'catalogId', 'position', 'dimensions', 'rotationDeg', 'configurationId', 'skinId'], ['componentId', 'catalogId', 'position']),
    operationBranch('add_custom_component', ['componentId', 'label', 'position', 'dimensions', 'rotationDeg', 'capabilities'], ['componentId', 'label', 'position', 'dimensions']),
    operationBranch('configure_component', ['componentId', 'configurationId'], ['componentId', 'configurationId']),
    operationBranch('skin_component', ['componentId', 'skinId'], ['componentId', 'skinId']),
    operationBranch('update_component', ['componentId', 'patch'], ['componentId', 'patch']),
    operationBranch('move_components', ['componentIds', 'anchor'], ['componentIds', 'anchor']),
    operationBranch('nudge_components', ['componentIds', 'delta'], ['componentIds', 'delta']),
    operationBranch('rotate_components', ['componentIds', 'deltaDeg'], ['componentIds', 'deltaDeg']),
    operationBranch('resize_component', ['componentId', 'dimensions'], ['componentId', 'dimensions']),
    operationBranch('set_component_dimensions_lock', ['componentId', 'locked'], ['componentId', 'locked']),
    operationBranch('duplicate_components', ['components', 'offset'], ['components']),
    operationBranch('lock_components', ['componentIds', 'locked'], ['componentIds', 'locked']),
    operationBranch('remove_components', ['componentIds'], ['componentIds']),
    operationBranch('add_opening', ['opening'], ['opening']),
    operationBranch('add_pillar', ['pillar'], ['pillar']),
    operationBranch('add_storage_zone', ['storageZone'], ['storageZone']),
    operationBranch(['update_opening', 'update_pillar', 'update_storage_zone'], ['id', 'patch'], ['id', 'patch']),
    operationBranch(['remove_opening', 'remove_pillar', 'remove_storage_zone'], ['id'], ['id']),
    operationBranch('update_architecture', ['patch'], ['patch']),
    operationBranch('update_operational_profile', ['patch'], ['patch']),
    operationBranch('update_workspace_settings', ['patch'], ['patch']),
    operationBranch('update_scenario', ['scenarioId', 'patch'], ['scenarioId', 'patch']),
    operationBranch('adopt_auto_layout_result', ['runId', 'resultId', 'newVariantId', 'name'], ['runId', 'resultId', 'newVariantId', 'name']),
  ],
  allOf: [{
    if: { properties: { type: { const: 'update_component' } } },
    then: { properties: { patch: componentPatchSchema } },
  }, {
    if: { properties: { type: { const: 'update_architecture' } } },
    then: { properties: { patch: architecturePatchSchema } },
  }, {
    if: { properties: { type: { const: 'update_operational_profile' } } },
    then: { properties: { patch: operationalProfilePatchSchema } },
  }, {
    if: { properties: { type: { const: 'update_workspace_settings' } } },
    then: { properties: { patch: strictPatch({ displayUnit: stringSchema, snapMm: numberSchema }) } },
  }, {
    if: { properties: { type: { const: 'update_scenario' } } },
    then: { properties: { patch: scenarioPatchSchema } },
  }],
}

const operationsSchema: Schema = { type: 'array', minItems: 1, maxItems: 200, items: registeredWorkspaceOperationSchema }

const operationSchemaDescription: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedRevision', 'operations'],
  properties: {
    expectedRevision: { type: 'number', description: 'Revision read from get_layout or get_workspace_guide; stale writes fail.' },
    operations: {
      ...operationsSchema,
      description: 'Ordered atomic batch. See get_workspace_guide for numeric constraints. Any invalid item rejects the batch.',
    },
    intent: { type: 'string', description: 'Optional history label.' },
  },
}

type PreviewResult = { ok: true; revision: number; previewToken: string; changedIds: string[]; warnings: string[]; normalizedOperations: unknown[]; diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] } }

type ApplyResult = { ok: true; revision: number; changedIds: string[]; warnings: string[]; diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] }; intent?: string }

type FacadeFailure = { ok: false; revision: number; code: string; message: string; issues?: unknown; operationIndex?: number }

const isFacadeFailure = (result: unknown): result is FacadeFailure =>
  typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false

const applyRecoveryHint = (code: string): string => {
  if (code === 'preview-revision-changed' || code === 'stale-revision') return 'The plan changed after this preview. Re-read the layout with get_layout and preview again.'
  if (code === 'used-preview-token') return 'Each token commits once. Preview the batch again for a fresh token.'
  if (code === 'expired-preview-token') return 'Tokens expire after ten minutes. Preview the batch again.'
  return 'Re-read the current layout and preview the batch again before applying.'
}

export function createWriteTools(deps: WriteToolDependencies): WebMcpToolDefinition[] {
  const directResults = new Map<string, { signature: string; result: ApplyResult }>()
  const previewLayoutChanges: WebMcpToolDefinition = {
    name: 'preview_layout_changes',
    title: 'Preview layout changes',
    description:
      'Validate an operation batch without mutation. Returns a single-use previewToken bound to its batch and revision, with changed IDs, warnings, normalized operations, and diagnostics. Commit it with apply_layout_changes.',
    inputSchema: operationSchemaDescription,
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, previewInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid preview request. Operations must match the workspace operation schema.', parsed.issues)
        const intent = parsed.value.intent?.trim() || 'Agent workspace update'
        const result = deps.getFacade().previewLayoutChanges({
          expectedRevision: parsed.value.expectedRevision,
          operations: parsed.value.operations,
          intent,
          source: 'agent',
        }) as PreviewResult | FacadeFailure
        if (isFacadeFailure(result)) {
          return {
            ok: false as const,
            revision: result.revision,
            code: result.code,
            message: result.message,
            ...(result.issues === undefined ? {} : { issues: result.issues }),
            ...(result.operationIndex === undefined ? {} : { operationIndex: result.operationIndex }),
          }
        }
        return success(result.revision, {
          previewToken: result.previewToken,
          changedIds: result.changedIds,
          warnings: result.warnings,
          normalizedOperations: result.normalizedOperations,
          diagnostics: diagnosticsSummary(result.diagnostics),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const applyLayoutChanges: WebMcpToolDefinition = {
    name: 'apply_layout_changes',
    title: 'Apply layout changes',
    description:
      'Commit a preview token or direct revision-guarded batch. Optional keys deduplicate retries; identical keyless retries are also deduplicated. Each batch is one undo step.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      ...({
        oneOf: [
          { required: ['previewToken'] },
          { required: ['expectedRevision', 'operations'] },
        ],
      } as Record<string, unknown>),
      properties: {
        previewToken: { type: 'string', description: 'Single-use preview token; do not mix with direct fields.' },
        expectedRevision: { type: 'number', description: 'Latest revision for direct apply.' },
        operations: { ...operationsSchema, description: 'Direct operation batch.' },
        intent: { type: 'string', description: 'Optional history label.' },
        idempotencyKey: { type: 'string', description: 'Optional retry key.' },
      },
    },
    execute: (input, context) => {
      try {
        const parsed = parseInput(deps, applyInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid apply request.', parsed.issues)
        if (context?.signal?.aborted) return failure(currentRevision(deps), 'aborted', 'The apply request was cancelled before it started.')
        let previewToken = parsed.value.previewToken
        let signature: string | undefined
        let scopedIdempotencyKey: string | undefined
        if (!previewToken) {
          const scope = `${deps.store.getState().documentId}:${deps.store.getState().project.id}`
          const intent = parsed.value.intent?.trim() || 'Agent workspace update'
          signature = JSON.stringify({
            scope,
            expectedRevision: parsed.value.expectedRevision,
            operations: parsed.value.operations,
            intent,
          })
          scopedIdempotencyKey = parsed.value.idempotencyKey === undefined
            ? `${scope}:automatic:${signature}`
            : `${scope}:explicit:${parsed.value.idempotencyKey}`
          const cached = directResults.get(scopedIdempotencyKey)
          if (cached) {
            if (cached.signature !== signature) return failure(currentRevision(deps), 'idempotency-conflict', 'This idempotencyKey was already used for a different batch.')
            return success(currentRevision(deps), {
              originalRevision: cached.result.revision,
              changedIds: cached.result.changedIds,
              warnings: cached.result.warnings,
              diagnostics: diagnosticsSummary(cached.result.diagnostics),
              ...(cached.result.intent === undefined ? {} : { intent: cached.result.intent }),
              replayed: true,
            })
          }
          const preview = deps.getFacade().previewLayoutChanges({
            expectedRevision: parsed.value.expectedRevision!,
            operations: parsed.value.operations!,
            intent,
            source: 'agent',
          }) as PreviewResult | FacadeFailure
          if (isFacadeFailure(preview)) return { ...preview, recovery: applyRecoveryHint(preview.code) }
          previewToken = preview.previewToken
        }
        if (context?.signal?.aborted) return failure(currentRevision(deps), 'aborted', 'The apply request was cancelled before commit.')
        const result = deps.getFacade().applyLayoutChanges({ previewToken }) as ApplyResult | FacadeFailure
        if (isFacadeFailure(result)) {
          return {
            ok: false as const,
            revision: result.revision,
            code: result.code,
            message: result.message,
            recovery: applyRecoveryHint(result.code),
          }
        }
        const committedState = deps.store.getState()
        const activeEquipmentIds = new Set(
          committedState.project.variants
            .find((variant) => variant.id === committedState.project.activeVariantId)
            ?.equipment.map((item) => item.id) ?? [],
        )
        const visibleChangedIds = result.changedIds.filter((id) => activeEquipmentIds.has(id))
        if (visibleChangedIds.length > 0) committedState.selectItems(visibleChangedIds)
        if (result.intent) {
          appStateStore.getState().setLastAgentAction({
            id: `agent-action-${committedState.documentId}-${result.revision}`,
            documentId: committedState.documentId,
            intent: result.intent,
            changedIds: [...result.changedIds],
            revision: result.revision,
          })
        }
        if (signature) {
          directResults.set(scopedIdempotencyKey!, { signature, result })
          if (directResults.size > 100) directResults.delete(directResults.keys().next().value!)
        }
        return success(result.revision, {
          changedIds: result.changedIds,
          warnings: result.warnings,
          diagnostics: diagnosticsSummary(result.diagnostics),
          ...(result.intent === undefined ? {} : { intent: result.intent }),
          ...(signature === undefined ? {} : { replayed: false }),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const stepWorkspaceHistory: WebMcpToolDefinition = {
    name: 'step_workspace_history',
    title: 'Undo or redo',
    description: 'Undo or redo the last workspace step (human or agent edit alike). Each step consumes one undo/redo entry and increments the revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['direction'],
      properties: {
        direction: { type: 'string', enum: ['undo', 'redo'], description: 'Whether to undo or redo one step.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, historyInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid history request.', parsed.issues)
        const before = deps.store.getState()
        if (parsed.value.direction === 'undo' && before.past.length === 0) {
          return success(before.revision, { note: 'Nothing left to undo.', stepped: false })
        }
        if (parsed.value.direction === 'redo' && before.future.length === 0) {
          return success(before.revision, { note: 'Nothing to redo.', stepped: false })
        }
        if (parsed.value.direction === 'undo') before.undo()
        else before.redo()
        return success(deps.store.getState().revision, { stepped: true })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [previewLayoutChanges, applyLayoutChanges, stepWorkspaceHistory]
}
