import type { EquipmentItem, PointMm, StaffRole } from '../domain/project'
import { pointInPolygon, rotatedFootprint } from '../domain/geometry'
import { doorSwingEnvelopes, UNKNOWN_PROFESSIONAL_CONSTRAINTS } from '../domain/layout-diagnostics'
import { buildNavGrid, findRoute, findRouteToClosestReachablePoint, navigationApproachOffsetMm, resolveNominalGoal, routeDistanceMm, stationApproachPoints } from './nav-grid'
import { aggregateMetrics } from './metrics'
import { createRng } from './rng'
import { generateServiceTasks } from './tasks'
import { validateSimulationInput } from './validation'
import type { AgentFrame, MetricsOnlySimulationResult, OrderTimeline, SimTask, SimulationEvent, SimulationFrame, SimulationInput, SimulationResult, SimulationRunResult, TaskTimelineEntry } from './types'

const WALK_SPEED_MM_S = 1200
const MAX_DRAIN_SECONDS = 600

type Agent = { id: string; role: StaffRole; availableAt: number; point: PointMm; spawnPoint: PointMm; intervals: Interval[] }
type Interval = { start: number; end: number; state: AgentFrame['state']; taskId?: string; from: PointMm; to: PointMm; route?: PointMm[] }

export const openingInteriorPoint = (input: Pick<SimulationInput, 'architecture'>, openingId: string, insetMm = 150): PointMm => {
  const opening = input.architecture.openings.find((candidate) => candidate.id === openingId)!
  if (opening.segmentIndex !== undefined) {
    const start = input.architecture.roomPolygon[opening.segmentIndex]
    const end = input.architecture.roomPolygon[(opening.segmentIndex + 1) % input.architecture.roomPolygon.length]
    if (start && end) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
      const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
      const edge = { x: start.x + unit.x * (opening.offsetMm + opening.widthMm / 2), y: start.y + unit.y * (opening.offsetMm + opening.widthMm / 2) }
      const normals = [{ x: -unit.y, y: unit.x }, { x: unit.y, y: -unit.x }]
      const candidate = normals.map((normal) => ({ x: edge.x + normal.x * insetMm, y: edge.y + normal.y * insetMm }))
        .find((point) => pointInPolygon(point, input.architecture.roomPolygon))
      if (candidate) return candidate
    }
  }
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.wall === 'top') return { x: middle, y: insetMm }
  if (opening.wall === 'bottom') return { x: middle, y: input.architecture.depthMm - insetMm }
  if (opening.wall === 'left') return { x: insetMm, y: middle }
  return { x: input.architecture.widthMm - insetMm, y: middle }
}

const serviceWindowStations = (input: SimulationInput): EquipmentItem[] => input.architecture.openings.flatMap((opening) => {
  const capability = opening.flow === 'clean-out' ? 'clean-window' : opening.flow === 'dirty-in' ? 'dirty-window' : undefined
  if (!capability) return []
  const goal = openingInteriorPoint(input, opening.id)
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
  const entry = door ? openingInteriorPoint(input, door.id) : {
    x: input.architecture.roomPolygon.reduce((sum, point) => sum + point.x, 0) / Math.max(1, input.architecture.roomPolygon.length),
    y: input.architecture.roomPolygon.reduce((sum, point) => sum + point.y, 0) / Math.max(1, input.architecture.roomPolygon.length),
  }
  const agents: Agent[] = []
  input.scenario.staff.forEach(({ role, count }) => {
    for (let index = 0; index < count; index += 1) agents.push({ id: `${role}-${index + 1}`, role, availableAt: 0, point: entry, spawnPoint: entry, intervals: [] })
  })
  return agents
}

const distanceToSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy || 1
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - start.x - dx * amount, point.y - start.y - dy * amount)
}

