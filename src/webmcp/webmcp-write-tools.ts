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

const strictObject = (properties: Record<string, unknown>, required: string[] = []): Schema => ({
  type: 'object',
  additionalProperties: false,
  ...(required.length === 0 ? {} : { required }),
  properties,
})
const strictPatch = (properties: Record<string, unknown>): Schema => ({ ...strictObject(properties), minProperties: 1 })
const ref = (name: string): Schema => ({ $ref: `#/$defs/${name}` })
const booleanSchema: Schema = { type: 'boolean' }
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] })
const operationBranch = (
  type: string | string[],
  properties: string[] = [],
  required: string[] = [],
): Schema => ({
  properties: { type: Array.isArray(type) ? { enum: type } : { const: type } },
  ...(required.length === 0 ? {} : { required }),
  propertyNames: { enum: ['type', 'variantId', ...properties] },
})

const capabilityEnum = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep', 'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash', 'mix']
const rectProperties = { id: ref('i'), xMm: ref('x'), yMm: ref('x'), widthMm: ref('d'), depthMm: ref('d') }
const workspaceOperationDefinitions: Record<string, Schema> = {
  i: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' },
  n: { type: 'string', minLength: 1, maxLength: 160 },
  x: { type: 'number', minimum: -1_000_000, maximum: 1_000_000 },
  a: { type: 'number', minimum: 0, maximum: 1_000_000 },
  k: { type: 'number', minimum: 0, maximum: 100_000 },
  d: { type: 'number', exclusiveMinimum: 0, maximum: 100_000 },
  r: { type: 'number', minimum: -1_000_000, maximum: 1_000_000 },
  p: strictObject({ xMm: ref('x'), yMm: ref('x') }, ['xMm', 'yMm']),
  z: strictObject({ widthMm: ref('d'), depthMm: ref('d'), heightMm: ref('d') }, ['widthMm', 'depthMm']),
  c: { type: 'string', enum: capabilityEnum },
  l: strictObject({ frontMm: ref('k'), leftMm: ref('k'), rightMm: ref('k'), backMm: ref('k'), kind: { enum: ['work', 'door-swing', 'heat', 'service'] } }, ['frontMm', 'kind']),
  o: strictObject({
    id: ref('i'), label: ref('n'), kind: { enum: ['door', 'service-window', 'sealed-opening'] }, wall: { enum: ['top', 'right', 'bottom', 'left'] },
    segmentIndex: { type: 'integer', minimum: 0, maximum: 999 }, offsetMm: ref('a'), widthMm: ref('d'), sillHeightMm: ref('k'),
    heightMm: ref('d'), flow: { enum: ['entry', 'clean-out', 'dirty-in', 'closed'] }, swingDepthMm: ref('k'),
  }, ['id', 'label', 'kind', 'wall', 'offsetMm', 'widthMm']),
  q: strictObject({ ...rectProperties, shape: { const: 'round' } }, ['id', 'xMm', 'yMm', 'widthMm', 'depthMm']),
  Q: strictObject({ id: ref('i'), xMm: ref('a'), yMm: ref('a'), widthMm: ref('d'), depthMm: ref('d') }, ['id', 'xMm', 'yMm', 'widthMm', 'depthMm']),
  g: strictObject({ ...rectProperties, label: ref('n'), adjacent: booleanSchema }, ['id', 'xMm', 'yMm', 'widthMm', 'depthMm', 'label', 'adjacent']),
  H: strictObject({ id: ref('i'), xMm: ref('a'), yMm: ref('a'), widthMm: ref('d'), depthMm: ref('d'), label: ref('n'), adjacent: booleanSchema }, ['id', 'xMm', 'yMm', 'widthMm', 'depthMm', 'label', 'adjacent']),
  u: strictObject({ componentId: ref('i'), duplicateId: ref('i') }, ['componentId', 'duplicateId']),
  f: strictObject({ role: { enum: ['head-chef', 'sous-chef', 'cdp', 'busser-washer'] }, count: { type: 'integer', minimum: 0, maximum: 100 } }, ['role', 'count']),
  v: strictObject({ role: { enum: ['head-chef', 'sous-chef', 'cdp', 'busser-washer'] }, count: { type: 'integer', minimum: 0 } }, ['role', 'count']),
  t: strictObject({ minSeconds: { type: 'number', exclusiveMinimum: 0, maximum: 86_400 }, maxSeconds: { type: 'number', exclusiveMinimum: 0, maximum: 86_400 } }, ['minSeconds', 'maxSeconds']),
  m: strictObject({ label: ref('n'), capability: ref('c'), activeSeconds: { type: 'number', exclusiveMinimum: 0, maximum: 86_400 }, passiveSeconds: ref('t') }, ['label', 'capability', 'activeSeconds']),
  e: strictObject({ id: ref('i'), name: ref('n'), sharePct: { type: 'number', minimum: 0, maximum: 100 }, source: { enum: ['user-provided', 'imported', 'template-estimate', 'system-inferred'] }, steps: { type: 'array', minItems: 1, maxItems: 24, items: ref('m') } }, ['id', 'name', 'sharePct', 'source', 'steps']),
  C: strictPatch({ label: ref('n'), xMm: ref('x'), yMm: ref('x'), category: { enum: ['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom'] }, heightMm: ref('d'), capabilities: { type: 'array', maxItems: 100, items: ref('c') }, clearance: ref('l'), approximate: booleanSchema, notes: { type: 'string', maxLength: 4000 } }),
  O: strictPatch({ label: ref('n'), kind: { enum: ['door', 'service-window', 'sealed-opening'] }, wall: { enum: ['top', 'right', 'bottom', 'left'] }, segmentIndex: nullable({ type: 'integer', minimum: 0, maximum: 999 }), offsetMm: ref('a'), widthMm: ref('d'), sillHeightMm: nullable(ref('a')), heightMm: nullable(ref('d')), flow: nullable({ enum: ['entry', 'clean-out', 'dirty-in', 'closed'] }), swingDepthMm: nullable(ref('a')) }),
  P: strictPatch({ xMm: ref('a'), yMm: ref('a'), widthMm: ref('d'), depthMm: ref('d') }),
  G: strictPatch({ xMm: ref('a'), yMm: ref('a'), widthMm: ref('d'), depthMm: ref('d'), label: ref('n'), adjacent: booleanSchema }),
  A: strictPatch({ widthMm: ref('d'), depthMm: ref('d'), wallHeightMm: ref('d'), roomPolygon: { type: 'array', minItems: 3, maxItems: 1000, items: ref('p') }, openings: { type: 'array', maxItems: 1000, items: ref('o') }, pillars: { type: 'array', maxItems: 1000, items: ref('q') }, storageZones: { type: 'array', maxItems: 1000, items: ref('g') }, locked: booleanSchema }),
  F: strictPatch({ covers: { type: 'integer', exclusiveMinimum: 0 }, peakDurationMinutes: { type: 'number', exclusiveMinimum: 0 }, arrivalPattern: { enum: ['seating-wave', 'steady', 'two-waves'] }, serviceStyle: { type: 'string', minLength: 1 }, menuAssumptions: { type: 'array', items: { type: 'string', minLength: 1 } }, staff: { type: 'array', items: ref('v') }, targetCapacityPerHour: { type: 'number', exclusiveMinimum: 0 } }),
  W: strictPatch({ displayUnit: { enum: ['mm', 'cm', 'in', 'ft'] }, snapMm: ref('d') }),
  S: strictPatch({ name: ref('n'), covers: { type: 'integer', minimum: 1, maximum: 100_000 }, durationMinutes: { type: 'number', exclusiveMinimum: 0, maximum: 10_080 }, arrivalPattern: { enum: ['seating-wave', 'steady', 'two-waves'] }, cookToOrderRatio: { type: 'number', minimum: 0, maximum: 1 }, seed: { type: 'integer', minimum: -2_147_483_648, maximum: 2_147_483_647 }, staff: { type: 'array', minItems: 1, maxItems: 100, items: ref('f') }, checks: strictPatch({ collisions: booleanSchema, doorSwings: booleanSchema, dirtyCleanCrossings: booleanSchema }), taskDurations: { type: 'object', propertyNames: { enum: capabilityEnum }, additionalProperties: ref('t') }, stationCapacities: { type: 'object', propertyNames: ref('i'), additionalProperties: { type: 'integer', minimum: 1, maximum: 100 } }, serviceStyle: ref('n'), variability: { enum: ['low', 'typical', 'high'] }, menuItems: { type: 'array', maxItems: 200, items: ref('e') } }),
}

