import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import type { SimulationWorkerInput, SimulationWorkerLike, SimulationWorkerOutput } from './worker-protocol'
import { runSimulationResponsive, SimulationRunCancelledError } from './responsive-runner'
import { createSimulationWorkerRuntime } from './simulation.worker'

const simulationInput = (covers: number) => {
  const project = createSeedProject()
  const variant = project.variants[0]
  return {
    architecture: variant.architecture,
    equipment: variant.equipment,
    scenario: { ...project.scenarios[0], covers },
    layoutConstraints: variant.layoutConstraints,
  }
}

describe('responsive simulation runner', () => {
  it('executes a complete simulation inside the Worker runtime', () => {
    const messages: SimulationWorkerOutput[] = []
    const runtime = createSimulationWorkerRuntime({ postMessage: (message) => messages.push(message) })
    runtime.handleMessage({ type: 'run', runId: 'runtime-run', input: simulationInput(12) })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      type: 'result',
      runId: 'runtime-run',
      result: { metrics: { totalOrders: expect.any(Number) } },
    })
  })

  it('runs small services locally without starting a Worker', async () => {
    const createWorker = vi.fn()
    const result = await runSimulationResponsive(simulationInput(20), { createWorker })
    expect(result.metrics.totalOrders).toBeGreaterThan(0)
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('runs high-cover services in a Worker and terminates after the result', async () => {
    let listener: ((event: { data: SimulationWorkerOutput }) => void) | undefined
    const worker: SimulationWorkerLike = {
      postMessage: vi.fn((message: SimulationWorkerInput) => {
        queueMicrotask(() => listener?.({
          data: { type: 'error', runId: message.runId, message: 'synthetic worker result' },
        }))
      }),
      addEventListener: (_type, next) => { listener = next },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    await expect(runSimulationResponsive(simulationInput(120), { createWorker: () => worker, runId: 'high-cover' }))
      .rejects.toThrow('synthetic worker result')
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'run', runId: 'high-cover' }))
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates high-cover work immediately on abort', async () => {
    const controller = new AbortController()
    const worker: SimulationWorkerLike = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    }
    const promise = runSimulationResponsive(simulationInput(300), {
      createWorker: () => worker,
      runId: 'cancel-me',
      signal: controller.signal,
    })
    controller.abort()
    await expect(promise).rejects.toBeInstanceOf(SimulationRunCancelledError)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
