import { createOptimizerWorkerClient, type WorkerLike } from '../../optimizer/worker-client'
import type { ProjectStore } from '../../state/project-store'
import type { AutoLayoutProgress, AutoLayoutRunner } from './AutoLayoutWorkspace'

type BrowserRunnerDependencies = {
  createWorker?: () => WorkerLike
  now?: () => number
}

const createWorker = (): WorkerLike => {
  if (!globalThis.Worker) throw new Error('Auto-layout is unavailable because this browser cannot start a Web Worker.')
  return new Worker(new URL('../../optimizer/optimizer.worker.ts', import.meta.url), { type: 'module' })
}

export function createBrowserAutoLayoutRunner(
  store: ProjectStore,
  dependencies: BrowserRunnerDependencies = {},
): AutoLayoutRunner {
  const now = dependencies.now ?? (() => performance.now())
  const client = createOptimizerWorkerClient({
    createWorker: dependencies.createWorker ?? createWorker,
    getSnapshot: () => {
      const state = store.getState()
      return { documentId: state.documentId, revision: state.revision }
    },
  })
  let activeRunId: string | undefined
  let feasibleCandidates = 0

  return {
    async run(request, onProgress) {
      const runId = request.manifest.id
      const startedAt = now()
      activeRunId = runId
      feasibleCandidates = 0
      try {
        return await client.start({
          runId,
          manifest: request.manifest,
          baseline: request.baseline,
          scenarios: [request.scenario],
        }, {
          onProgress: (workerProgress) => {
            if (workerProgress.phase === 'feasibility') feasibleCandidates = workerProgress.candidates
            const progress: AutoLayoutProgress = {
              phase: workerProgress.phase,
              feasibleCandidates: Math.max(feasibleCandidates, workerProgress.candidates),
              prunedCandidates: 0,
              simulatedCandidates: workerProgress.phase === 'feasibility' ? 0 : workerProgress.candidates,
              candidateCount: Math.max(feasibleCandidates, workerProgress.candidates),
              elapsedMs: Math.max(0, now() - startedAt),
              bestObserved: workerProgress.bestHash,
            }
            onProgress(progress)
          },
        })
      } finally {
        if (activeRunId === runId) activeRunId = undefined
      }
    },
    cancel() {
      if (activeRunId) client.cancel(activeRunId)
    },
  }
}