const operationProperties: Record<string, Schema> = {
  type: { type: 'string' }, variantId: ref('i'), name: ref('n'), parentVariantId: ref('i'), equipmentMode: { enum: ['duplicate', 'empty'] },
  componentId: ref('i'), catalogId: ref('i'), position: ref('p'), dimensions: ref('z'), rotationDeg: ref('r'),
  configurationId: ref('i'), skinId: ref('i'), label: ref('n'), capabilities: { type: 'array', maxItems: 100, items: ref('i') },
  patch: { anyOf: ['C', 'O', 'P', 'G', 'A', 'F', 'W', 'S'].map(ref) }, componentIds: { type: 'array', minItems: 1, maxItems: 500, uniqueItems: true, items: ref('i') },
  anchor: ref('p'), delta: ref('p'), deltaDeg: ref('r'), locked: booleanSchema,
  components: { type: 'array', minItems: 1, maxItems: 500, items: ref('u') }, offset: ref('p'),
  opening: ref('o'), pillar: ref('Q'), storageZone: ref('H'), id: ref('i'), scenarioId: ref('i'), runId: ref('i'), resultId: ref('i'), newVariantId: ref('i'),
}

/** Compact registration-time schema. Runtime parsing still applies every detailed numeric and enum constraint. */
export const registeredWorkspaceOperationSchema: Schema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'variantId'],
  properties: operationProperties,
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
    then: { properties: { patch: ref('C') } },
  }, {
    if: { properties: { type: { const: 'update_opening' } } },
    then: { properties: { patch: ref('O') } },
  }, {
    if: { properties: { type: { const: 'update_pillar' } } },
    then: { properties: { patch: ref('P') } },
  }, {
    if: { properties: { type: { const: 'update_storage_zone' } } },
    then: { properties: { patch: ref('G') } },
  }, {
    if: { properties: { type: { const: 'update_architecture' } } },
    then: { properties: { patch: ref('A') } },
  }, {
    if: { properties: { type: { const: 'update_operational_profile' } } },
    then: { properties: { patch: ref('F') } },
  }, {
    if: { properties: { type: { const: 'update_workspace_settings' } } },
    then: { properties: { patch: ref('W') } },
  }, {
    if: { properties: { type: { const: 'update_scenario' } } },
    then: { properties: { patch: ref('S') } },
  }],
}

