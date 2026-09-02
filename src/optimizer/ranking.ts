import type { OptimizerScore } from './types'

export interface RankedCandidate { id: string; score: OptimizerScore }

const order: Array<keyof OptimizerScore> = [
  'unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'totalTravelMm', 'congestionEvents', 'changeCost',
]

export function lexicographicCompare(left: RankedCandidate, right: RankedCandidate): number {
  for (const key of order) {
    const delta = left.score[key] - right.score[key]
    if (delta !== 0) return delta
  }
  return left.id.localeCompare(right.id)
}

const paretoKeys: Array<keyof OptimizerScore> = ['unfinishedOrders', 'p90WaitSeconds', 'peakBacklog', 'totalTravelMm', 'congestionEvents', 'changeCost']

export function paretoFinalists<T extends RankedCandidate>(candidates: readonly T[]): T[] {
  return candidates.filter((candidate) => !candidates.some((other) => {
    if (other === candidate) return false
    const noWorse = paretoKeys.every((key) => other.score[key] <= candidate.score[key])
    const better = paretoKeys.some((key) => other.score[key] < candidate.score[key])
    return noWorse && better
  })).sort(lexicographicCompare)
}
