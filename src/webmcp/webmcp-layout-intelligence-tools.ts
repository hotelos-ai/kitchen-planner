import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import type { LayoutVariant } from '../domain/project'
import { layoutChangeCost, layoutDiff } from '../optimizer/feasibility'
import type { AnytimeSearchResult, EvaluatedCandidate, OptimizerManifest } from '../optimizer/types'
import { buildFindings, compareResults } from '../simulation/recommendations'
import type { SimulationResult } from '../simulation/types'
import { appStateStore } from '../state/app-state-store'
import type { WebMcpToolDefinition, WebMcpToolExecutionContext } from './model-context'
import {
  currentRevision,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

const compareLayoutsInput = z.object({
  baselineVariantId: z.string().min(1).max(128),
  candidateVariantId: z.string().min(1).max(128),
  scenarioId: z.string().min(1).max(128).optional(),
  openOverlay: z.boolean().optional(),
}).strict()

const autoLayoutPermissionsSchema = z.object({
  placement: z.boolean(),
  equipmentRedesign: z.boolean(),
  architecture: z.boolean(),
}).strict()

const runAutoLayoutInput = z.object({
  variantId: z.string().min(1).max(128).optional(),
  scenarioId: z.string().min(1).max(128).optional(),
  objective: z.enum(['balanced', 'service', 'travel', 'minimal-change']).optional(),
  seed: z.number().int().min(0).max(2_147_483_646).optional(),
  maxCandidates: z.number().int().min(1).max(200).optional(),
  maxDurationMs: z.number().int().min(100).max(120_000).optional(),
  targetP90WaitSeconds: z.number().positive().finite().max(86_400).optional(),
  minimumAisleMm: z.number().nonnegative().finite().max(20_000).optional(),
  permissions: autoLayoutPermissionsSchema.optional(),
  openOverlay: z.boolean().optional(),
}).strict()

const getAutoLayoutRunInput = z.object({
  runId: z.string().min(1).max(160),
  resultId: z.string().min(1).max(160).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).strict()

const cancelAutoLayoutRunInput = z.object({
  runId: z.string().min(1).max(160),
}).strict()

const adoptAutoLayoutCandidateInput = z.object({
  runId: z.string().min(1).max(160),
  resultId: z.string().min(1).max(160),
  expectedRevision: z.number().int().nonnegative(),
  newVariantId: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(120),
}).strict()

type FacadeFailure = { ok: false; revision: number; code: string; message: string; issues?: unknown }

type Progress = {
  phase?: unknown
  feasibleCandidates?: unknown
  prunedCandidates?: unknown
  simulatedCandidates?: unknown
  candidateCount?: unknown
  elapsedMs?: unknown
  bestObserved?: unknown
}

type AutoLayoutStatus = 'running' | 'completed' | 'failed' | 'cancelled'

type AutoLayoutRun = {
  runId: string
  documentId: string
  revision: number
  variantId: string
  scenarioId: string
  status: AutoLayoutStatus
  progressPct: number
  progress?: Record<string, unknown>
  result?: AnytimeSearchResult
  error?: { code: string; message: string; issues?: unknown }
  removeAbortListener?: () => void
}

export type LayoutIntelligenceToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
  now?: () => string
}

const isFacadeFailure = (value: unknown): value is FacadeFailure =>
  value !== null && typeof value === 'object' && (value as { ok?: unknown }).ok === false

const isSimulationResult = (value: unknown): value is SimulationResult => {
  if (value === null || typeof value !== 'object') return false
  const result = value as Partial<SimulationResult>
  return typeof result.seed === 'number'
    && typeof result.metrics === 'object'
    && Array.isArray(result.warnings)
    && Array.isArray(result.frames)
    && Array.isArray(result.events)
    && Array.isArray(result.taskTimeline)
    && Array.isArray(result.orders)
}

const isEvaluatedCandidate = (value: unknown): value is EvaluatedCandidate => {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<EvaluatedCandidate>
  return typeof candidate.id === 'string'
    && typeof candidate.hash === 'string'
    && candidate.variant !== null
    && typeof candidate.variant === 'object'
    && candidate.score !== null
    && typeof candidate.score === 'object'
    && Array.isArray(candidate.evaluatedSeeds)
    && Array.isArray(candidate.confirmationSeeds)
    && candidate.diff !== null
    && typeof candidate.diff === 'object'
}

const isSearchResult = (value: unknown): value is AnytimeSearchResult => {
  if (value === null || typeof value !== 'object') return false
  const result = value as Partial<AnytimeSearchResult>
  return result.manifest !== null
    && typeof result.manifest === 'object'
    && Array.isArray(result.candidates)
    && result.candidates.every(isEvaluatedCandidate)
    && Array.isArray(result.finalists)
    && result.finalists.every(isEvaluatedCandidate)
    && typeof result.evaluationCount === 'number'
    && typeof result.termination === 'string'
    && typeof result.bestObservedDisclaimer === 'string'
}

const progressPercent = (progress: Progress, maximumEvaluations: number, previous: number): number => {
  const phase = typeof progress.phase === 'string' ? progress.phase : ''
  if (phase === 'complete') return 100
  const base = phase === 'confirmation' ? 85 : phase === 'simulation' ? 35 : phase === 'pruning' ? 20 : 5
  const simulated = typeof progress.simulatedCandidates === 'number'
    ? progress.simulatedCandidates
    : typeof progress.candidateCount === 'number' ? progress.candidateCount : 0
  const withinPhase = Math.min(45, Math.max(0, Math.round(simulated / maximumEvaluations * 45)))
  return Math.min(99, Math.max(previous, base + withinPhase))
}

const safeProgress = (progress: Progress): Record<string, unknown> => ({
  ...(typeof progress.phase === 'string' ? { phase: progress.phase } : {}),
  ...(typeof progress.feasibleCandidates === 'number' ? { feasibleCandidates: progress.feasibleCandidates } : {}),
  ...(typeof progress.prunedCandidates === 'number' ? { prunedCandidates: progress.prunedCandidates } : {}),
  ...(typeof progress.simulatedCandidates === 'number' ? { simulatedCandidates: progress.simulatedCandidates } : {}),
  ...(typeof progress.candidateCount === 'number' ? { candidateCount: progress.candidateCount } : {}),
  ...(typeof progress.elapsedMs === 'number' ? { elapsedMs: progress.elapsedMs } : {}),
  ...(typeof progress.bestObserved === 'string' ? { bestObserved: progress.bestObserved } : {}),
})

const candidatePayload = (candidate: EvaluatedCandidate) => ({
  id: candidate.id,
  hash: candidate.hash,
  score: structuredClone(candidate.score),
  diff: structuredClone(candidate.diff),
  evaluatedSeeds: [...candidate.evaluatedSeeds],
  confirmationSeeds: [...candidate.confirmationSeeds],
  variant: structuredClone(candidate.variant),
})

const candidateSummary = (candidate: EvaluatedCandidate) => ({
  id: candidate.id,
  hash: candidate.hash,
  score: structuredClone(candidate.score),
  changeCounts: {
    moved: candidate.diff.moved.length,
    rotated: candidate.diff.rotated.length,
    resized: candidate.diff.resized.length,
    substituted: candidate.diff.substituted.length,
    added: candidate.diff.added.length,
    removed: candidate.diff.removed.length,
    architectureChanged: candidate.diff.architectureChanged,
  },
  evaluatedSeeds: [...candidate.evaluatedSeeds],
  confirmationSeeds: [...candidate.confirmationSeeds],
})

const scoreRecord = (score: EvaluatedCandidate['score']): Record<string, number> =>
  Object.fromEntries(Object.entries(score).filter((entry): entry is [string, number] => typeof entry[1] === 'number'))

/**
 * Spatial comparison and optimizer tools share the same facade as the human
 * workspaces. Optimizer runs are transient, revision-bound, and never adopt or
 * overwrite a layout; callers must still use an explicit adoption operation.
 */
export function createLayoutIntelligenceTools(deps: LayoutIntelligenceToolDependencies): WebMcpToolDefinition[] {
  const runs = new Map<string, AutoLayoutRun>()
  const now = deps.now ?? (() => new Date().toISOString())
  let runSequence = 0

  const compareLayouts: WebMcpToolDefinition = {
    name: 'compare_layouts',
    title: 'Compare layouts',
    description:
      'Compare two saved layout variants under the same scenario and deterministic seed. Returns exact spatial changes, service-metric deltas, and evidence-backed findings; optionally opens the visible Compare overlay. Does not change the project revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['baselineVariantId', 'candidateVariantId'],
      properties: {
        baselineVariantId: { type: 'string', description: 'Saved layout variant used as the comparison baseline.' },
        candidateVariantId: { type: 'string', description: 'Saved layout variant evaluated against the baseline.' },
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
        openOverlay: { type: 'boolean', description: 'Open the visible Compare overlay after a successful comparison. Defaults to false.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, compareLayoutsInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid layout comparison request.', parsed.issues)
        const state = deps.store.getState()
        const baseline = resolveVariant(state.project, parsed.value.baselineVariantId)
        if (!baseline) return failure(state.revision, 'missing-variant', `Baseline layout variant ${parsed.value.baselineVariantId} does not exist.`)
        const candidate = resolveVariant(state.project, parsed.value.candidateVariantId)
        if (!candidate) return failure(state.revision, 'missing-variant', `Candidate layout variant ${parsed.value.candidateVariantId} does not exist.`)
        if (baseline.id === candidate.id) return failure(state.revision, 'same-variant', 'Choose two different layout variants to compare.')
        const scenarioId = parsed.value.scenarioId ?? state.project.activeScenarioId
        const scenario = state.project.scenarios.find((value) => value.id === scenarioId)
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${scenarioId} does not exist.`)

        let baselineResult: unknown
        let candidateResult: unknown
        try {
          baselineResult = deps.getFacade().runSimulation({ variantId: baseline.id, scenarioId: scenario.id, seed: scenario.seed, outputMode: 'full' })
          if (isFacadeFailure(baselineResult)) return baselineResult
          candidateResult = deps.getFacade().runSimulation({ variantId: candidate.id, scenarioId: scenario.id, seed: scenario.seed, outputMode: 'full' })
          if (isFacadeFailure(candidateResult)) return candidateResult
        } catch (error) {
          return failure(state.revision, 'comparison-failed', unknownErrorMessage(error))
        }
        if (!isSimulationResult(baselineResult) || !isSimulationResult(candidateResult)) {
          return failure(state.revision, 'comparison-failed', 'The simulation service did not return complete results for both layouts.')
        }

        const diff = layoutDiff(baseline, candidate)
        if (parsed.value.openOverlay === true) appStateStore.getState().setOverlay('compare')
        return success(state.revision, {
          baseline: { variantId: baseline.id, name: baseline.name },
          candidate: { variantId: candidate.id, name: candidate.name },
          scenario: { id: scenario.id, name: scenario.name, seed: scenario.seed },
          spatial: { ...diff, changeCost: layoutChangeCost(baseline, candidate) },
          metricDeltas: compareResults(baselineResult, candidateResult),
          findings: buildFindings({
            baseline: baselineResult,
            candidate: candidateResult,
            candidateEquipment: candidate.equipment,
            candidateArchitecture: candidate.architecture,
          }),
          warnings: {
            baseline: [...baselineResult.warnings],
            candidate: [...candidateResult.warnings],
          },
          overlayOpened: parsed.value.openOverlay === true,
          assumptions: 'Both layouts were simulated with the same scenario and seed. Results are modeled planning evidence, not observed service data or regulatory certification.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const runAutoLayout: WebMcpToolDefinition = {
    name: 'run_auto_layout',
    title: 'Run auto-layout',
    description:
      'Start a deterministic, revision-bound auto-layout search without changing the project. Returns a run ID immediately; poll get_auto_layout_run for candidates, then use adopt_auto_layout_candidate if the user chooses a confirmed finalist.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variantId: { type: 'string', description: 'Optional baseline variant ID; defaults to the active variant.' },
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
        objective: { type: 'string', enum: ['balanced', 'service', 'travel', 'minimal-change'], description: 'Optimization priority; defaults to balanced.' },
        seed: { type: 'number', description: 'Deterministic non-negative integer seed. Defaults to a normalized form of the scenario seed.' },
        maxCandidates: { type: 'number', description: 'Maximum candidate evaluations, 1–200. Defaults to 60.' },
        maxDurationMs: { type: 'number', description: 'Time budget in milliseconds, 100–120000. Defaults to 30000.' },
        targetP90WaitSeconds: { type: 'number', description: 'Optional target P90 order wait in seconds.' },
        minimumAisleMm: { type: 'number', description: 'Optional minimum aisle rule in millimetres; defaults to the layout constraint.' },
        permissions: {
          type: 'object',
          additionalProperties: false,
          required: ['placement', 'equipmentRedesign', 'architecture'],
          properties: {
            placement: { type: 'boolean' },
            equipmentRedesign: { type: 'boolean' },
            architecture: { type: 'boolean' },
          },
        },
        openOverlay: { type: 'boolean', description: 'Open the visible Auto-layout overlay. Defaults to true.' },
      },
    },
    execute: (input, context?: WebMcpToolExecutionContext) => {
      try {
        const parsed = parseInput(deps, runAutoLayoutInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid auto-layout request.', parsed.issues)
        const state = deps.store.getState()
        if (context?.signal?.aborted) return failure(state.revision, 'cancelled', 'The auto-layout request was cancelled before it started.')
        const baseline = resolveVariant(state.project, parsed.value.variantId)
        if (!baseline) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenarioId = parsed.value.scenarioId ?? state.project.activeScenarioId
        const scenario = state.project.scenarios.find((value) => value.id === scenarioId)
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${scenarioId} does not exist.`)

        const activeRun = [...runs.values()].find((value) => value.status === 'running')
        if (activeRun) return failure(state.revision, 'auto-layout-active', `Auto-layout run ${activeRun.runId} is already active. Poll or cancel it before starting another.`, { runId: activeRun.runId })

        runSequence += 1
        const runId = `auto-layout-${state.revision}-${runSequence}`
        const seed = parsed.value.seed ?? Math.abs(scenario.seed % 2_147_483_646)
        const maxCandidates = parsed.value.maxCandidates ?? 60
        const constraints = baseline.layoutConstraints
        const manifest: OptimizerManifest = {
          id: runId,
          documentId: state.documentId,
          revision: state.revision,
          baselineVariantId: baseline.id,
          scenarioIds: [scenario.id],
          seeds: [seed],
          confirmationSeeds: [seed + 1],
          permissions: structuredClone(parsed.value.permissions ?? constraints?.permissions ?? {
            placement: true,
            equipmentRedesign: false,
            architecture: false,
          }),
          lockedComponentIds: [...(constraints?.lockedComponentIds ?? [])],
          lockedArchitectureElementIds: [...(constraints?.lockedArchitectureElementIds ?? [])],
          hardRules: {
            minimumAisleMm: parsed.value.minimumAisleMm ?? constraints?.minimumAisleMm ?? 0,
            noGoZones: structuredClone(constraints?.noGoZones ?? []),
          },
          budget: { maxEvaluations: maxCandidates, maxDurationMs: parsed.value.maxDurationMs ?? 30_000 },
          priority: parsed.value.objective ?? 'balanced',
          ...(parsed.value.targetP90WaitSeconds === undefined ? {} : { targetP90WaitSeconds: parsed.value.targetP90WaitSeconds }),
        }
        const run: AutoLayoutRun = {
          runId,
          documentId: state.documentId,
          revision: state.revision,
          variantId: baseline.id,
          scenarioId: scenario.id,
          status: 'running',
          progressPct: 0,
        }
        runs.set(runId, run)

        const cancel = () => {
          if (run.status !== 'running') return
          run.status = 'cancelled'
          run.error = { code: 'cancelled', message: `Auto-layout run ${runId} was cancelled.` }
          void deps.getFacade().cancelRun({ runId })
        }
        if (context?.signal) {
          context.signal.addEventListener('abort', cancel, { once: true })
          run.removeAbortListener = () => context.signal?.removeEventListener('abort', cancel)
        }
        if (parsed.value.openOverlay ?? true) appStateStore.getState().setOverlay('auto-layout')

        void Promise.resolve().then(() => deps.getFacade().runAutoLayout({
          request: {
            baseline: structuredClone(baseline) as LayoutVariant,
            scenario: structuredClone(scenario),
            manifest,
          },
          onProgress: (value: unknown) => {
            if (run.status !== 'running' || value === null || typeof value !== 'object') return
            const progress = value as Progress
            run.progress = safeProgress(progress)
            run.progressPct = progressPercent(progress, maxCandidates, run.progressPct)
          },
        })).then((result) => {
          if (run.status !== 'running') return
          if (isFacadeFailure(result)) {
            run.status = result.code === 'cancelled' ? 'cancelled' : 'failed'
            run.error = { code: result.code, message: result.message, ...(result.issues === undefined ? {} : { issues: result.issues }) }
            return
          }
          if (!isSearchResult(result)) {
            run.status = 'failed'
            run.error = { code: 'auto-layout-failed', message: 'The auto-layout service returned an invalid result.' }
            return
          }
          run.status = result.termination === 'cancelled' ? 'cancelled' : 'completed'
          run.progressPct = result.termination === 'cancelled' ? run.progressPct : 100
          run.result = structuredClone(result)
        }).catch((error) => {
          if (run.status !== 'running') return
          const code = error !== null && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : 'auto-layout-failed'
          run.status = code === 'cancelled' ? 'cancelled' : 'failed'
          run.error = { code, message: unknownErrorMessage(error) }
        }).finally(() => run.removeAbortListener?.())

        return success(state.revision, {
          runId,
          status: run.status,
          variantId: baseline.id,
          scenarioId: scenario.id,
          manifest: structuredClone(manifest),
          pollWith: { tool: 'get_auto_layout_run', runId },
          note: 'The search is transient and will not change or adopt a layout automatically.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const getAutoLayoutRun: WebMcpToolDefinition = {
    name: 'get_auto_layout_run',
    title: 'Get auto-layout run',
    description:
      'Read status, progress, and compact confirmed-finalist and candidate summaries from a run started by run_auto_layout. Page candidates with offset and limit; pass a confirmed finalist resultId to retrieve its complete layout. Reports when its source project revision has become stale; never changes or adopts a layout.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: {
        runId: { type: 'string', minLength: 1, maxLength: 160, description: 'Run ID returned by run_auto_layout.' },
        resultId: { type: 'string', minLength: 1, maxLength: 160, description: 'Optional confirmed finalist ID. When present, finalist contains its complete saved-layout candidate.' },
        offset: { type: 'integer', minimum: 0, description: 'Zero-based candidate-summary offset. Defaults to 0.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum candidate summaries to return. Defaults to 20.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, getAutoLayoutRunInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid auto-layout run request.', parsed.issues)
        const state = deps.store.getState()
        const run = runs.get(parsed.value.runId)
        if (!run) return failure(state.revision, 'run-not-found', `Auto-layout run ${parsed.value.runId} does not exist in this page session.`)
        if (parsed.value.resultId && !run.result) {
          return failure(state.revision, 'run-not-complete', `Auto-layout run ${run.runId} is ${run.status}; finalist detail is available only after completion.`)
        }
        const requestedFinalist = parsed.value.resultId
          ? run.result?.finalists.find((candidate) => candidate.id === parsed.value.resultId)
          : undefined
        if (parsed.value.resultId && !requestedFinalist) {
          return failure(state.revision, 'result-not-finalist', `Result ${parsed.value.resultId} is not a confirmed finalist from run ${run.runId}.`)
        }
        const offset = parsed.value.offset ?? 0
        const limit = parsed.value.limit ?? 20
        const candidates = run.result?.candidates ?? []
        const candidatePage = candidates.slice(offset, offset + limit)
        const hasMoreCandidates = offset + candidatePage.length < candidates.length
        return success(state.revision, {
          runId: run.runId,
          status: run.status,
          progressPct: run.progressPct,
          variantId: run.variantId,
          scenarioId: run.scenarioId,
          ranAtRevision: run.revision,
          ...(run.documentId === state.documentId && run.revision === state.revision ? {} : { staleAtRevision: state.revision }),
          ...(run.progress ? { progress: structuredClone(run.progress) } : {}),
          ...(run.error ? { error: structuredClone(run.error) } : {}),
          ...(run.result ? {
            termination: run.result.termination,
            evaluationCount: run.result.evaluationCount,
            bestObservedDisclaimer: run.result.bestObservedDisclaimer,
            finalists: run.result.finalists.map(candidateSummary),
            candidates: candidatePage.map(candidateSummary),
            candidatePage: {
              offset,
              limit,
              returned: candidatePage.length,
              total: candidates.length,
              hasMore: hasMoreCandidates,
              ...(hasMoreCandidates ? { nextOffset: offset + candidatePage.length } : {}),
            },
            ...(requestedFinalist ? { finalist: candidatePayload(requestedFinalist) } : {}),
            ...(run.result.searchStats ? { searchStats: structuredClone(run.result.searchStats) } : {}),
            ...(run.result.diagnostics ? { diagnostics: structuredClone(run.result.diagnostics) } : {}),
          } : {}),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const cancelAutoLayoutRun: WebMcpToolDefinition = {
    name: 'cancel_auto_layout_run',
    title: 'Cancel auto-layout run',
    description: 'Cancel one active auto-layout run by ID. This affects transient optimizer work only and never changes the project revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: { runId: { type: 'string', description: 'Active run ID returned by run_auto_layout.' } },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, cancelAutoLayoutRunInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid cancellation request.', parsed.issues)
        const state = deps.store.getState()
        const run = runs.get(parsed.value.runId)
        if (!run) return failure(state.revision, 'run-not-found', `Auto-layout run ${parsed.value.runId} does not exist in this page session.`)
        if (run.status !== 'running') return failure(state.revision, 'run-not-active', `Auto-layout run ${run.runId} is already ${run.status}.`)
        const cancelled = deps.getFacade().cancelRun({ runId: run.runId })
        if (isFacadeFailure(cancelled)) return cancelled
        run.status = 'cancelled'
        run.error = { code: 'cancelled', message: `Auto-layout run ${run.runId} was cancelled.` }
        run.removeAbortListener?.()
        return success(state.revision, { runId: run.runId, status: run.status })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const adoptAutoLayoutCandidate: WebMcpToolDefinition = {
    name: 'adopt_auto_layout_candidate',
    title: 'Adopt auto-layout candidate',
    description:
      'Save one confirmed finalist from a completed auto-layout run as a new child layout. Requires the unchanged source revision and commits through the same atomic adoption operation as the human Auto-layout workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId', 'resultId', 'expectedRevision', 'newVariantId', 'name'],
      properties: {
        runId: { type: 'string', description: 'Completed run ID returned by run_auto_layout.' },
        resultId: { type: 'string', description: 'Confirmed finalist ID returned by get_auto_layout_run.' },
        expectedRevision: { type: 'number', description: 'Source revision returned by run_auto_layout; adoption fails if the project changed.' },
        newVariantId: { type: 'string', description: 'Unique ID for the saved layout variant.' },
        name: { type: 'string', description: 'Human-readable name for the saved layout.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, adoptAutoLayoutCandidateInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid auto-layout adoption request.', parsed.issues)
        const state = deps.store.getState()
        const run = runs.get(parsed.value.runId)
        if (!run) return failure(state.revision, 'run-not-found', `Auto-layout run ${parsed.value.runId} does not exist in this page session.`)
        if (run.status !== 'completed' || !run.result) {
          return failure(state.revision, 'run-not-complete', `Auto-layout run ${run.runId} is ${run.status}; only a completed run can be adopted.`)
        }
        if (parsed.value.expectedRevision !== run.revision) {
          return failure(state.revision, 'wrong-run-revision', `Run ${run.runId} was created at revision ${run.revision}, not ${parsed.value.expectedRevision}.`)
        }
        const finalist = run.result.finalists.find((candidate) => candidate.id === parsed.value.resultId)
        if (!finalist) return failure(state.revision, 'result-not-finalist', `Result ${parsed.value.resultId} is not a confirmed finalist from run ${run.runId}.`)
        const manifest = run.result.manifest
        const adopted: LayoutVariant = {
          ...structuredClone(finalist.variant),
          adoptedExperimentManifest: {
            id: manifest.id,
            documentId: manifest.documentId,
            revision: manifest.revision,
            baselineVariantId: manifest.baselineVariantId,
            finalistId: finalist.id,
            createdAt: now(),
            scenarioIds: [...manifest.scenarioIds],
            seeds: [...finalist.evaluatedSeeds],
            confirmationSeeds: [...finalist.confirmationSeeds],
            permissions: structuredClone(manifest.permissions),
            lockedComponentIds: [...manifest.lockedComponentIds],
            lockedArchitectureElementIds: [...manifest.lockedArchitectureElementIds],
            hardRules: structuredClone(manifest.hardRules),
            budget: structuredClone(manifest.budget),
            ...(manifest.priority ? { priority: manifest.priority } : {}),
            ...(manifest.targetP90WaitSeconds === undefined ? {} : { targetP90WaitSeconds: manifest.targetP90WaitSeconds }),
            objective: manifest.priority ?? 'balanced',
            resultHash: finalist.hash,
            resultMetrics: scoreRecord(finalist.score),
          },
        }
        const result = state.adoptAutoLayoutCandidate({
          expectedDocumentId: run.documentId,
          expectedRevision: run.revision,
          runId: run.runId,
          resultId: finalist.id,
          baselineVariantId: run.variantId,
          newVariantId: parsed.value.newVariantId,
          name: parsed.value.name,
          candidate: adopted,
        })
        if (!result.ok) return {
          ok: false as const,
          revision: result.revision,
          code: result.code,
          message: result.message,
          ...('issues' in result && result.issues !== undefined ? { issues: result.issues } : {}),
          ...('operationIndex' in result && result.operationIndex !== undefined ? { operationIndex: result.operationIndex } : {}),
        }
        return success(result.revision, {
          runId: run.runId,
          resultId: finalist.id,
          newVariantId: parsed.value.newVariantId,
          name: parsed.value.name,
          changedIds: 'changedIds' in result ? result.changedIds : [parsed.value.newVariantId],
          note: 'The finalist was saved as a new child layout; the baseline was not overwritten.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [compareLayouts, runAutoLayout, getAutoLayoutRun, cancelAutoLayoutRun, adoptAutoLayoutCandidate]
}
