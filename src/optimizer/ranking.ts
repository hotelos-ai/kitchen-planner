import type { OptimizerScore } from './types'

export interface RankedCandidate { id: string; score: OptimizerScore }

type OptimizerPriority = 'balanced' | 'service' | 'travel' | 'minimal-change'

const orders: Record<OptimizerPriority, Array<keyof OptimizerScore>> = {
  balanced: ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'totalTravelMm', 'congestionEvents', 'changeCost'],
  service: ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'congestionEvents', 'totalTravelMm', 'changeCost'],
  travel: ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'totalTravelMm', 'congestionEvents', 'changeCost'],
  'minimal-change': ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'changeCost', 'totalTravelMm', 'congestionEvents'],
}

export function lexicographicCompare(left: RankedCandidate, right: RankedCandidate, priority: OptimizerPriority = 'balanced'): number {
  for (const key of orders[priority]) {
    const delta = (left.score[key] ?? 0) - (right.score[key] ?? 0)
    if (delta !== 0) return delta
  }
  return left.id.localeCompare(right.id)
}

const paretoKeys = ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'totalTravelMm', 'congestionEvents', 'changeCost'] as const

export function paretoFinalists<T extends RankedCandidate>(candidates: readonly T[], priority: OptimizerPriority = 'balanced'): T[] {
  return candidates.filter((candidate) => !candidates.some((other) => {
    if (other === candidate) return false
    const noWorse = paretoKeys.every((key) => other.score[key] <= candidate.score[key])
    const better = paretoKeys.some((key) => other.score[key] < candidate.score[key])
    return noWorse && better
  })).sort((left, right) => lexicographicCompare(left, right, priority))
}
