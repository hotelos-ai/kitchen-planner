import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import type { WorkerLike } from '../../optimizer/worker-client'
import type { OptimizerWorkerInput, OptimizerWorkerOutput } from '../../optimizer/worker-protocol'
import type { OptimizerManifest } from '../../optimizer/types'
import { createProjectStore } from '../../state/project-store'
import type { AutoLayoutProgress, AutoLayoutRunRequest } from './AutoLayoutWorkspace'
import { createBrowserAutoLayoutRunner } from './browser-auto-layout-runner'

type Listener = (event: { data: OptimizerWorkerOutput }) => void

const makeRequest = (store: ReturnType<typeof createProjectStore>): AutoLayoutRunRequest => {
  const state = store.getState()
  const baseline = state.project.variants[0]
  const scenario = state.project.scenarios[0]
  const manifest: OptimizerManifest = {
    id: 'run-worker-ui',
    documentId: state.documentId,
    revision: state.revision,
    baselineVariantId: baseline.id,
    scenarioIds: [scenario.id],
    seeds: [3],
    confirmationSeeds: [101],
    permissionTier: 'A',
    lockedComponentIds: [],
    lockedArchitectureElementIds: [],
    hardRules: { minimumAisleMm: 900, noGoZones: [] },
    budget: { maxEvaluations: 12, maxDurationMs: 30_000 },
  }
  return { baseline, scenario, manifest }
}

describe('browser auto-layout runner', () => {
  it('adapts UI requests, Worker progress, results, and cancellation', async () => {
    const store = createProjectStore(createSeedProject())
    let listener: Listener | undefined
    const posted: OptimizerWorkerInput[] = []
    const worker: WorkerLike = {
      postMessage: (message) => { posted.push(message) },
      addEventListener: (_type, next) => { listener = next },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    const runner = createBrowserAutoLayoutRunner(store, { createWorker: () => worker, now: () => 1250 })
    const progress: AutoLayoutProgress[] = []
    const request = makeRequest(store)
    const pending = runner.run(request, (next) => progress.push(next))

    expect(posted[0]).toMatchObject({
      type: 'start', runId: 'run-worker-ui', baseline: request.baseline,
      scenarios: [request.scenario], binding: { documentId: request.manifest.documentId, revision: 0 },
    })
    listener?.({ data: { type: 'progress', runId: 'run-worker-ui', progress: { sequence: 1, phase: 'feasibility', candidates: 7, evaluations: 0 } } })
    listener?.({ data: { type: 'progress', runId: 'run-worker-ui', progress: { sequence: 2, phase: 'simulation', candidates: 4, evaluations: 8, bestHash: 'best-hash' } } })
    expect(progress.at(-1)).toEqual(expect.objectContaining({
      phase: 'simulation', feasibleCandidates: 7, simulatedCandidates: 4,
      candidateCount: 7, elapsedMs: 0, bestObserved: 'best-hash',
    }))

    expect(runner.cancel?.()).toBeUndefined()
    expect(posted.at(-1)).toEqual({ type: 'cancel', runId: 'run-worker-ui' })
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('rejects with a useful error when the browser cannot construct a Worker', async () => {
    const store = createProjectStore(createSeedProject())
    const runner = createBrowserAutoLayoutRunner(store, {
      createWorker: () => { throw new Error('Worker construction blocked') },
    })

    await expect(runner.run(makeRequest(store), vi.fn())).rejects.toThrow('Worker construction blocked')
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })
})
