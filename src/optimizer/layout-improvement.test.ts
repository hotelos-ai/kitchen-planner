import { describe, expect, it } from 'vitest'
import { quantifyLayoutImprovement, spatialFromDiff } from './layout-improvement'

describe('layout improvement', () => {
  it('quantifies service gains against the current layout', () => {
    const improvement = quantifyLayoutImprovement({
      currentName: 'Layout A',
      currentScore: {
        unfinishedOrders: 2,
        p90WaitSeconds: 900,
        peakBacklog: 6,
        totalTravelMm: 12_000,
        congestionEvents: 4,
        changeCost: 0,
        throughputPerHour: 30,
      },
      candidateScore: {
        unfinishedOrders: 0,
        p90WaitSeconds: 600,
        peakBacklog: 4,
        totalTravelMm: 9_000,
        congestionEvents: 2,
        changeCost: 1,
        throughputPerHour: 42,
      },
      spatial: { moved: 3, rotated: 1, resized: 0, added: 0, removed: 0, changeCost: 1 },
    })

    expect(improvement.hasBaselineScore).toBe(true)
    expect(improvement.headline).toMatch(/33\.3% better p90 wait/i)
    expect(improvement.headline).toMatch(/25% better staff walking/i)
    expect(improvement.headline).toMatch(/vs Layout A/i)
    expect(improvement.metrics.find((entry) => entry.key === 'p90WaitSeconds')).toMatchObject({
      baseline: '15 min',
      candidate: '10 min',
      improved: true,
    })
  })

  it('explains when the current layout was not scored', () => {
    const improvement = quantifyLayoutImprovement({
      currentName: 'Layout A',
      candidateScore: {
        unfinishedOrders: 0,
        p90WaitSeconds: 600,
        peakBacklog: 4,
        totalTravelMm: 9_000,
        congestionEvents: 2,
        changeCost: 1,
      },
      spatial: spatialFromDiff({ moved: ['tandoor'], rotated: [], resized: [], added: [], removed: [] }, 1),
    })

    expect(improvement.hasBaselineScore).toBe(false)
    expect(improvement.headline).toMatch(/was not scored in this run/i)
    expect(improvement.spatial.moved).toBe(1)
  })
})
