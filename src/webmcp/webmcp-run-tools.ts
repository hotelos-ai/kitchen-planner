import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { buildFindings } from '../simulation/recommendations'
import { runSimulationResponsive, SimulationRunCancelledError } from '../simulation/responsive-runner'
import type { SimulationInput, SimulationResult } from '../simulation/types'
import { appStateStore } from '../state/app-state-store'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../state/simulation-run-store'
import type { WebMcpToolDefinition } from './model-context'
import { recoveryForErrorCode } from './error-taxonomy'
import {
  currentRevision,
  failure,
  jsonSafeSize,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

const MAX_SIMULATION_RESULT_BYTES = 262_144

const runSimulationInput = z.object({
  scenarioId: z.string().min(1).max(128).optional(),
  variantId: z.string().min(1).max(128).optional(),
  seed: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
  outputMode: z.enum(['metrics-only', 'full']).optional(),
  playback: z.enum(['play', 'pause', 'none']).optional(),
  navigateTo: z.boolean().optional(),
}).strict()

const getSimulationResultInput = z.object({
  scenarioId: z.string().min(1).max(128).optional(),
  variantId: z.string().min(1).max(128).optional(),
  include: z.enum(['metrics', 'findings', 'stations', 'orders']).optional(),
}).strict()

type FacadeFailure = { ok: false; revision: number; code: string; message: string }

const isFacadeFailure = (result: unknown): result is FacadeFailure =>
  typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false

const isFullSimulationResult = (result: unknown): result is SimulationResult => {
  if (typeof result !== 'object' || result === null) return false
  const candidate = result as Partial<SimulationResult>
  return typeof candidate.seed === 'number'
    && typeof candidate.durationSeconds === 'number'
    && typeof candidate.metrics === 'object'
    && Array.isArray(candidate.warnings)
    && Array.isArray(candidate.frames)
    && Array.isArray(candidate.events)
    && Array.isArray(candidate.taskTimeline)
    && Array.isArray(candidate.orders)
}

const simulationScopeFailure = (
  deps: ToolDependencies,
  expectedDocumentId: string,
  expectedRevision: number,
) => {
  const current = deps.store.getState()
  if (current.documentId !== expectedDocumentId) {
    return {
      ...failure(current.revision, 'wrong-document', 'The open project was replaced while the simulation was running. The obsolete result was discarded.'),
      recovery: recoveryForErrorCode('wrong-document'),
    }
  }
  if (current.revision !== expectedRevision) {
    return {
      ...failure(current.revision, 'stale-revision', `The workspace changed from revision ${expectedRevision} to ${current.revision} while the simulation was running. The obsolete result was discarded.`),
      recovery: recoveryForErrorCode('stale-revision'),
    }
  }
  return null
}

const simulationCancelledFailure = (revision: number, message: string) => ({
  ...failure(revision, 'cancelled', message),
  recovery: recoveryForErrorCode('cancelled'),
})

export type RunToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
  runStore?: SimulationRunStore
  runSimulation?: (input: SimulationInput, signal?: AbortSignal) => Promise<SimulationResult>
}

