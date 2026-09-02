import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createOptimizerWorkerRuntime, createSimulationEvaluator } from './optimizer.worker'
import { createOptimizerWorkerClient, OptimizerWorkerClientError, type WorkerLike } from './worker-client'
import type {
  OptimizerWorkerInput,
  OptimizerWorkerOutput,
  OptimizerWorkerProgressMessage,
  OptimizerWorkerStartMessage,
} from './worker-protocol'
import type { OptimizerManifest, OptimizerMetrics, SearchEvaluationInput } from './types'

const project = createSeedProject()
const baseline = project.variants[0]
const scenario = project.scenarios[0]

const manifest = (overrides: Partial<OptimizerManifest> = {}): OptimizerManifest => ({
  id: 'experiment-worker',
  documentId: 'document-1',
  revision: 4,
  baselineVariantId: baseline.id,
  scenarioIds: [scenario.id],
  seeds: [3, 5],
  confirmationSeeds: [101],
  permissions: { placement: true, equipmentRedesign: false, architecture: false },
  lockedComponentIds: [],
  lockedArchitectureElementIds: [],
  hardRules: { minimumAisleMm: 700, noGoZones: [] },
  budget: { maxEvaluations: 12, maxDurationMs: 30_000 },
  ...overrides,
})

const metrics = ({ candidateHash, seed }: SearchEvaluationInput): OptimizerMetrics => ({
  unfinishedOrders: 0,
  p90WaitSeconds: 300 + seed,
  peakBacklog: 4,
  totalTravelMm: 10_000 + candidateHash.charCodeAt(0) + seed,
  congestionEvents: 1,
})

type Listener = (event: { data: OptimizerWorkerOutput }) => void

function runtimeWorker(options: {
  evaluate?: (input: SearchEvaluationInput) => OptimizerMetrics
  now?: () => number
} = {}): WorkerLike {
  const listeners = new Set<Listener>()
  const runtime = createOptimizerWorkerRuntime({
    evaluate: options.evaluate ?? metrics,
    now: options.now,
    schedule: (run) => run(),
    postMessage: (message) => listeners.forEach((listener) => listener({ data: message })),
  })
  return {
    postMessage: (message) => runtime.handleMessage(message),
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    terminate: vi.fn(),
  }
}

const request = (runId: string, value = manifest()) => ({
  runId,
  manifest: value,
  baseline,
  scenarios: [scenario],
})

