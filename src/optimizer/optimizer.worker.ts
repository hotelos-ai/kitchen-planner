import type { LayoutVariant, SimulationScenario } from '../domain/project'
import { scenarioSchema, variantSchema } from '../domain/project-schema'
import { runSimulation } from '../simulation/engine'
import { optimizerManifestSchema } from './experiment-schema'
import { runAnytimeSearch } from './search'
import type { OptimizerMetrics, SearchEvaluationInput } from './types'
import type {
  OptimizerWorkerErrorCode,
  OptimizerWorkerInput,
  OptimizerWorkerOutput,
  OptimizerWorkerStartMessage,
} from './worker-protocol'

type RuntimeDependencies = {
  postMessage(message: OptimizerWorkerOutput): void
  evaluate?(input: SearchEvaluationInput): OptimizerMetrics
  now?(): number
  schedule?(run: () => void): void
}

export interface OptimizerWorkerRuntime {
  handleMessage(message: OptimizerWorkerInput): void
}

const defaultSchedule = (run: () => void) => { setTimeout(run, 0) }

const simulationEvaluator = (
  scenarios: readonly SimulationScenario[],
): ((input: SearchEvaluationInput) => OptimizerMetrics) => ({ candidate, seed }) => {
  const results = scenarios.map((scenario) => runSimulation({
    architecture: candidate.architecture,
    equipment: candidate.equipment,
    layoutConstraints: candidate.layoutConstraints,
    scenario: { ...scenario, seed },
    outputMode: 'metrics-only',
  }).metrics)
  return {
    unfinishedOrders: results.reduce((total, value) => total + value.unfinishedOrders, 0),
    p90WaitSeconds: Math.max(...results.map((value) => value.orderCompletionP90Seconds)),
    peakBacklog: Math.max(...results.map((value) => value.peakOrderBacklog)),
    totalTravelMm: results.reduce((total, value) => total + value.totalTravelMm, 0),
    congestionEvents: results.reduce((total, value) => total + value.congestionEvents, 0),
  }
}

function validateStart(message: OptimizerWorkerStartMessage):
  | { ok: true; manifest: ReturnType<typeof optimizerManifestSchema.parse>; baseline: LayoutVariant; scenarios: SimulationScenario[] }
  | { ok: false; code: OptimizerWorkerErrorCode; message: string; issues?: unknown } {
  const manifest = optimizerManifestSchema.safeParse(message.manifest)
  if (!manifest.success) return {
    ok: false,
    code: 'invalid-manifest',
    message: 'The optimizer manifest is malformed.',
    issues: manifest.error.issues,
  }
  if (manifest.data.documentId !== message.binding.documentId) return {
    ok: false,
    code: 'stale-document',
    message: `Manifest document ${manifest.data.documentId} does not match current document ${message.binding.documentId}.`,
  }
  if (manifest.data.revision !== message.binding.revision) return {
    ok: false,
    code: 'stale-revision',
    message: `Manifest revision ${manifest.data.revision} does not match current revision ${message.binding.revision}.`,
  }
  const baseline = variantSchema.safeParse(message.baseline)
  if (!baseline.success) return {
    ok: false,
    code: 'invalid-baseline',
    message: 'The optimizer baseline layout is malformed.',
    issues: baseline.error.issues,
  }
  if (baseline.data.id !== manifest.data.baselineVariantId) return {
    ok: false,
    code: 'baseline-mismatch',
    message: `Manifest baseline ${manifest.data.baselineVariantId} does not match supplied baseline ${baseline.data.id}.`,
  }
  const scenarios = scenarioSchema.array().safeParse(message.scenarios)
  if (!scenarios.success) return {
    ok: false,
    code: 'invalid-scenarios',
    message: 'The optimizer scenarios are malformed.',
    issues: scenarios.error.issues,
  }
  const supplied = new Set(scenarios.data.map((scenario) => scenario.id))
  const missing = manifest.data.scenarioIds.find((id) => !supplied.has(id))
  if (missing) return {
    ok: false,
    code: 'missing-scenario',
    message: `Manifest scenario ${missing} was not supplied to the Worker.`,
  }
  const selected = new Map(scenarios.data.map((scenario) => [scenario.id, scenario]))
  return {
    ok: true,
    manifest: manifest.data,
    baseline: baseline.data,
    scenarios: manifest.data.scenarioIds.map((id) => selected.get(id)!),
  }
}

export function createOptimizerWorkerRuntime(dependencies: RuntimeDependencies): OptimizerWorkerRuntime {
  const schedule = dependencies.schedule ?? defaultSchedule
  const runs = new Map<string, { cancelled: boolean }>()

  const postError = (runId: string, code: OptimizerWorkerErrorCode, message: string, issues?: unknown) => {
    dependencies.postMessage({ type: 'error', runId, code, message, ...(issues === undefined ? {} : { issues }) })
  }

  return {
    handleMessage(message) {
      if (message.type === 'cancel') {
        const run = runs.get(message.runId)
        if (run) run.cancelled = true
        return
      }

      const validated = validateStart(message)
      if (!validated.ok) {
        postError(message.runId, validated.code, validated.message, validated.issues)
        return
      }
      if (runs.has(message.runId)) {
        postError(message.runId, 'worker-error', `Optimizer run ${message.runId} is already active.`)
        return
      }
      const state = { cancelled: false }
      runs.set(message.runId, state)
      schedule(() => {
        let sequence = 0
        try {
          const result = runAnytimeSearch({
            baseline: validated.baseline,
            manifest: validated.manifest,
            evaluate: dependencies.evaluate ?? simulationEvaluator(validated.scenarios),
            isCancelled: () => state.cancelled,
            now: dependencies.now,
            onProgress: (progress) => dependencies.postMessage({
              type: 'progress',
              runId: message.runId,
              progress: { sequence: sequence++, ...progress },
            }),
          })
          dependencies.postMessage({ type: 'result', runId: message.runId, result })
        } catch (error) {
          postError(message.runId, 'worker-error', error instanceof Error ? error.message : 'Optimizer Worker failed unexpectedly.')
        } finally {
          runs.delete(message.runId)
        }
      })
    },
  }
}

type WorkerGlobal = typeof globalThis & {
  document?: unknown
  postMessage?: (message: OptimizerWorkerOutput) => void
  addEventListener?: (type: 'message', listener: (event: { data: OptimizerWorkerInput }) => void) => void
}

const workerScope = globalThis as WorkerGlobal
if (workerScope.document === undefined && typeof workerScope.postMessage === 'function' && typeof workerScope.addEventListener === 'function') {
  const runtime = createOptimizerWorkerRuntime({ postMessage: (message) => workerScope.postMessage!(message) })
  workerScope.addEventListener('message', (event) => runtime.handleMessage(event.data))
}
