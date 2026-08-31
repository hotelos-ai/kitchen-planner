import { describe, expect, it } from 'vitest'
import { emptyMetrics } from './metrics'
import { buildFindings } from './recommendations'
import type { SimulationResult } from './types'

const result = (patch: Partial<ReturnType<typeof emptyMetrics>>): SimulationResult => ({
  seed: 1, durationSeconds: 3600, frames: [], events: [], warnings: [], metrics: { ...emptyMetrics(), ...patch },
})

describe('layout recommendations', () => {
  it('recommends the candidate only when evidence improves a hot-line pressure point', () => {
    const findings = buildFindings({ baseline: result({ hotLineCongestionEvents: 50 }), candidate: result({ hotLineCongestionEvents: 12 }) })
    expect(findings).toContainEqual(expect.objectContaining({
      ruleId: 'hot-line-pinch-point', severity: 'high',
      evidence: expect.arrayContaining([expect.stringMatching(/congestion/i)]),
      delta: expect.objectContaining({ direction: 'improved' }),
    }))
  })

  it('preserves positive findings for compact wash-up zoning', () => {
    const good = result({ dirtyToWashTravelMm: 18000, unreachableTasks: 0 })
    expect(buildFindings({ baseline: good, candidate: good }).some((finding) => finding.ruleId === 'wash-route-performing-well')).toBe(true)
  })
})