const distanceToPolygon = (point: PointMm, polygon: readonly PointMm[]) => pointInPolygon(point, [...polygon]) ? 0 : Math.min(...polygon.map((start, index) =>
  distanceToSegment(point, start, polygon[(index + 1) % polygon.length])))

export function pointInHotLineZone(point: PointMm, equipment: readonly EquipmentItem[], proximityMm = 900): boolean {
  return equipment.filter((item) => item.category === 'cooking').some((item) => distanceToPolygon(point, rotatedFootprint(item)) <= proximityMm)
}

function frameFor(agent: Agent, elapsedSeconds: number): AgentFrame {
  const interval = agent.intervals.find((value) => elapsedSeconds >= value.start && elapsedSeconds < value.end)
  if (!interval) {
    const previous = [...agent.intervals].reverse().find((value) => value.end <= elapsedSeconds)
    return { agentId: agent.id, role: agent.role, xMm: previous?.to.x ?? agent.spawnPoint.x, yMm: previous?.to.y ?? agent.spawnPoint.y, state: 'waiting' }
  }
  const point = interval.state === 'walking' && interval.route
    ? pointAlong(interval.route, (elapsedSeconds - interval.start) / Math.max(.001, interval.end - interval.start))
    : interval.to
  return { agentId: agent.id, role: agent.role, xMm: Math.round(point.x), yMm: Math.round(point.y), state: interval.state, taskId: interval.taskId }
}

