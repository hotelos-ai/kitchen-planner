import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { workspaceOperationSchema } from '../core/workspace/workspace-operation'
import type { JsonSchemaObject, WebMcpToolDefinition } from './model-context'
import {
  currentRevision,
  diagnosticsSummary,
  failure,
  jsonSafeSize,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

export type WriteToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
}

const MAX_SIMULATION_RESULT_BYTES = 262_144

const previewInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  operations: z.array(workspaceOperationSchema).min(1).max(200),
  intent: z.string().max(2_000).optional(),
}).strict()

const applyInput = z.object({
  previewToken: z.string().min(1).max(200),
}).strict()

const runSimulationInput = z.object({
  scenarioId: z.string().min(1).max(128).optional(),
  variantId: z.string().min(1).max(128).optional(),
  seed: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
  outputMode: z.enum(['metrics-only', 'full']).optional(),
}).strict()

const historyInput = z.object({
  direction: z.enum(['undo', 'redo']),
}).strict()

const operationSchemaDescription: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedRevision', 'operations'],
  properties: {
    expectedRevision: { type: 'number', description: 'The document revision you read via get_layout or get_workspace_guide; rejects concurrent writes.' },
    operations: {
      type: 'array',
      description: 'Ordered batch of spatial operations executed atomically: add_component, add_custom_component, move_components, nudge_components, rotate_components, resize_component, update_component, duplicate_components, remove_components, update_architecture, update_scenario, create_layout, activate_layout, rename_layout, remove_layout, update_workspace_settings, and related kinds. Each is validated strictly; one failure rejects the whole batch.',
      items: { type: 'object', description: 'One workspace operation object; see get_workspace_guide supportedOperations and get_component_catalog for IDs.' },
    },
    intent: { type: 'string', description: 'Optional human-readable description of the change, recorded in history.' },
  },
}

type PreviewResult = { ok: true; revision: number; previewToken: string; changedIds: string[]; warnings: string[]; normalizedOperations: unknown[]; diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] } }

type ApplyResult = { ok: true; revision: number; changedIds: string[]; warnings: string[]; diagnostics: { added: unknown[]; resolved: unknown[]; current: unknown[] } }

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
      'Commit a previewed batch: pass the previewToken from preview_layout_changes. Commits the whole batch as one transaction, one undo step, and one revision increment; returns the new revision, changed IDs, warnings, and diagnostics delta.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['previewToken'],
      properties: {
        previewToken: { type: 'string', description: 'The single-use token returned by a successful preview_layout_changes call.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, applyInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid apply request.', parsed.issues)
        const result = deps.getFacade().applyLayoutChanges({ previewToken: parsed.value.previewToken }) as ApplyResult | FacadeFailure
        if (isFacadeFailure(result)) {
          return {
            ok: false as const,
            revision: result.revision,
            code: result.code,
            message: result.message,
            recovery: applyRecoveryHint(result.code),
          }
        }
        return success(result.revision, {
          changedIds: result.changedIds,
          warnings: result.warnings,
          diagnostics: diagnosticsSummary(result.diagnostics),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const runSimulationTool: WebMcpToolDefinition = {
    name: 'run_simulation',
    title: 'Run service simulation',
    description:
      'Run the deterministic service simulation for a scenario against a layout revision and return assumptions, metrics, warnings, and recommendations. outputMode "metrics-only" (default) returns aggregates; "full" adds time series and is truncated to a size limit when needed. Does not change the document revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        seed: { type: 'number', description: 'Optional deterministic seed; defaults to the scenario seed.' },
        outputMode: { type: 'string', enum: ['metrics-only', 'full'], description: 'Detail level; defaults to metrics-only.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, runSimulationInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid simulation request.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenario = state.project.scenarios.find((candidate) => candidate.id === (parsed.value.scenarioId ?? state.project.activeScenarioId))
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${parsed.value.scenarioId ?? state.project.activeScenarioId} does not exist.`)
        const outputMode = parsed.value.outputMode ?? 'metrics-only'
        let result: unknown
        try {
          result = deps.getFacade().runSimulation({
            variantId: variant.id,
            scenarioId: scenario.id,
            seed: parsed.value.seed ?? scenario.seed,
            outputMode,
          })
        } catch (error) {
          return failure(state.revision, 'simulation-failed', unknownErrorMessage(error))
        }
        if (isFacadeFailure(result)) {
          return { ok: false as const, revision: result.revision, code: result.code, message: result.message }
        }
        const payload = {
          scenario: { id: scenario.id, name: scenario.name, seed: parsed.value.seed ?? scenario.seed, covers: scenario.covers, durationMinutes: scenario.durationMinutes },
          layoutRevision: state.revision,
          outputMode,
          result: structuredClone(result),
          assumptions: 'Simulated values are scenario assumptions, not observed service data.',
        }
        if (jsonSafeSize(payload) > MAX_SIMULATION_RESULT_BYTES) {
          const record = result as { seed?: unknown; durationSeconds?: unknown; metrics?: unknown; warnings?: unknown }
          return success(state.revision, {
            ...payload,
            result: {
              seed: record.seed,
              durationSeconds: record.durationSeconds,
              metrics: record.metrics,
              warnings: record.warnings,
            },
            truncated: true,
            truncationNote: 'The full result exceeded the size limit; detailed series were dropped and aggregates kept.',
          })
        }
        return success(state.revision, payload)
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

  return [previewLayoutChanges, applyLayoutChanges, runSimulationTool, stepWorkspaceHistory]
}