describe('optimizer Worker protocol', () => {
  it('emits deterministic progress traces and results from the pure search', async () => {
    const client = createOptimizerWorkerClient({
      createWorker: () => runtimeWorker(),
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })
    const firstTrace: OptimizerWorkerProgressMessage['progress'][] = []
    const secondTrace: OptimizerWorkerProgressMessage['progress'][] = []

    const first = await client.start(request('run-1'), { onProgress: (progress) => firstTrace.push(progress) })
    const second = await client.start(request('run-2'), { onProgress: (progress) => secondTrace.push(progress) })

    expect(firstTrace).toEqual(secondTrace)
    expect(firstTrace.map((entry) => entry.phase)).toContain('feasibility')
    expect(first.candidates.map((entry) => entry.hash)).toEqual(second.candidates.map((entry) => entry.hash))
    expect(first.evaluationCount).toBe(second.evaluationCount)
  })

  it('injects frozen hard circulation rules into every simulated candidate', async () => {
    const evaluated: SearchEvaluationInput[] = []
    const client = createOptimizerWorkerClient({
      createWorker: () => runtimeWorker({ evaluate: (input) => { evaluated.push(input); return metrics(input) } }),
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })
    await client.start(request('hard-rules', manifest({
      hardRules: { minimumAisleMm: 1200, bodyRadiusMm: 275, noGoZones: [{ id: 'gas', xMm: 20, yMm: 20, widthMm: 50, depthMm: 50 }] },
    })))
    expect(evaluated.length).toBeGreaterThan(0)
    expect(evaluated.every(({ candidate }) => candidate.layoutConstraints?.minimumAisleMm === 1200
      && candidate.layoutConstraints.noGoZones?.[0]?.id === 'gas')).toBe(true)
  })

  it('reports production completion and throughput metrics from metrics-only simulations', () => {
    const evaluate = createSimulationEvaluator([scenario])
    const result = evaluate({
      candidate: { ...structuredClone(baseline), layoutConstraints: { minimumAisleMm: 0 } },
      candidateHash: 'baseline',
      seed: 3,
      confirmation: false,
    })

    expect(result.completionPct).toBeGreaterThan(0)
    expect(result.completionPct).toBeLessThanOrEqual(100)
    expect(result.throughputPerHour).toBeGreaterThan(0)
  })

  it('strictly rejects unknown manifest fields with a stable error code', async () => {
    const invalid = { ...manifest(), unexpected: true } as unknown as OptimizerManifest
    const client = createOptimizerWorkerClient({
      createWorker: () => runtimeWorker(),
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })

    await expect(client.start(request('invalid', invalid))).rejects.toMatchObject({ code: 'invalid-manifest' })
  })

  it('rejects stale revision and document bindings before creating a Worker', async () => {
    const createWorker = vi.fn(() => runtimeWorker())
    const client = createOptimizerWorkerClient({
      createWorker,
      getSnapshot: () => ({ documentId: 'document-1', revision: 5 }),
    })

    await expect(client.start(request('stale'))).rejects.toMatchObject({ code: 'stale-revision' })
    expect(createWorker).not.toHaveBeenCalled()

    const wrongDocumentClient = createOptimizerWorkerClient({
      createWorker,
      getSnapshot: () => ({ documentId: 'document-2', revision: 4 }),
    })
    await expect(wrongDocumentClient.start(request('wrong-document'))).rejects.toMatchObject({ code: 'stale-document' })
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('cancels a pending run, tells the Worker, terminates it, and ignores late results', async () => {
    let listener: Listener | undefined
    const worker: WorkerLike = {
      postMessage: vi.fn(),
      addEventListener: (_type, next) => { listener = next },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    const client = createOptimizerWorkerClient({
      createWorker: () => worker,
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })
    const pending = client.start(request('cancel-me'))

    expect(client.cancel('cancel-me')).toBe(true)
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', runId: 'cancel-me' })
    expect(worker.terminate).toHaveBeenCalledOnce()

    listener?.({ data: { type: 'error', runId: 'cancel-me', code: 'worker-error', message: 'late' } })
    expect(client.cancel('cancel-me')).toBe(false)
  })

  it('terminates at hard evaluation and time budgets', async () => {
    const evaluationClient = createOptimizerWorkerClient({
      createWorker: () => runtimeWorker(),
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })
    const evaluationResult = await evaluationClient.start(request('evaluation-budget', manifest({
      budget: { maxEvaluations: 2, maxDurationMs: 30_000 },
    })))
    expect(evaluationResult.termination).toBe('evaluation-budget')
    expect(evaluationResult.evaluationCount).toBeLessThanOrEqual(2)

    let elapsed = 0
    const timeClient = createOptimizerWorkerClient({
      createWorker: () => runtimeWorker({ now: () => { elapsed += 2; return elapsed } }),
      getSnapshot: () => ({ documentId: 'document-1', revision: 4 }),
    })
    const timeResult = await timeClient.start(request('time-budget', manifest({
      budget: { maxEvaluations: 12, maxDurationMs: 1 },
    })))
    expect(timeResult.termination).toBe('time-budget')
    expect(timeResult.evaluationCount).toBe(0)
  })

  it('honors cancel messages queued before a scheduled search starts', () => {
    const scheduled: Array<() => void> = []
    const output: OptimizerWorkerOutput[] = []
    const runtime = createOptimizerWorkerRuntime({
      evaluate: metrics,
      schedule: (run) => { scheduled.push(run) },
      postMessage: (message) => output.push(message),
    })
    const start: OptimizerWorkerStartMessage = {
      type: 'start',
      ...request('queued-cancel'),
      binding: { documentId: 'document-1', revision: 4 },
    }

    runtime.handleMessage(start)
    runtime.handleMessage({ type: 'cancel', runId: 'queued-cancel' })
    scheduled[0]()

    expect(output).toContainEqual(expect.objectContaining({
      type: 'result',
      runId: 'queued-cancel',
      result: expect.objectContaining({ termination: 'cancelled' }),
    }))
  })

  it('exposes stable typed client errors', () => {
    const error = new OptimizerWorkerClientError('worker-error', 'Worker failed')
    expect(error).toMatchObject({ name: 'OptimizerWorkerClientError', code: 'worker-error', message: 'Worker failed' })
    const input: OptimizerWorkerInput = { type: 'cancel', runId: 'run' }
    expect(input.type).toBe('cancel')
  })
})
