import type { EquipmentItem, PointMm, StaffRole } from '../domain/project'
import { buildNavGrid, findRoute, routeDistanceMm } from './nav-grid'
import { aggregateMetrics } from './metrics'
import { createRng } from './rng'
import { generateServiceTasks } from './tasks'
import type { AgentFrame, OrderTimeline, SimTask, SimulationEvent, SimulationInput, SimulationResult, TaskTimelineEntry } from './types'

const WALK_SPEED_MM_S = 1200
const MAX_DRAIN_SECONDS = 600

type Agent = { id: string; role: StaffRole; availableAt: number; point: PointMm; intervals: Interval[] }
type Interval = { start: number; end: number; state: AgentFrame['state']; taskId?: string; from: PointMm; to: PointMm; route?: PointMm[] }

const stationGoal = (item: EquipmentItem): PointMm => {
  const radians = item.rotationDeg * Math.PI / 180
  const local = { x: item.widthMm / 2, y: item.depthMm + 150 }
  return {
    x: item.xMm + local.x * Math.cos(radians) - local.y * Math.sin(radians),
    y: item.yMm + local.x * Math.sin(radians) + local.y * Math.cos(radians),
  }
}

const serviceWindowGoal = (input: SimulationInput, openingId: string): PointMm => {
  const opening = input.architecture.openings.find((candidate) => candidate.id === openingId)!
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.wall === 'top') return { x: middle, y: 150 }
  if (opening.wall === 'bottom') return { x: middle, y: input.architecture.depthMm - 150 }
  if (opening.wall === 'left') return { x: 150, y: middle }
  return { x: input.architecture.widthMm - 150, y: middle }
}

const serviceWindowStations = (input: SimulationInput): EquipmentItem[] => input.architecture.openings.flatMap((opening) => {
  const capability = opening.flow === 'clean-out' ? 'clean-window' : opening.flow === 'dirty-in' ? 'dirty-window' : undefined
  if (!capability) return []
  const goal = serviceWindowGoal(input, opening.id)
  return [{ id: opening.id, label: opening.label, category: 'custom', widthMm: 100, depthMm: 100, heightMm: opening.sillHeightMm ?? 900, xMm: goal.x - 50, yMm: goal.y - 50, rotationDeg: 0, dimensionsLocked: true, movable: false, removable: false, capabilities: [capability] }]
})

const pointAlong = (route: readonly PointMm[], fraction: number) => {
  if (route.length < 2) return route[0] ?? { x: 0, y: 0 }
  const total = routeDistanceMm(route)
  let remaining = Math.max(0, Math.min(1, fraction)) * total
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1]
    const end = route[index]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (remaining <= length) return { x: start.x + (end.x - start.x) * (remaining / length), y: start.y + (end.y - start.y) * (remaining / length) }
    remaining -= length
  }
  return route.at(-1)!
}

const makeAgents = (input: SimulationInput): Agent[] => {
  const door = input.architecture.openings.find((opening) => opening.flow === 'entry')
  const entry = { x: 150, y: door ? door.offsetMm + door.widthMm / 2 : input.architecture.depthMm - 300 }
  const agents: Agent[] = []
  input.scenario.staff.forEach(({ role, count }) => {
    for (let index = 0; index < count; index += 1) agents.push({ id: `${role}-${index + 1}`, role, availableAt: 0, point: entry, intervals: [] })
  })
  return agents
}

