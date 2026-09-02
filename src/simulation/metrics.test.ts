import { describe, expect, it } from 'vitest'
import { aggregateMetrics, compareSimulationMetrics, emptyMetrics } from './metrics'
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

  it('ranks unfinished work and backlog before deceptively low served-order waits', () => {
    const mostlyUnfinished = {
      ...emptyMetrics(),
      totalOrders: 50,
      completedOrders: 1,
      unfinishedOrders: 49,
      peakOrderBacklog: 49,
      orderCompletionP90Seconds: 10,
      averageOrderWaitSeconds: 10,
    }
    const viable = {
      ...emptyMetrics(),
      totalOrders: 50,
      completedOrders: 50,
      unfinishedOrders: 0,
      peakOrderBacklog: 12,
      orderCompletionP90Seconds: 900,
      averageOrderWaitSeconds: 700,
    }
    const lowerBacklog = { ...viable, peakOrderBacklog: 8, averageOrderWaitSeconds: 800 }

    expect(compareSimulationMetrics(viable, mostlyUnfinished)).toBeLessThan(0)
    expect(compareSimulationMetrics(lowerBacklog, viable)).toBeLessThan(0)
    expect(compareSimulationMetrics(viable, { ...viable, averageOrderWaitSeconds: 800 })).toBeLessThan(0)
  })
})
