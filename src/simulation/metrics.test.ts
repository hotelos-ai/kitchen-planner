import { describe, expect, it } from 'vitest'
import { aggregateMetrics } from './metrics'
import type { SimulationEvent } from './types'

describe('simulation metrics', () => {
  it('aggregates travel, queueing, throughput, and traffic cells', () => {
    const events: SimulationEvent[] = [
      { type: 'travel', agentId: 'cdp-1', role: 'cdp', distanceMm: 1200 },
      { type: 'state-time', role: 'cdp', state: 'walking', durationSeconds: 1 },
      { type: 'queue', stationId: 'tandoor', durationSeconds: 15 },
      { type: 'order-completed', orderId: 'order-1', durationSeconds: 420 },
      { type: 'traffic', xMm: 100, yMm: 200, visits: 3 },
    ]
    const metrics = aggregateMetrics(events)
    expect(metrics.totalTravelMm).toBe(1200)
    expect(metrics.queueSeconds.tandoor).toBe(15)
    expect(metrics.completedOrders).toBe(1)
    expect(metrics.trafficCells).toEqual([{ xMm: 100, yMm: 200, visits: 3 }])
  })
})
