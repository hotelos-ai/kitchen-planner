import type { StaffRole } from '../domain/project'
import type { SimulationEvent, SimulationMetrics } from './types'

const ROLES: StaffRole[] = ['head-chef', 'sous-chef', 'cdp', 'busser-washer']
const percentile = (values: number[], fraction: number) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] : 0

export function emptyMetrics(): SimulationMetrics {
  return {
    totalTravelMm: 0,
    travelByRoleMm: Object.fromEntries(ROLES.map((role) => [role, 0])) as Record<StaffRole, number>,
    timeByRoleSeconds: Object.fromEntries(ROLES.map((role) => [role, { walking: 0, working: 0, waiting: 0 }])) as SimulationMetrics['timeByRoleSeconds'],
    stationUtilization: {}, queueSeconds: {}, congestionEvents: 0, hotLineCongestionEvents: 0,
    opposingFlowEvents: 0, doorConflictEvents: 0, dirtyCleanCrossings: 0, unreachableTasks: 0,
    finishToPassTravelMm: 0, dirtyToWashTravelMm: 0, completedOrders: 0,
    totalOrders: 0, unfinishedOrders: 0, averageOrderWaitSeconds: 0,
    orderCompletionP50Seconds: 0, orderCompletionP90Seconds: 0,
    ordersWithin15MinutesPct: 0, ordersWithin20MinutesPct: 0, peakOrderBacklog: 0,
    throughputPerHour: 0, orderWaitSamplesSeconds: [], trafficCells: [],
  }
}

export function aggregateMetrics(events: readonly SimulationEvent[]): SimulationMetrics {
  const metrics = emptyMetrics()
  const completions: number[] = []
  const backlogEvents: { at: number; delta: number }[] = []
  const traffic = new Map<string, { xMm: number; yMm: number; visits: number }>()
  events.forEach((event) => {
    if (event.type === 'travel') { metrics.totalTravelMm += event.distanceMm; metrics.travelByRoleMm[event.role] += event.distanceMm }
    else if (event.type === 'state-time') metrics.timeByRoleSeconds[event.role][event.state] += event.durationSeconds
    else if (event.type === 'station-work') metrics.stationUtilization[event.stationId] = (metrics.stationUtilization[event.stationId] ?? 0) + event.durationSeconds
    else if (event.type === 'queue') metrics.queueSeconds[event.stationId] = (metrics.queueSeconds[event.stationId] ?? 0) + event.durationSeconds
    else if (event.type === 'congestion') { metrics.congestionEvents += 1; if (event.hotLine) metrics.hotLineCongestionEvents += 1 }
    else if (event.type === 'opposing-flow') metrics.opposingFlowEvents += 1
    else if (event.type === 'door-conflict') metrics.doorConflictEvents += 1
    else if (event.type === 'dirty-clean-crossing') metrics.dirtyCleanCrossings += 1
    else if (event.type === 'unreachable') metrics.unreachableTasks += 1
    else if (event.type === 'path-metric') metrics[event.kind === 'finish-to-pass' ? 'finishToPassTravelMm' : 'dirtyToWashTravelMm'] += event.distanceMm
    else if (event.type === 'order-arrived') { metrics.totalOrders += 1; backlogEvents.push({ at: event.atSeconds, delta: 1 }) }
    else if (event.type === 'order-completed') { metrics.completedOrders += 1; completions.push(event.durationSeconds); backlogEvents.push({ at: event.completedAtSeconds, delta: -1 }) }
    else if (event.type === 'traffic') {
      const key = `${event.xMm},${event.yMm}`
      const cell = traffic.get(key) ?? { xMm: event.xMm, yMm: event.yMm, visits: 0 }
      cell.visits += event.visits
      traffic.set(key, cell)
    }
  })
  metrics.orderCompletionP50Seconds = percentile(completions, .5)
  metrics.orderCompletionP90Seconds = percentile(completions, .9)
  metrics.averageOrderWaitSeconds = completions.length ? completions.reduce((sum, value) => sum + value, 0) / completions.length : 0
  metrics.unfinishedOrders = Math.max(0, metrics.totalOrders - metrics.completedOrders)
  metrics.ordersWithin15MinutesPct = completions.length ? completions.filter((value) => value <= 15 * 60).length / completions.length * 100 : 0
  metrics.ordersWithin20MinutesPct = completions.length ? completions.filter((value) => value <= 20 * 60).length / completions.length * 100 : 0
  metrics.orderWaitSamplesSeconds = [...completions].sort((a, b) => a - b)
  let backlog = 0
  backlogEvents.sort((left, right) => left.at - right.at || right.delta - left.delta).forEach((event) => { backlog += event.delta; metrics.peakOrderBacklog = Math.max(metrics.peakOrderBacklog, backlog) })
  metrics.trafficCells = [...traffic.values()].sort((left, right) => right.visits - left.visits || left.yMm - right.yMm || left.xMm - right.xMm)
  return metrics
}

/**
 * Orders layouts by service viability before considering deceptively good waits
 * from the small subset of orders that happened to finish.
 */
export function compareSimulationMetrics(left: SimulationMetrics, right: SimulationMetrics): number {
  const leftRank = [
    left.unfinishedOrders,
    left.peakOrderBacklog,
    left.orderCompletionP90Seconds,
    left.averageOrderWaitSeconds,
    left.totalTravelMm,
    left.congestionEvents,
  ]
  const rightRank = [
    right.unfinishedOrders,
    right.peakOrderBacklog,
    right.orderCompletionP90Seconds,
    right.averageOrderWaitSeconds,
    right.totalTravelMm,
    right.congestionEvents,
  ]
  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] !== rightRank[index]) return leftRank[index] - rightRank[index]
  }
  return 0
}
