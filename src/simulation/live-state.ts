import type { StationCapability } from '../domain/project'
import type { OrderTimeline, SimulationResult } from './types'

export const RECENT_COMPLETION_WINDOW_SECONDS = 45

export type LiveOrderStatus = 'queued' | 'walking' | 'working' | 'served'

export interface LiveOrder {
  id: string
  status: LiveOrderStatus
  arrivedAtSeconds: number
  waitSeconds: number
  progress: number
  currentStationId?: string
  currentCapability?: StationCapability
  completedAtSeconds?: number
}

export interface LiveStationQueue {
  stationId: string
  active: number
  waiting: number
  completed: number
}

const liveOrder = (order: OrderTimeline, elapsedSeconds: number): LiveOrder => {
  const completed = order.completedAtSeconds !== undefined && order.completedAtSeconds <= elapsedSeconds
  const activeIndex = completed ? order.stages.length : Math.max(0, order.stages.findIndex((stage) => stage.workEndSeconds > elapsedSeconds))
  const stage = order.stages[Math.min(activeIndex, Math.max(0, order.stages.length - 1))]
  const status: LiveOrderStatus = completed ? 'served'
    : stage && elapsedSeconds >= stage.workStartSeconds ? 'working'
      : stage && elapsedSeconds >= stage.travelStartSeconds ? 'walking' : 'queued'
  return {
    id: order.id,
    status,
    arrivedAtSeconds: order.arrivedAtSeconds,
    waitSeconds: Math.max(0, (completed ? order.completedAtSeconds! : elapsedSeconds) - order.arrivedAtSeconds),
    progress: order.stages.length ? Math.min(1, activeIndex / order.stages.length) : 0,
    currentStationId: completed ? undefined : stage?.stationId,
    currentCapability: completed ? undefined : stage?.capability,
    completedAtSeconds: order.completedAtSeconds,
  }
}

export function deriveLiveServiceState(result: SimulationResult, elapsedSeconds: number) {
  const elapsed = Math.max(0, Math.min(result.durationSeconds, elapsedSeconds))
  const arrived = result.orders.filter((order) => order.arrivedAtSeconds <= elapsed)
  const orders = arrived.map((order) => liveOrder(order, elapsed))
  const completed = orders.filter((order) => order.status === 'served')
  const open = orders.filter((order) => order.status !== 'served')
  const timeline = result.taskTimeline.length ? result.taskTimeline : result.orders.flatMap((order) => order.stages)
  const stationIds = [...new Set(timeline.map((task) => task.stationId))]
  const stationQueues: LiveStationQueue[] = stationIds.map((stationId) => {
    const tasks = timeline.filter((task) => task.stationId === stationId)
    return {
      stationId,
      active: tasks.filter((task) => elapsed >= task.workStartSeconds && elapsed < task.workEndSeconds).length,
      waiting: tasks.filter((task) => elapsed >= task.eligibleAtSeconds && elapsed < task.workStartSeconds).length,
      completed: tasks.filter((task) => elapsed >= task.workEndSeconds).length,
    }
  }).sort((left, right) => right.waiting - left.waiting || right.active - left.active || left.stationId.localeCompare(right.stationId))
  const completedWaits = completed.map((order) => order.waitSeconds)
  return {
    elapsedSeconds: elapsed,
    arrivedOrders: arrived.length,
    completedOrders: completed.length,
    backlog: open.length,
    oldestOpenWaitSeconds: open.length ? Math.max(...open.map((order) => order.waitSeconds)) : 0,
    averageCompletedWaitSeconds: completedWaits.length ? completedWaits.reduce((sum, value) => sum + value, 0) / completedWaits.length : 0,
    completedWaits,
    orders,
    stationQueues,
    recentlyCompleted: completed.filter((order) => elapsed - (order.completedAtSeconds ?? 0) <= RECENT_COMPLETION_WINDOW_SECONDS),
    upcomingOrders: result.orders.filter((order) => order.arrivedAtSeconds > elapsed).slice(0, 3),
  }
}
