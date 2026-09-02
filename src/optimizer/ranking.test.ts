import { describe, expect, it } from 'vitest'
import { lexicographicCompare, paretoFinalists, type RankedCandidate } from './ranking'

const candidate = (id: string, patch: Partial<RankedCandidate['score']>): RankedCandidate => ({
  id,
  score: { unfinishedOrders: 0, p90WaitSeconds: 500, peakBacklog: 5, totalTravelMm: 10_000, congestionEvents: 2, changeCost: 3, ...patch },
})

describe('optimizer ranking', () => {
  it('ranks service viability before waits, travel, congestion, and change cost', () => {
    const completed = candidate('completed', { p90WaitSeconds: 900, totalTravelMm: 20_000 })
    const unfinished = candidate('unfinished', { unfinishedOrders: 1, p90WaitSeconds: 100, totalTravelMm: 1_000 })
    expect([unfinished, completed].sort(lexicographicCompare).map((item) => item.id)).toEqual(['completed', 'unfinished'])

    const robustWait = candidate('robust-wait', { p90WaitSeconds: 400, peakBacklog: 20, totalTravelMm: 50_000 })
    const shortTravel = candidate('short-travel', { p90WaitSeconds: 500, peakBacklog: 1, totalTravelMm: 1_000 })
    expect([shortTravel, robustWait].sort(lexicographicCompare).map((item) => item.id)).toEqual(['robust-wait', 'short-travel'])

    const lowBacklog = candidate('low-backlog', { peakBacklog: 3, totalTravelMm: 50_000 })
    const lowDistance = candidate('low-distance', { peakBacklog: 5, totalTravelMm: 1_000 })
    expect([lowDistance, lowBacklog].sort(lexicographicCompare).map((item) => item.id)).toEqual(['low-backlog', 'low-distance'])
  })

  it('keeps non-dominated Pareto candidates', () => {
    const fastest = candidate('fastest', { p90WaitSeconds: 300, totalTravelMm: 15_000, changeCost: 8 })
    const leastTravel = candidate('travel', { p90WaitSeconds: 450, totalTravelMm: 7_000, changeCost: 6 })
    const dominated = candidate('dominated', { p90WaitSeconds: 600, totalTravelMm: 20_000, changeCost: 10 })
    expect(paretoFinalists([fastest, leastTravel, dominated]).map((item) => item.id)).toEqual(['fastest', 'travel'])
  })

  it('never lets priority outrank service viability, P90 wait, or backlog', () => {
    const fast = candidate('fast', { p90WaitSeconds: 300, totalTravelMm: 30_000, changeCost: 8 })
    const short = candidate('short', { p90WaitSeconds: 600, totalTravelMm: 5_000, changeCost: 5 })
    const minimal = candidate('minimal', { p90WaitSeconds: 700, totalTravelMm: 10_000, changeCost: 0 })

    expect([minimal, short, fast].sort((left, right) => lexicographicCompare(left, right, 'service')).map((item) => item.id)).toEqual(['fast', 'short', 'minimal'])
    expect([minimal, short, fast].sort((left, right) => lexicographicCompare(left, right, 'travel')).map((item) => item.id)).toEqual(['fast', 'short', 'minimal'])
    expect([minimal, short, fast].sort((left, right) => lexicographicCompare(left, right, 'minimal-change')).map((item) => item.id)).toEqual(['fast', 'short', 'minimal'])

    const tiedForService = [
      candidate('travel', { totalTravelMm: 5_000, changeCost: 5 }),
      candidate('change', { totalTravelMm: 10_000, changeCost: 0 }),
    ]
    expect([...tiedForService].sort((left, right) => lexicographicCompare(left, right, 'travel')).map((item) => item.id)).toEqual(['travel', 'change'])
    expect([...tiedForService].sort((left, right) => lexicographicCompare(left, right, 'minimal-change')).map((item) => item.id)).toEqual(['change', 'travel'])
  })
})
