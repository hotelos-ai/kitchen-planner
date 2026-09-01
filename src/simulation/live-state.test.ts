import { describe, expect, it } from 'vitest'
import type { SimulationResult } from './types'
import { deriveLiveServiceState } from './live-state'

const result = {
  durationSeconds: 1200,
  orders: [
    { id: 'order-1', arrivedAtSeconds: 0, completedAtSeconds: 600, stages: [
      { taskId: 'a', stationId: 'prep', capability: 'food-prep', agentId: 'cdp-1', eligibleAtSeconds: 0, travelStartSeconds: 0, arrivedAtSeconds: 10, workStartSeconds: 20, workEndSeconds: 100, queueSeconds: 10 },
      { taskId: 'b', stationId: 'range', capability: 'range-cook', agentId: 'cdp-1', eligibleAtSeconds: 100, travelStartSeconds: 100, arrivedAtSeconds: 110, workStartSeconds: 130, workEndSeconds: 600, queueSeconds: 20 },
    ] },
    { id: 'order-2', arrivedAtSeconds: 60, stages: [
      { taskId: 'c', stationId: 'prep', capability: 'food-prep', agentId: 'cdp-2', eligibleAtSeconds: 60, travelStartSeconds: 80, arrivedAtSeconds: 90, workStartSeconds: 200, workEndSeconds: 300, queueSeconds: 110 },
    ] },
  ],
  taskTimeline: [],
  frames: [], events: [], warnings: [], seed: 1, metrics: {} as SimulationResult['metrics'],
} satisfies SimulationResult

describe('live service state', () => {
  it('shows arrived, active, queued, completed, and station backlog at a point in time', () => {
    const state = deriveLiveServiceState(result, 250)
    expect(state.arrivedOrders).toBe(2)
    expect(state.completedOrders).toBe(0)
    expect(state.backlog).toBe(2)
    expect(state.orders.find((order) => order.id === 'order-1')?.status).toBe('working')
    expect(state.orders.find((order) => order.id === 'order-2')?.status).toBe('working')
    expect(state.stationQueues.find((station) => station.stationId === 'range')).toMatchObject({ active: 1, waiting: 0 })
  })

  it('calculates live waits from completed orders and current age for open tickets', () => {
    const state = deriveLiveServiceState(result, 700)
    expect(state.completedOrders).toBe(1)
    expect(state.backlog).toBe(1)
    expect(state.averageCompletedWaitSeconds).toBe(600)
    expect(state.oldestOpenWaitSeconds).toBe(640)
  })

  it('keeps completed tickets visible long enough to read at high playback speeds', () => {
    expect(deriveLiveServiceState(result, 644).recentlyCompleted.map((order) => order.id)).toContain('order-1')
    expect(deriveLiveServiceState(result, 646).recentlyCompleted.map((order) => order.id)).not.toContain('order-1')
  })
})