export function runSimulation(input: SimulationInput & { outputMode: 'metrics-only' }): MetricsOnlySimulationResult
export function runSimulation(input: SimulationInput): SimulationResult
export function runSimulation(input: SimulationInput): SimulationRunResult {
  const validationErrors = validateSimulationInput(input)
  if (validationErrors.length) throw new Error(`Simulation input is invalid: ${validationErrors.map((validationError) => validationError.code).join(', ')}`)
  const equipment = input.equipment.map((item) => structuredClone(item))
  const navigationClearance = {
    bodyRadiusMm: input.navigationBodyRadiusMm,
    minimumAisleMm: input.layoutConstraints?.minimumAisleMm,
  }
  const grid = buildNavGrid({ architecture: input.architecture, equipment, layoutConstraints: input.layoutConstraints }, 100, navigationClearance)
  const rng = createRng(input.scenario.seed)
  const windowStations = serviceWindowStations(input)
  const stations = [...equipment, ...windowStations]
  const tasks = generateServiceTasks(input.scenario, stations, rng)
  const agents = makeAgents(input)
  if (!agents.length) throw new Error('Add at least one staff member before running the simulation')
  const events: SimulationEvent[] = []
  const taskTimeline: TaskTimelineEntry[] = []
  const warnings: string[] = [
    `Professional ${UNKNOWN_PROFESSIONAL_CONSTRAINTS.map((constraint) => constraint.code).join(', ').replace(/, ([^,]*)$/, ', and $1')} constraints remain unknown pending qualified review.`,
  ]
  const includePresentation = input.outputMode !== 'metrics-only'
  const taskFinished = new Map<string, number>()
  const stationAvailable = new Map<string, number[]>()
  const stationById = new Map(stations.map((item) => [item.id, item]))
  const stationApproachOffsetMm = navigationApproachOffsetMm(navigationClearance, input.layoutConstraints?.minimumAisleMm, 100)
  const stationGoals = new Map(stations.map((item) => [item.id, stationApproachPoints(item, undefined, stationApproachOffsetMm)]))
  windowStations.forEach((station) => {
    const nominal = openingInteriorPoint(input, station.id)
    stationGoals.set(station.id, [resolveNominalGoal(grid, nominal) ?? nominal])
  })
  const routeCache = new Map<string, { route: PointMm[]; usedClosestPoint: boolean } | null>()
  const closestPointWarnings = new Set<string>()
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
    route: PointMm[]; usedClosestPoint: boolean; distance: number; travelSeconds: number; arrival: number
    slots: number[]; slotIndex: number; workStart: number; queueSeconds: number; workEnd: number
  }
  const remaining = new Map(tasks.map((task) => [task.id, task]))
  const resolved = new Set<string>()

  while (remaining.size) {
    const ready = [...remaining.values()].filter((task) => !task.predecessorId || resolved.has(task.predecessorId))
    let best: Candidate | undefined
    for (const task of ready) {
      const predecessorFinished = task.predecessorId ? taskFinished.get(task.predecessorId) ?? task.readyAtSeconds : task.readyAtSeconds
      const eligibleAtSeconds = Math.max(predecessorFinished, task.readyAtSeconds)
      const preferred = agents.filter((agent) => task.preferredRoles.includes(agent.role))
      for (const stationId of task.stationIds) {
        const station = stationById.get(stationId)
        if (!station) continue
        for (const agent of preferred) {
        const departure = Math.max(agent.availableAt, eligibleAtSeconds)
        const routeKey = `${agent.point.x},${agent.point.y}:${station.id}`
        if (!routeCache.has(routeKey)) {
          const goals = stationGoals.get(station.id) ?? []
          const routes = goals.flatMap((goal) => {
            try { return [findRoute(grid, agent.point, goal)] }
            catch { return [] }
          })
          routes.sort((left, right) => routeDistanceMm(left) - routeDistanceMm(right))
          if (routes[0]) routeCache.set(routeKey, { route: routes[0], usedClosestPoint: false })
          else {
            const preferredPoints = goals.length ? goals : [{ x: station.xMm + station.widthMm / 2, y: station.yMm + station.depthMm / 2 }]
            try { routeCache.set(routeKey, { route: findRouteToClosestReachablePoint(grid, agent.point, preferredPoints), usedClosestPoint: true }) }
            catch { routeCache.set(routeKey, null) }
          }
        }
        const routeResult = routeCache.get(routeKey)
        if (!routeResult) continue
        const { route } = routeResult
        const distance = routeDistanceMm(route)
        const travelSeconds = distance / WALK_SPEED_MM_S
        const arrival = departure + travelSeconds
        const capacity = Math.max(1, input.scenario.stationCapacities?.[station.id] ?? 1)
        const slots = stationAvailable.get(station.id) ?? Array.from({ length: capacity }, () => 0)
        const slotIndex = slots.reduce((earliest, value, index) => value < slots[earliest] ? index : earliest, 0)
        const workStart = Math.max(arrival, slots[slotIndex])
        const candidate: Candidate = { task, station, agent, eligibleAtSeconds, departure, route, usedClosestPoint: routeResult.usedClosestPoint, distance, travelSeconds, arrival, slots, slotIndex, workStart, queueSeconds: workStart - arrival, workEnd: workStart + task.durationSeconds }
        if (!best || candidate.workStart < best.workStart || (candidate.workStart === best.workStart && (candidate.eligibleAtSeconds < best.eligibleAtSeconds || (candidate.eligibleAtSeconds === best.eligibleAtSeconds && `${candidate.task.id}:${candidate.agent.id}` < `${best.task.id}:${best.agent.id}`)))) best = candidate
        }
      }
    }

    if (!best) {
      const task = ready[0] ?? remaining.values().next().value as SimTask
      const station = task.stationIds.map((stationId) => stationById.get(stationId)).find(Boolean)
      events.push({ type: 'unreachable', taskId: task.id })
      warnings.push(station ? `${station.label} is unreachable from the current circulation grid.` : `Missing station for ${task.capability}`)
      remaining.delete(task.id); resolved.add(task.id); taskFinished.set(task.id, task.readyAtSeconds)
      continue
    }

    const { task, station, agent, eligibleAtSeconds, departure, route, usedClosestPoint, distance, travelSeconds, arrival, slots, slotIndex, workStart, queueSeconds, workEnd } = best
    if (usedClosestPoint && !closestPointWarnings.has(station.id)) {
      closestPointWarnings.add(station.id)
      warnings.push(`${station.label}: staff use the closest reachable service point because the preferred modeled approach is obstructed.`)
    }
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
    if (includePresentation) taskTimeline.push({ taskId: task.id, orderId: task.orderId, dishBatchId: task.dishBatchId, stationId: station.id, capability: task.capability, agentId: agent.id, eligibleAtSeconds, travelStartSeconds: departure, arrivedAtSeconds: arrival, workStartSeconds: workStart, workEndSeconds: workEnd, queueSeconds })
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
  const frames: SimulationFrame[] = []
  const doorSwings = doorSwingEnvelopes(input.architecture)
  const analyzeSpatialChecks = input.scenario.checks.collisions || input.scenario.checks.doorSwings || input.scenario.checks.dirtyCleanCrossings
  if (includePresentation || analyzeSpatialChecks) for (let elapsedSeconds = 0; elapsedSeconds <= durationSeconds; elapsedSeconds += 1) {
    const frame = { elapsedSeconds, agents: agents.map((agent) => frameFor(agent, elapsedSeconds)) }
    if (includePresentation) frames.push(frame)
    if (analyzeSpatialChecks) for (let left = 0; left < frame.agents.length; left += 1) for (let right = left + 1; right < frame.agents.length; right += 1) {
      const a = frame.agents[left]; const b = frame.agents[right]
      if (a.state === 'waiting' && b.state === 'waiting') continue
      const distance = Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm)
      if (input.scenario.checks.collisions && distance < 550) {
        const hotLine = pointInHotLineZone({ x: a.xMm, y: a.yMm }, equipment) || pointInHotLineZone({ x: b.xMm, y: b.yMm }, equipment)
        events.push({ type: 'congestion', hotLine })
        if (a.state === 'walking' && b.state === 'walking') events.push({ type: 'opposing-flow' })
      }
      if (input.scenario.checks.dirtyCleanCrossings && distance < 550
        && (a.role === 'busser-washer') !== (b.role === 'busser-washer')) events.push({ type: 'dirty-clean-crossing' })
      if (input.scenario.checks.doorSwings && doorSwings.some(({ polygon }) =>
        pointInPolygon({ x: a.xMm, y: a.yMm }, polygon) && pointInPolygon({ x: b.xMm, y: b.yMm }, polygon))) events.push({ type: 'door-conflict' })
    }
  }
  const visibleEvents = events.filter((event) => event.type !== 'order-completed' || event.completedAtSeconds <= durationSeconds)
  const metrics = aggregateMetrics(visibleEvents)
  metrics.throughputPerHour = durationSeconds ? metrics.completedOrders / durationSeconds * 3600 : 0
  Object.keys(metrics.stationUtilization).forEach((stationId) => { metrics.stationUtilization[stationId] = Math.min(1, metrics.stationUtilization[stationId] / durationSeconds / Math.max(1, input.scenario.stationCapacities?.[stationId] ?? 1)) })
  const summary = { seed: input.scenario.seed, durationSeconds, metrics, warnings: [...new Set(warnings)] }
  if (!includePresentation) return summary
  const completedByOrder = new Map(visibleEvents.filter((event): event is Extract<SimulationEvent, { type: 'order-completed' }> => event.type === 'order-completed').map((event) => [event.orderId, event.completedAtSeconds]))
  const orders: OrderTimeline[] = [...orderArrivals.entries()].map(([id, arrivedAtSeconds]) => ({
    id,
    arrivedAtSeconds,
    completedAtSeconds: completedByOrder.get(id),
    stages: taskTimeline.filter((task) => task.orderId === id),
  })).sort((left, right) => left.arrivedAtSeconds - right.arrivedAtSeconds || left.id.localeCompare(right.id))
  return { ...summary, frames, events: visibleEvents, taskTimeline, orders }
}
