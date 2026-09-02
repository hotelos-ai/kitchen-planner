import type { AutoLayoutPermissions, LayoutVariant, RectMm, StationCapability } from '../domain/project'

export interface OptimizerManifest {
  id: string
  documentId: string
  revision: number
  baselineVariantId: string
  scenarioIds: string[]
  seeds: number[]
  confirmationSeeds: number[]
  permissions: AutoLayoutPermissions
  lockedComponentIds: string[]
  lockedArchitectureElementIds: string[]
  hardRules: {
    minimumAisleMm: number
    bodyRadiusMm?: number
    noGoZones: RectMm[]
    requiredCapacityByCapability?: Partial<Record<StationCapability, number>>
  }
  budget: { maxEvaluations: number; maxDurationMs: number }
  priority?: 'balanced' | 'service' | 'travel' | 'minimal-change'
  targetP90WaitSeconds?: number
}

export interface OptimizerMetrics {
  unfinishedOrders: number
  p90WaitSeconds: number
  peakBacklog: number
  totalTravelMm: number
  congestionEvents: number
  completionPct?: number
  throughputPerHour?: number
}

export interface OptimizerScore extends OptimizerMetrics { changeCost: number }

export interface EvaluatedCandidate {
  id: string
  hash: string
  variant: LayoutVariant
  score: OptimizerScore
  evaluatedSeeds: number[]
  confirmationSeeds: number[]
  diff: { moved: string[]; rotated: string[]; resized: string[]; substituted: string[]; added: string[]; removed: string[]; architectureChanged: boolean }
}

export interface SearchEvaluationInput {
  candidate: LayoutVariant
  candidateHash: string
  seed: number
  confirmation: boolean
}

export interface AnytimeSearchResult {
  manifest: OptimizerManifest
  candidates: EvaluatedCandidate[]
  finalists: EvaluatedCandidate[]
  evaluationCount: number
  searchStats?: {
    generatedCandidates: number
    uniqueCandidates: number
    infeasibleCandidates: number
    prunedCandidates: number
    evaluatedCandidates: number
    evaluationCacheEntries: number
    evaluationCacheHits: number
  }
  diagnostics?: {
    feasibilityReasonCounts: Record<string, number>
    simulationRejectionCount: number
    simulationRejectionMessages: string[]
  }
  termination: 'exhausted' | 'evaluation-budget' | 'time-budget' | 'cancelled'
  bestObservedDisclaimer: string
}
