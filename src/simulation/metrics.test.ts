import { describe, expect, it } from 'vitest'
import { aggregateMetrics } from './metrics'
import type { SimulationEvent } from './types'

describe('simulation metrics', () => {
  it('aggregates travel, queueing, throughput, and traffic cells', () => {
    const events: SimulationEvent[] = [
      { type: 'travel', agentId: 'cdp-1', role: 'cdp', distanceMm: 1200 },
      { type: 'state-time', role: 'cdp', state: 'walking', durationSeconds: 1 },
      { type: 'queue', stationId: 'tandoor', durationSeconds: 15 },
      { type: 'order-arrived', orderId: 'order-1', atSeconds: 0 },
      { type: 'order-arrived', orderId: 'order-2', atSeconds: 60 },
      { type: 'order-completed', orderId: 'order-1', arrivedAtSeconds: 0, completedAtSeconds: 420, durationSeconds: 420 },
      { type: 'traffic', xMm: 100, yMm: 200, visits: 3 },
    ]
    const metrics = aggregateMetrics(events)
    expect(metrics.totalTravelMm).toBe(1200)
    expect(metrics.queueSeconds.tandoor).toBe(15)
    expect(metrics.completedOrders).toBe(1)
    expect(metrics.totalOrders).toBe(2)
    expect(metrics.unfinishedOrders).toBe(1)
    expect(metrics.averageOrderWaitSeconds).toBe(420)
    expect(metrics.peakOrderBacklog).toBe(2)
    expect(metrics.ordersWithin15MinutesPct).toBe(100)
    expect(metrics.orderWaitSamplesSeconds).toEqual([420])
    expect(metrics.trafficCells).toEqual([{ xMm: 100, yMm: 200, visits: 3 }])
  })
})