function frameFor(agent: Agent, elapsedSeconds: number): AgentFrame {
  const interval = agent.intervals.find((value) => elapsedSeconds >= value.start && elapsedSeconds < value.end)
  if (!interval) {
    const previous = [...agent.intervals].reverse().find((value) => value.end <= elapsedSeconds)
    return { agentId: agent.id, role: agent.role, xMm: previous?.to.x ?? agent.point.x, yMm: previous?.to.y ?? agent.point.y, state: 'waiting' }
  }
  const point = interval.state === 'walking' && interval.route
    ? pointAlong(interval.route, (elapsedSeconds - interval.start) / Math.max(.001, interval.end - interval.start))
    : interval.to
  return { agentId: agent.id, role: agent.role, xMm: Math.round(point.x), yMm: Math.round(point.y), state: interval.state, taskId: interval.taskId }
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const equipment = input.equipment.map((item) => structuredClone(item))
  const grid = buildNavGrid({ architecture: input.architecture, equipment }, 100)
  const rng = createRng(input.scenario.seed)
  const windowStations = serviceWindowStations(input)
  const stations = [...equipment, ...windowStations]
  const tasks = generateServiceTasks(input.scenario, stations, rng)
  const agents = makeAgents(input)
  if (!agents.length) throw new Error('Add at least one staff member before running the simulation')
  const events: SimulationEvent[] = []
  const taskTimeline: TaskTimelineEntry[] = []
  const warnings: string[] = []
  const taskFinished = new Map<string, number>()
  const stationAvailable = new Map<string, number[]>()
  const stationById = new Map(stations.map((item) => [item.id, item]))
  const stationGoals = new Map(stations.map((item) => [item.id, stationGoal(item)]))
  windowStations.forEach((station) => stationGoals.set(station.id, serviceWindowGoal(input, station.id)))
  const routeCache = new Map<string, PointMm[] | null>()
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const hasSuccessor = new Set(tasks.flatMap((task) => task.predecessorId ? [task.predecessorId] : []))
  const traffic = new Map<string, { xMm: number; yMm: number; visits: number }>()
  const orderArrivals = new Map<string, number>()
  tasks.forEach((task) => {
    if (!task.orderId) return
    orderArrivals.set(task.orderId, Math.min(orderArrivals.get(task.orderId) ?? Infinity, task.readyAtSeconds))
  })
  orderArrivals.forEach((atSeconds, orderId) => events.push({ type: 'order-arrived', orderId, atSeconds }))

  type Candidate = {
    task: SimTask; station: EquipmentItem; agent: Agent; eligibleAtSeconds: number; departure: number
    route: PointMm[]; distance: number; travelSeconds: number; arrival: number
    slots: number[]; slotIndex: number; workStart: number; queueSeconds: number; workEnd: number
  }
  const remaining = new Map(tasks.map((task) => [task.id, task]))
  const resolved = new Set<string>()

  while (remaining.size) {
    const ready = [...remaining.values()].filter((task) => !task.predecessorId || resolved.has(task.predecessorId))
    let best: Candidate | undefined
    for (const task of ready) {
      const station = stationById.get(task.stationId)
      if (!station) continue
      const predecessorFinished = task.predecessorId ? taskFinished.get(task.predecessorId) ?? task.readyAtSeconds : task.readyAtSeconds
      const eligibleAtSeconds = Math.max(predecessorFinished, task.readyAtSeconds)
      const preferred = agents.filter((agent) => task.preferredRoles.includes(agent.role))
      for (const agent of preferred.length ? preferred : agents) {
        const departure = Math.max(agent.availableAt, eligibleAtSeconds)
        const routeKey = `${agent.point.x},${agent.point.y}:${station.id}`
        if (!routeCache.has(routeKey)) {
          try { routeCache.set(routeKey, findRoute(grid, agent.point, stationGoals.get(station.id)!)) }
          catch { routeCache.set(routeKey, null) }
        }
        const route = routeCache.get(routeKey)
        if (!route) continue
        const distance = routeDistanceMm(route)
        const travelSeconds = distance / WALK_SPEED_MM_S
        const arrival = departure + travelSeconds
        const capacity = Math.max(1, input.scenario.stationCapacities?.[station.id] ?? 1)
        const slots = stationAvailable.get(station.id) ?? Array.from({ length: capacity }, () => 0)
        const slotIndex = slots.reduce((earliest, value, index) => value < slots[earliest] ? index : earliest, 0)
        const workStart = Math.max(arrival, slots[slotIndex])
        const candidate: Candidate = { task, station, agent, eligibleAtSeconds, departure, route, distance, travelSeconds, arrival, slots, slotIndex, workStart, queueSeconds: workStart - arrival, workEnd: workStart + task.durationSeconds }
        if (!best || candidate.workStart < best.workStart || (candidate.workStart === best.workStart && (candidate.eligibleAtSeconds < best.eligibleAtSeconds || (candidate.eligibleAtSeconds === best.eligibleAtSeconds && `${candidate.task.id}:${candidate.agent.id}` < `${best.task.id}:${best.agent.id}`)))) best = candidate
      }
    }

    if (!best) {
      const task = ready[0] ?? remaining.values().next().value as SimTask
      const station = stationById.get(task.stationId)
      events.push({ type: 'unreachable', taskId: task.id })
      warnings.push(station ? `${station.label} is unreachable from the current circulation grid.` : `Missing station for ${task.capability}`)
      remaining.delete(task.id); resolved.add(task.id); taskFinished.set(task.id, task.readyAtSeconds)
      continue
    }

    const { task, station, agent, eligibleAtSeconds, departure, route, distance, travelSeconds, arrival, slots, slotIndex, workStart, queueSeconds, workEnd } = best
    if (travelSeconds > 0) agent.intervals.push({ start: departure, end: arrival, state: 'walking', taskId: task.id, from: agent.point, to: route.at(-1)!, route })
    if (queueSeconds > 0) agent.intervals.push({ start: arrival, end: workStart, state: 'waiting', taskId: task.id, from: route.at(-1)!, to: route.at(-1)! })
    agent.intervals.push({ start: workStart, end: workEnd, state: 'working', taskId: task.id, from: route.at(-1)!, to: route.at(-1)! })
    events.push({ type: 'travel', agentId: agent.id, role: agent.role, distanceMm: Math.round(distance) })
    events.push({ type: 'state-time', role: agent.role, state: 'walking', durationSeconds: travelSeconds })
    events.push({ type: 'state-time', role: agent.role, state: 'working', durationSeconds: task.durationSeconds })
    if (queueSeconds > 0) { events.push({ type: 'queue', stationId: station.id, durationSeconds: queueSeconds }); events.push({ type: 'state-time', role: agent.role, state: 'waiting', durationSeconds: queueSeconds }) }
    events.push({ type: 'station-work', stationId: station.id, durationSeconds: task.durationSeconds })
    route.forEach((point) => {
      const key = `${point.x},${point.y}`
      const cell = traffic.get(key) ?? { xMm: point.x, yMm: point.y, visits: 0 }
      cell.visits += 1; traffic.set(key, cell)
    })
    if (task.predecessorId) {
      const previous = taskById.get(task.predecessorId)
      if (previous?.capability === 'finish-plate' && task.capability === 'clean-window') events.push({ type: 'path-metric', kind: 'finish-to-pass', distanceMm: Math.round(distance) })
      if (previous?.capability === 'dirty-landing' && task.capability === 'dish-pre-rinse') events.push({ type: 'path-metric', kind: 'dirty-to-wash', distanceMm: Math.round(distance) })
    }
    agent.availableAt = workEnd
    agent.point = route.at(-1)!
    slots[slotIndex] = workEnd
    stationAvailable.set(station.id, slots)
    taskFinished.set(task.id, workEnd)
    taskTimeline.push({ taskId: task.id, orderId: task.orderId, dishBatchId: task.dishBatchId, stationId: station.id, capability: task.capability, agentId: agent.id, eligibleAtSeconds, travelStartSeconds: departure, arrivedAtSeconds: arrival, workStartSeconds: workStart, workEndSeconds: workEnd, queueSeconds })
    if (task.orderId && !hasSuccessor.has(task.id)) {
      const arrivedAtSeconds = orderArrivals.get(task.orderId) ?? task.readyAtSeconds
      events.push({ type: 'order-completed', orderId: task.orderId, arrivedAtSeconds, completedAtSeconds: workEnd, durationSeconds: Math.round(workEnd - arrivedAtSeconds) })
    }
    remaining.delete(task.id)
    resolved.add(task.id)
  }

  traffic.forEach((cell) => events.push({ type: 'traffic', ...cell }))
  const scheduledEnd = Math.max(0, ...agents.map((agent) => agent.availableAt))
  const baseDuration = input.scenario.durationMinutes * 60
  const durationSeconds = Math.ceil(Math.max(baseDuration, Math.min(scheduledEnd, baseDuration + MAX_DRAIN_SECONDS)))
  const frames = Array.from({ length: durationSeconds + 1 }, (_, elapsedSeconds) => ({ elapsedSeconds, agents: agents.map((agent) => frameFor(agent, elapsedSeconds)) }))
  if (input.scenario.checks.collisions) frames.forEach((frame) => {
    for (let left = 0; left < frame.agents.length; left += 1) for (let right = left + 1; right < frame.agents.length; right += 1) {
      const a = frame.agents[left]; const b = frame.agents[right]
      if (a.state === 'waiting' && b.state === 'waiting') continue
      const distance = Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm)
      if (distance < 550) {
        const hotLine = (a.yMm < 2100 || b.yMm < 2100)
        events.push({ type: 'congestion', hotLine })
        if (a.state === 'walking' && b.state === 'walking') events.push({ type: 'opposing-flow' })
        if ((a.role === 'busser-washer') !== (b.role === 'busser-washer')) events.push({ type: 'dirty-clean-crossing' })
      }
      const entry = input.architecture.openings.find((opening) => opening.flow === 'entry')
      if (input.scenario.checks.doorSwings && entry && a.xMm < 950 && b.xMm < 950 && Math.abs(a.yMm - (entry.offsetMm + entry.widthMm / 2)) < 900 && Math.abs(b.yMm - (entry.offsetMm + entry.widthMm / 2)) < 900) events.push({ type: 'door-conflict' })
    }
  })
  const visibleEvents = events.filter((event) => event.type !== 'order-completed' || event.completedAtSeconds <= durationSeconds)
  const metrics = aggregateMetrics(visibleEvents)
  metrics.throughputPerHour = durationSeconds ? metrics.completedOrders / durationSeconds * 3600 : 0
  Object.keys(metrics.stationUtilization).forEach((stationId) => { metrics.stationUtilization[stationId] = Math.min(1, metrics.stationUtilization[stationId] / durationSeconds / Math.max(1, input.scenario.stationCapacities?.[stationId] ?? 1)) })
  const completedByOrder = new Map(visibleEvents.filter((event): event is Extract<SimulationEvent, { type: 'order-completed' }> => event.type === 'order-completed').map((event) => [event.orderId, event.completedAtSeconds]))
  const orders: OrderTimeline[] = [...orderArrivals.entries()].map(([id, arrivedAtSeconds]) => ({
    id,
    arrivedAtSeconds,
    completedAtSeconds: completedByOrder.get(id),
    stages: taskTimeline.filter((task) => task.orderId === id),
  })).sort((left, right) => left.arrivedAtSeconds - right.arrivedAtSeconds || left.id.localeCompare(right.id))
  return { seed: input.scenario.seed, durationSeconds, frames, events: visibleEvents, taskTimeline, orders, metrics, warnings: [...new Set(warnings)] }
}
