import { runSimulation } from './engine'
import type { SimulationInput, SimulationResult } from './types'
import type { SimulationWorkerLike, SimulationWorkerOutput } from './worker-protocol'

export const SIMULATION_WORKER_COVER_THRESHOLD = 100

export class SimulationRunCancelledError extends Error {
  readonly code = 'cancelled'

  constructor(message = 'The simulation was cancelled.') {
    super(message)
    this.name = 'SimulationRunCancelledError'
  }
}

type ResponsiveRunOptions = {
  signal?: AbortSignal
  threshold?: number
  createWorker?: () => SimulationWorkerLike
  runId?: string
}

const defaultCreateWorker = (): SimulationWorkerLike =>
  new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })

/**
 * Keeps expensive high-cover simulations off the UI thread. Small runs stay
 * local to avoid Worker startup overhead; aborting a Worker terminates the
 * computation immediately and leaves the tab responsive.
 */
export function runSimulationResponsive(
  input: SimulationInput,
  options: ResponsiveRunOptions = {},
): Promise<SimulationResult> {
  if (options.signal?.aborted) return Promise.reject(new SimulationRunCancelledError())
  const threshold = options.threshold ?? SIMULATION_WORKER_COVER_THRESHOLD
  const WorkerConstructor = typeof Worker === 'undefined' ? undefined : Worker
  if (input.scenario.covers <= threshold || (!options.createWorker && !WorkerConstructor)) {
    return Promise.resolve().then(() => {
      if (options.signal?.aborted) throw new SimulationRunCancelledError()
      return runSimulation(input)
    })
  }

  return new Promise<SimulationResult>((resolve, reject) => {
    const worker = (options.createWorker ?? defaultCreateWorker)()
    const runId = options.runId ?? `simulation-${crypto.randomUUID()}`
    let settled = false
    const cleanup = () => {
      options.signal?.removeEventListener('abort', onAbort)
      worker.removeEventListener('message', onMessage)
      worker.terminate()
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onAbort = () => settle(() => reject(new SimulationRunCancelledError()))
    const onMessage = ({ data }: { data: SimulationWorkerOutput }) => {
      if (data.runId !== runId) return
      if (data.type === 'result') settle(() => resolve(data.result))
      else settle(() => reject(new Error(data.message)))
    }
    worker.addEventListener('message', onMessage)
    options.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      worker.postMessage({ type: 'run', runId, input: structuredClone(input) })
    } catch (error) {
      settle(() => reject(error))
    }
  })
}
