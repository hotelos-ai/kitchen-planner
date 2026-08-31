import type { EquipmentItem, PointMm, StaffRole } from '../domain/project'
import { buildNavGrid, findRoute, routeDistanceMm } from './nav-grid'
import { aggregateMetrics } from './metrics'
import { createRng } from './rng'
import { generateServiceTasks } from './tasks'
import type { AgentFrame, SimTask, SimulationEvent, SimulationInput, SimulationResult } from './types'

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

const eligibleAgent = (task: SimTask, agents: Agent[]) => {
  const preferred = agents.filter((agent) => task.preferredRoles.includes(agent.role))
  return (preferred.length ? preferred : agents).reduce((best, agent) => agent.availableAt < best.availableAt || (agent.availableAt === best.availableAt && agent.id < best.id) ? agent : best)
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
  const tasks = generateServiceTasks(input.scenario, equipment, rng)
  const agents = makeAgents(input)
  if (!agents.length) throw new Error('Add at least one staff member before running the simulation')
  const events: SimulationEvent[] = []
  const warnings: string[] = []
  const taskFinished = new Map<string, number>()
  const taskStarted = new Map<string, number>()
  const stationAvailable = new Map<string, number[]>()
  const stationById = new Map(equipment.map((item) => [item.id, item]))
  const traffic = new Map<string, { xMm: number; yMm: number; visits: number }>()

  tasks.forEach((task) => {
    const station = stationById.get(task.stationId)
    if (!station) { events.push({ type: 'unreachable', taskId: task.id }); warnings.push(`Missing station for ${task.capability}`); return }
    const agent = eligibleAgent(task, agents)
    const predecessorFinished = task.predecessorId ? taskFinished.get(task.predecessorId) ?? task.readyAtSeconds : task.readyAtSeconds
    const departure = Math.max(agent.availableAt, predecessorFinished, task.readyAtSeconds)
    let route: PointMm[]
    try { route = findRoute(grid, agent.point, stationGoal(station)) }
    catch { events.push({ type: 'unreachable', taskId: task.id }); warnings.push(`${station.label} is unreachable from the current circulation grid.`); return }
    const distance = routeDistanceMm(route)
    const travelSeconds = distance / WALK_SPEED_MM_S
    const arrival = departure + travelSeconds
    const capacity = Math.max(1, input.scenario.stationCapacities?.[station.id] ?? 1)
    const slots = stationAvailable.get(station.id) ?? Array.from({ length: capacity }, () => 0)
    const slotIndex = slots.reduce((best, value, index) => value < slots[best] ? index : best, 0)
    const workStart = Math.max(arrival, slots[slotIndex])
    const queueSeconds = workStart - arrival
    const workEnd = workStart + task.durationSeconds
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
      const previous = tasks.find((candidate) => candidate.id === task.predecessorId)
      if (previous?.capability === 'finish-plate' && task.capability === 'clean-window') events.push({ type: 'path-metric', kind: 'finish-to-pass', distanceMm: Math.round(distance) })
      if (previous?.capability === 'dirty-landing' && task.capability === 'dish-pre-rinse') events.push({ type: 'path-metric', kind: 'dirty-to-wash', distanceMm: Math.round(distance) })
    }
    agent.availableAt = workEnd
    agent.point = route.at(-1)!
    slots[slotIndex] = workEnd
    stationAvailable.set(station.id, slots)
    taskStarted.set(task.id, workStart)
    taskFinished.set(task.id, workEnd)
    const next = tasks.find((candidate) => candidate.predecessorId === task.id)
    if (task.orderId && !next) events.push({ type: 'order-completed', orderId: task.orderId, durationSeconds: Math.round(workEnd - task.readyAtSeconds) })
  })

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
  const metrics = aggregateMetrics(events)
  Object.keys(metrics.stationUtilization).forEach((stationId) => { metrics.stationUtilization[stationId] = Math.min(1, metrics.stationUtilization[stationId] / durationSeconds / Math.max(1, input.scenario.stationCapacities?.[stationId] ?? 1)) })
  return { seed: input.scenario.seed, durationSeconds, frames, events, metrics, warnings: [...new Set(warnings)] }
}