export function createRunTools(deps: RunToolDependencies): WebMcpToolDefinition[] {
  const runStore = deps.runStore ?? simulationRunStore

  const runSimulationTool: WebMcpToolDefinition = {
    name: 'run_simulation',
    title: 'Run service simulation',
    description:
      'Run and retain one deterministic service simulation for a scenario and layout. The exact full result is shared with the visible app; playback controls whether it plays, pauses, or only stores, and navigateTo opens Simulate by default. Does not change the document revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        seed: { type: 'number', description: 'Optional deterministic seed; defaults to the scenario seed.' },
        outputMode: { type: 'string', enum: ['metrics-only', 'full'], description: 'Returned detail level; defaults to metrics-only. The shared app result is always complete.' },
        playback: { type: 'string', enum: ['play', 'pause', 'none'], description: 'Play, show paused, or make no visible playback request. Defaults to play.' },
        navigateTo: { type: 'boolean', description: 'Open the Simulate stage so the user sees the result. Defaults to true.' },
      },
    },
    execute: async (input, context) => {
      try {
        if (context?.signal?.aborted) {
          return simulationCancelledFailure(currentRevision(deps), 'The simulation request was cancelled before it started.')
        }
        const parsed = parseInput(deps, runSimulationInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid simulation request.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenario = state.project.scenarios.find((candidate) => candidate.id === (parsed.value.scenarioId ?? state.project.activeScenarioId))
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${parsed.value.scenarioId ?? state.project.activeScenarioId} does not exist.`)
        const seed = parsed.value.seed ?? scenario.seed
        let result: unknown
        try {
          // High-cover runs move to a cancellable Worker; small runs avoid its
          // startup cost. Presentation still receives the exact full result.
          const simulationInput: SimulationInput = {
            architecture: structuredClone(variant.architecture),
            equipment: structuredClone(variant.equipment),
            scenario: { ...structuredClone(scenario), seed },
            layoutConstraints: structuredClone(variant.layoutConstraints),
            outputMode: 'full',
          }
          result = deps.runSimulation
            ? await deps.runSimulation(simulationInput, context?.signal)
            : await runSimulationResponsive(simulationInput, { signal: context?.signal })
        } catch (error) {
          const scopeFailure = simulationScopeFailure(deps, state.documentId, state.revision)
          if (scopeFailure) return scopeFailure
          if (error instanceof SimulationRunCancelledError || context?.signal?.aborted) {
            return simulationCancelledFailure(state.revision, 'The simulation request was cancelled.')
          }
          return failure(state.revision, 'simulation-failed', unknownErrorMessage(error))
        }
        const scopeFailure = simulationScopeFailure(deps, state.documentId, state.revision)
        if (scopeFailure) return scopeFailure
        if (isFacadeFailure(result)) {
          return { ok: false as const, revision: result.revision, code: result.code, message: result.message }
        }
        if (!isFullSimulationResult(result)) {
          return failure(state.revision, 'simulation-failed', 'The simulation service did not return a complete result for presentation.')
        }
        if (context?.signal?.aborted) {
          return simulationCancelledFailure(currentRevision(deps), 'The simulation request was cancelled before publishing its result.')
        }

        const playback = parsed.value.playback ?? 'play'
        runStore.getState().storeRun({
          variantId: variant.id,
          scenarioId: scenario.id,
          result,
          seed,
          ranAtRevision: state.revision,
          active: playback !== 'none',
        })

        if (parsed.value.navigateTo ?? true) {
          appStateStore.getState().setOverlay(null)
          appStateStore.getState().setStage('simulate')
        }
        if (playback !== 'none') {
          appStateStore.getState().requestSimulationRun({
            scenarioId: scenario.id,
            variantId: variant.id,
            seed,
            playback: playback === 'play',
          })
        }

        const outputMode = parsed.value.outputMode ?? 'metrics-only'
        const returnedResult = outputMode === 'full'
          ? structuredClone(result)
          : {
              seed: result.seed,
              durationSeconds: result.durationSeconds,
              metrics: structuredClone(result.metrics),
              warnings: [...result.warnings],
            }
        const payload = {
          scenario: { id: scenario.id, name: scenario.name, seed, covers: scenario.covers, durationMinutes: scenario.durationMinutes },
          layoutRevision: state.revision,
          outputMode,
          result: returnedResult,
          assumptions: 'Simulated values are scenario assumptions, not observed service data.',
        }
        if (jsonSafeSize(payload) > MAX_SIMULATION_RESULT_BYTES) {
          return success(state.revision, {
            ...payload,
            result: {
              seed: result.seed,
              durationSeconds: result.durationSeconds,
              metrics: structuredClone(result.metrics),
              warnings: [...result.warnings],
            },
            truncated: true,
            truncationNote: 'The full response exceeded the size limit; detailed series were dropped and aggregates kept. The complete result remains available to the app.',
          })
        }
        return success(state.revision, payload)
      } catch (error) {
        if (error instanceof SimulationRunCancelledError || context?.signal?.aborted) {
          return simulationCancelledFailure(currentRevision(deps), 'The simulation request was cancelled.')
        }
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const getSimulationResult: WebMcpToolDefinition = {
    name: 'get_simulation_result',
    title: 'Get simulation result',
    description:
      'Read the latest retained simulation for a scenario and layout without rerunning it. Select metrics, evidence-backed findings, station pressure, or order timelines. Reports staleAtRevision when the workspace changed after the run.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        include: { type: 'string', enum: ['metrics', 'findings', 'stations', 'orders'], description: 'Result section to return; defaults to metrics.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, getSimulationResultInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid simulation result request.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenario = state.project.scenarios.find((candidate) => candidate.id === (parsed.value.scenarioId ?? state.project.activeScenarioId))
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${parsed.value.scenarioId ?? state.project.activeScenarioId} does not exist.`)
        const stored = selectSimulationRun(runStore.getState(), variant.id, scenario.id)
        if (!stored) {
          return failure(state.revision, 'missing-simulation-result', `No simulation result is retained for layout ${variant.id} and scenario ${scenario.id}. Run run_simulation first.`)
        }

        const include = parsed.value.include ?? 'metrics'
        let section: Record<string, unknown>
        if (include === 'metrics') {
          section = { metrics: structuredClone(stored.result.metrics) }
        } else if (include === 'findings') {
          section = {
            findings: buildFindings({
              baseline: stored.result,
              candidate: stored.result,
              candidateEquipment: variant.equipment,
              candidateArchitecture: variant.architecture,
            }),
          }
        } else if (include === 'stations') {
          const taskCounts = stored.result.taskTimeline.reduce<Record<string, number>>((counts, task) => {
            counts[task.stationId] = (counts[task.stationId] ?? 0) + 1
            return counts
          }, {})
          const stationIds = new Set([
            ...Object.keys(stored.result.metrics.stationUtilization),
            ...Object.keys(stored.result.metrics.queueSeconds),
            ...Object.keys(taskCounts),
          ])
          section = {
            stations: [...stationIds].map((stationId) => ({
              id: stationId,
              label: variant.equipment.find((item) => item.id === stationId)?.label ?? variant.architecture.openings.find((opening) => opening.id === stationId)?.label ?? stationId,
              utilization: stored.result.metrics.stationUtilization[stationId] ?? 0,
              queueSeconds: stored.result.metrics.queueSeconds[stationId] ?? 0,
              completedTasks: taskCounts[stationId] ?? 0,
            })).sort((left, right) => right.utilization - left.utilization || right.queueSeconds - left.queueSeconds),
          }
        } else {
          section = { orders: structuredClone(stored.result.orders) }
        }

        return success(state.revision, {
          variantId: variant.id,
          scenario: { id: scenario.id, name: scenario.name },
          seed: stored.seed,
          ranAtRevision: stored.ranAtRevision,
          ranAt: stored.ranAt,
          ...(stored.ranAtRevision === state.revision ? {} : { staleAtRevision: state.revision }),
          include,
          warnings: [...stored.result.warnings],
          ...section,
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [runSimulationTool, getSimulationResult]
}
