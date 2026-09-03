import type { SimulationInput, SimulationResult } from './types'

export type SimulationWorkerInput = {
  type: 'run'
  runId: string
  input: SimulationInput
}

export type SimulationWorkerOutput =
  | { type: 'result'; runId: string; result: SimulationResult }
  | { type: 'error'; runId: string; message: string }

export type SimulationWorkerLike = {
  postMessage(message: SimulationWorkerInput): void
  addEventListener(type: 'message', listener: (event: { data: SimulationWorkerOutput }) => void): void
  removeEventListener(type: 'message', listener: (event: { data: SimulationWorkerOutput }) => void): void
  terminate(): void
}
