import { runSimulation } from './engine'
import type { SimulationWorkerInput, SimulationWorkerOutput } from './worker-protocol'

type RuntimeDependencies = { postMessage(message: SimulationWorkerOutput): void }

export const createSimulationWorkerRuntime = (dependencies: RuntimeDependencies) => ({
  handleMessage(message: SimulationWorkerInput) {
    try {
      dependencies.postMessage({
        type: 'result',
        runId: message.runId,
        result: runSimulation(message.input),
      })
    } catch (error) {
      dependencies.postMessage({
        type: 'error',
        runId: message.runId,
        message: error instanceof Error ? error.message : 'Simulation Worker failed unexpectedly.',
      })
    }
  },
})

type WorkerScope = typeof globalThis & {
  document?: unknown
  postMessage?: (message: SimulationWorkerOutput) => void
  addEventListener?: (type: 'message', listener: (event: { data: SimulationWorkerInput }) => void) => void
}

const workerScope = globalThis as WorkerScope
if (workerScope.document === undefined && typeof workerScope.postMessage === 'function' && typeof workerScope.addEventListener === 'function') {
  const runtime = createSimulationWorkerRuntime({ postMessage: (message) => workerScope.postMessage!(message) })
  workerScope.addEventListener('message', (event) => runtime.handleMessage(event.data))
}