const operationsSchema: Schema = { type: 'array', minItems: 1, maxItems: 200, items: registeredWorkspaceOperationSchema }

const operationSchemaDescription: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  ...({ $defs: workspaceOperationDefinitions } as Record<string, unknown>),
  required: ['expectedRevision', 'operations'],
  properties: {
    expectedRevision: { type: 'integer', minimum: 0, description: 'Revision read from get_layout or get_workspace_guide; stale writes fail.' },
    operations: {
      ...operationsSchema,
      description: 'Ordered atomic batch. See get_workspace_guide for numeric constraints. Any invalid item rejects the batch.',
    },
    intent: { type: 'string', maxLength: 2000, description: 'Optional history label.' },
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
      ...({ $defs: workspaceOperationDefinitions } as Record<string, unknown>),
      ...({
        oneOf: [
          { required: ['previewToken'] },
          { required: ['expectedRevision', 'operations'] },
        ],
      } as Record<string, unknown>),
      properties: {
        previewToken: { type: 'string', minLength: 1, maxLength: 200, description: 'Single-use preview token; do not mix with direct fields.' },
        expectedRevision: { type: 'integer', minimum: 0, description: 'Latest revision for direct apply.' },
        operations: { ...operationsSchema, description: 'Direct operation batch.' },
        intent: { type: 'string', maxLength: 2000, description: 'Optional history label.' },
        idempotencyKey: { type: 'string', minLength: 1, maxLength: 200, description: 'Optional retry key.' },
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
        const appState = appStateStore.getState()
        const scenarioIds = new Set(committedState.project.scenarios.map((scenario) => scenario.id))
        const changedArchitecture = result.changedIds.includes('architecture')
        const changedScenario = result.changedIds.some((id) => scenarioIds.has(id))
        appState.setOverlay(null)
        if (visibleChangedIds.length > 0 || (!changedArchitecture && !changedScenario)) {
          appState.setStage('equipment')
          appStateStore.getState().setView('plan')
        } else if (changedArchitecture) {
          appState.setStage('space')
          appStateStore.getState().setView('plan')
        } else {
          appState.setStage('simulate')
        }
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
