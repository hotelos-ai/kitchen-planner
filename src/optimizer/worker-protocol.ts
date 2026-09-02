import type { LayoutVariant, SimulationScenario } from '../domain/project'
import type { AnytimeSearchResult, OptimizerManifest } from './types'

export type OptimizerWorkerErrorCode =
  | 'invalid-manifest'
  | 'invalid-baseline'
  | 'invalid-scenarios'
  | 'stale-document'
  | 'stale-revision'
  | 'baseline-mismatch'
  | 'missing-scenario'
  | 'cancelled'
  | 'worker-error'

export interface OptimizerWorkerBinding {
  documentId: string
  revision: number
}

export interface OptimizerWorkerRunRequest {
  runId: string
  manifest: OptimizerManifest
  baseline: LayoutVariant
  scenarios: SimulationScenario[]
}

export interface OptimizerWorkerStartMessage extends OptimizerWorkerRunRequest {
  type: 'start'
  binding: OptimizerWorkerBinding
}

export interface OptimizerWorkerCancelMessage {
  type: 'cancel'
  runId: string
}

export type OptimizerWorkerInput = OptimizerWorkerStartMessage | OptimizerWorkerCancelMessage

export interface OptimizerWorkerProgress {
  sequence: number
  phase: 'feasibility' | 'simulation' | 'confirmation'
  candidates: number
  evaluations: number
  bestHash?: string
}

export interface OptimizerWorkerProgressMessage {
  type: 'progress'
  runId: string
  progress: OptimizerWorkerProgress
}

export interface OptimizerWorkerResultMessage {
  type: 'result'
  runId: string
  result: AnytimeSearchResult
}

export interface OptimizerWorkerErrorMessage {
  type: 'error'
  runId: string
  code: OptimizerWorkerErrorCode
  message: string
  issues?: unknown
}

export type OptimizerWorkerOutput =
  | OptimizerWorkerProgressMessage
  | OptimizerWorkerResultMessage
  | OptimizerWorkerErrorMessage
