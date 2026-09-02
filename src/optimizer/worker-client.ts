import type { AnytimeSearchResult } from './types'
import type {
  OptimizerWorkerErrorCode,
  OptimizerWorkerInput,
  OptimizerWorkerOutput,
  OptimizerWorkerProgress,
  OptimizerWorkerRunRequest,
} from './worker-protocol'

type WorkerMessageListener = (event: { data: OptimizerWorkerOutput }) => void

export interface WorkerLike {
  postMessage(message: OptimizerWorkerInput): void
  addEventListener(type: 'message', listener: WorkerMessageListener): void
  removeEventListener(type: 'message', listener: WorkerMessageListener): void
  terminate?(): void
}

type WorkerClientDependencies = {
  createWorker(): WorkerLike
  getSnapshot(): { documentId: string; revision: number }
}

type StartOptions = {
  onProgress?(progress: OptimizerWorkerProgress): void
}

type ActiveRun = {
  worker: WorkerLike
  listener: WorkerMessageListener
  reject(error: OptimizerWorkerClientError): void
}

export class OptimizerWorkerClientError extends Error {
  readonly code: OptimizerWorkerErrorCode
  readonly issues?: unknown

  constructor(code: OptimizerWorkerErrorCode, message: string, issues?: unknown) {
    super(message)
    this.name = 'OptimizerWorkerClientError'
    this.code = code
    this.issues = issues
  }
}

export interface OptimizerWorkerClient {
  start(request: OptimizerWorkerRunRequest, options?: StartOptions): Promise<AnytimeSearchResult>
  cancel(runId: string): boolean
}

export function createOptimizerWorkerClient(dependencies: WorkerClientDependencies): OptimizerWorkerClient {
  const active = new Map<string, ActiveRun>()

  const cleanup = (runId: string, terminate: boolean) => {
    const run = active.get(runId)
    if (!run) return
    active.delete(runId)
    run.worker.removeEventListener('message', run.listener)
    if (terminate) run.worker.terminate?.()
  }

  return {
    start(request, options = {}) {
      const snapshot = dependencies.getSnapshot()
      if (request.manifest.documentId !== snapshot.documentId) return Promise.reject(new OptimizerWorkerClientError(
        'stale-document',
        `Manifest document ${request.manifest.documentId} does not match current document ${snapshot.documentId}.`,
      ))
      if (request.manifest.revision !== snapshot.revision) return Promise.reject(new OptimizerWorkerClientError(
        'stale-revision',
        `Manifest revision ${request.manifest.revision} does not match current revision ${snapshot.revision}.`,
      ))
      if (active.has(request.runId)) return Promise.reject(new OptimizerWorkerClientError(
        'worker-error',
        `Optimizer run ${request.runId} is already active.`,
      ))

      return new Promise<AnytimeSearchResult>((resolve, reject) => {
        const worker = dependencies.createWorker()
        const listener: WorkerMessageListener = ({ data }) => {
          if (data.runId !== request.runId) return
          if (data.type === 'progress') {
            options.onProgress?.(data.progress)
            return
          }
          cleanup(request.runId, true)
          if (data.type === 'result') resolve(data.result)
          else reject(new OptimizerWorkerClientError(data.code, data.message, data.issues))
        }
        active.set(request.runId, {
          worker,
          listener,
          reject: (error) => reject(error),
        })
        worker.addEventListener('message', listener)
        try {
          worker.postMessage({
            type: 'start',
            ...request,
            binding: snapshot,
          })
        } catch (error) {
          cleanup(request.runId, true)
          reject(new OptimizerWorkerClientError(
            'worker-error',
            error instanceof Error ? error.message : 'Unable to start optimizer Worker.',
          ))
        }
      })
    },

    cancel(runId) {
      const run = active.get(runId)
      if (!run) return false
      try {
        run.worker.postMessage({ type: 'cancel', runId })
      } finally {
        cleanup(runId, true)
        run.reject(new OptimizerWorkerClientError('cancelled', `Optimizer run ${runId} was cancelled.`))
      }
      return true
    },
  }
}
