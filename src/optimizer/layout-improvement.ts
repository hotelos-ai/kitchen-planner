import type { OptimizerScore } from './types'

export type MetricDelta = {
  key: string
  label: string
  baseline: string
  candidate: string
  deltaLabel: string
  improved: boolean
  unchanged: boolean
  percent?: number
}

export type LayoutImprovement = {
  headline: string
  hasBaselineScore: boolean
  metrics: MetricDelta[]
  spatial: {
    moved: number
    rotated: number
    resized: number
    added: number
    removed: number
    changeCost: number
  }
}

const round1 = (value: number) => Number(value.toFixed(1))

const percentChange = (baseline: number, candidate: number) => {
  if (baseline === 0) return candidate === 0 ? 0 : undefined
  return round1(((candidate - baseline) / Math.abs(baseline)) * 100)
}

const formatMinutes = (seconds: number) => `${round1(seconds / 60)} min`
const formatMetres = (mm: number) => `${Math.round(mm / 1000)} m`
const formatCount = (value: number) => `${round1(value)}`

function metric(
  key: string,
  label: string,
  baseline: number,
  candidate: number,
  format: (value: number) => string,
  lowerIsBetter: boolean,
): MetricDelta {
  const delta = candidate - baseline
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const unchanged = delta === 0
  const percent = percentChange(baseline, candidate)
  return {
    key,
    label,
    baseline: format(baseline),
    candidate: format(candidate),
    deltaLabel: unchanged ? 'same' : `${delta > 0 ? '+' : ''}${format(delta)}`,
    improved,
    unchanged,
    percent,
  }
}

export function spatialFromDiff(diff: {
  moved: string[]
  rotated: string[]
  resized: string[]
  added: string[]
  removed: string[]
}, changeCost: number): LayoutImprovement['spatial'] {
  return {
    moved: diff.moved.length,
    rotated: diff.rotated.length,
    resized: diff.resized.length,
    added: diff.added.length,
    removed: diff.removed.length,
    changeCost,
  }
}

export function quantifyLayoutImprovement(input: {
  currentName: string
  currentScore?: OptimizerScore
  candidateScore: OptimizerScore
  spatial: LayoutImprovement['spatial']
}): LayoutImprovement {
  const { currentName, currentScore, candidateScore, spatial } = input
  if (!currentScore) {
    return {
      headline: `Current layout “${currentName}” was not scored in this run. Review the candidate metrics before choosing it.`,
      hasBaselineScore: false,
      metrics: [],
      spatial,
    }
  }

  const metrics = [
    metric('p90WaitSeconds', 'P90 wait', currentScore.p90WaitSeconds, candidateScore.p90WaitSeconds, formatMinutes, true),
    metric('totalTravelMm', 'Staff walking', currentScore.totalTravelMm, candidateScore.totalTravelMm, formatMetres, true),
    metric('peakBacklog', 'Peak backlog', currentScore.peakBacklog, candidateScore.peakBacklog, formatCount, true),
    metric('congestionEvents', 'Congestion', currentScore.congestionEvents, candidateScore.congestionEvents, formatCount, true),
    metric('unfinishedOrders', 'Unfinished orders', currentScore.unfinishedOrders, candidateScore.unfinishedOrders, formatCount, true),
  ]

  if (currentScore.throughputPerHour !== undefined && candidateScore.throughputPerHour !== undefined) {
    metrics.push(metric('throughputPerHour', 'Throughput', currentScore.throughputPerHour, candidateScore.throughputPerHour, (value) => `${round1(value)}/h`, false))
  }

  const wins = metrics.filter((entry) => entry.improved)
  const headline = wins.length
    ? `${wins.slice(0, 3).map((entry) => {
      const magnitude = entry.percent === undefined ? entry.deltaLabel.replace(/^[+-]/, '') : `${Math.abs(entry.percent)}%`
      return `${magnitude} better ${entry.label.toLowerCase()}`
    }).join(' · ')} vs ${currentName}`
    : metrics.every((entry) => entry.unchanged)
      ? `Same service scores as ${currentName}, with ${spatial.moved} moved items`
      : `No service improvement vs ${currentName}`

  return { headline, hasBaselineScore: true, metrics, spatial }
}
