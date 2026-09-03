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
    if (!input.idempotencyKey) context.addIssue({ code: 'custom', path: ['idempotencyKey'], message: 'idempotencyKey is required for direct apply.' })
  }
})

const historyInput = z.object({
  direction: z.enum(['undo', 'redo']),
}).strict()

export const workspaceOperationJsonSchema = z.toJSONSchema(workspaceOperationSchema, {
  target: 'draft-7',
}) as Record<string, unknown>
delete workspaceOperationJsonSchema.$schema

const operationSchemaDescription: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedRevision', 'operations'],
  properties: {
    expectedRevision: { type: 'number', description: 'The document revision you read via get_layout or get_workspace_guide; rejects concurrent writes.' },
    operations: {
      type: 'array',
      description: 'Ordered atomic workspace batch. Call get_workspace_guide once for the complete discriminated operation JSON Schema and numeric constraints. Every item is validated strictly at execution; one failure rejects the whole batch.',
      items: {},
    },
    intent: { type: 'string', description: 'Optional human-readable description of the change, recorded in history.' },
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
      'Validate an ordered batch of spatial operations against the current plan without mutating it. On success returns a single-use previewToken bound to this exact batch and revision, the changed component IDs, warnings, and a diagnostics delta. Pass the token to apply_layout_changes to commit.',
    inputSchema: operationSchemaDescription,
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, previewInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid preview request. Operations must match the workspace operation schema.', parsed.issues)
        const result = deps.getFacade().previewLayoutChanges({
          expectedRevision: parsed.value.expectedRevision,
          operations: parsed.value.operations,
          ...(parsed.value.intent !== undefined ? { intent: parsed.value.intent } : {}),
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
      'Commit a preview token, or atomically preview and commit a direct operation batch with expectedRevision and an idempotencyKey. A repeated identical key never applies twice. Each new batch is one undo step and revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        previewToken: { type: 'string', description: 'Single-use token from preview_layout_changes. Do not combine with direct batch fields.' },
        expectedRevision: { type: 'number', description: 'For direct apply, the latest revision read by the agent.' },
        operations: { type: 'array', items: {}, description: 'For direct apply, 1–200 strict workspace operations committed atomically. The complete discriminated operation schema and numeric constraints are returned by get_workspace_guide.' },
        intent: { type: 'string', description: 'Optional human-readable intent recorded with a direct batch.' },
        idempotencyKey: { type: 'string', description: 'Required for direct apply. Reusing it with the same batch returns the original result; different content is rejected.' },
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
          scopedIdempotencyKey = `${scope}:${parsed.value.idempotencyKey!}`
          signature = JSON.stringify({
            scope,
            expectedRevision: parsed.value.expectedRevision,
            operations: parsed.value.operations,
            intent: parsed.value.intent,
          })
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
            ...(parsed.value.intent === undefined ? {} : { intent: parsed.value.intent }),
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
