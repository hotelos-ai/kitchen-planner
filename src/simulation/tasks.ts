import type { EquipmentItem, SimulationScenario, StaffRole, StationCapability } from '../domain/project'
import type { Rng } from './rng'
import type { SimTask, SimTaskDemand } from './types'

const COOKING: readonly StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook']
const COOK_ROLES: readonly StaffRole[] = ['head-chef', 'sous-chef', 'cdp']
const WASH_ROLES: readonly StaffRole[] = ['busser-washer']

const duration = (scenario: SimulationScenario, capability: StationCapability, rng: Rng, fallbackMin: number, fallbackMax: number) => {
  const configured = scenario.taskDurations?.[capability]
  const min = configured?.minSeconds ?? fallbackMin
  const max = configured?.maxSeconds ?? fallbackMax
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
    throw new Error(`Invalid duration range for ${capability}.`)
  }
  return rng.between(min, max)
}

const arrivalTime = (index: number, count: number, scenario: SimulationScenario, rng: Rng) => {
  const durationSeconds = scenario.durationMinutes * 60
  const progress = (index + rng.next() * .7) / Math.max(1, count)
  if (scenario.arrivalPattern === 'steady') return progress * durationSeconds * .85
  if (scenario.arrivalPattern === 'two-waves') return index < count / 2
    ? progress * durationSeconds * .35
    : durationSeconds * .48 + (progress - .5) * durationSeconds * .55
  return progress < .42
    ? progress * durationSeconds * .42
    : durationSeconds * .32 + (progress - .42) * durationSeconds * .68
}

function addDemandChain(
  target: SimTaskDemand[],
  id: string,
  readyAtSeconds: number,
  flow: 'clean' | 'dirty',
  roles: readonly StaffRole[],
  stages: readonly { stage: string; capability: StationCapability; compatibleCapabilities?: readonly StationCapability[]; duration: number }[],
  orderId?: string,
  dishBatchId?: string,
) {
  let predecessorId: string | undefined
  stages.forEach((stage, index) => {
    const taskId = `${id}-${index}-${stage.stage}`
    target.push({
      id: taskId,
      orderId,
      dishBatchId,
      predecessorId,
      capability: stage.capability,
      compatibleCapabilities: stage.compatibleCapabilities,
      durationSeconds: Math.round(stage.duration),
      readyAtSeconds,
      flow,
      preferredRoles: roles,
    })
    predecessorId = taskId
  })
}

/** Deterministic service demand. It intentionally does not inspect candidate layout inventory. */
export function generateServiceTaskDemand(scenario: SimulationScenario, rng: Rng): SimTaskDemand[] {
  const tasks: SimTaskDemand[] = []
  const orderCount = Math.max(1, Math.ceil(scenario.covers / 2))
  for (let index = 0; index < orderCount; index += 1) {
    const orderId = `order-${index + 1}`
    const cook = COOKING[index % COOKING.length]
    const cookedToOrder = index < Math.round(orderCount * scenario.cookToOrderRatio)
    addDemandChain(tasks, orderId, arrivalTime(index, orderCount, scenario, rng), 'clean', COOK_ROLES, [
      { stage: 'retrieve', capability: 'cold-retrieval', duration: duration(scenario, 'cold-retrieval', rng, 20, 45) },
      { stage: 'prep', capability: 'food-prep', duration: duration(scenario, 'food-prep', rng, 45, 120) },
      { stage: 'cook', capability: cook, compatibleCapabilities: COOKING, duration: cookedToOrder ? duration(scenario, cook, rng, 180, 540) : rng.between(60, 150) },
      { stage: 'finish', capability: 'finish-plate', duration: duration(scenario, 'finish-plate', rng, 25, 60) },
      { stage: 'pass', capability: 'clean-window', duration: duration(scenario, 'clean-window', rng, 5, 15) },
    ], orderId)
  }
  const dishBatchCount = Math.max(1, Math.ceil(scenario.covers / 3))
  for (let index = 0; index < dishBatchCount; index += 1) {
    const id = `dish-${index + 1}`
    addDemandChain(tasks, id, scenario.durationMinutes * 60 * (.38 + .52 * (index / dishBatchCount)), 'dirty', WASH_ROLES, [
      { stage: 'dirty-window', capability: 'dirty-window', duration: duration(scenario, 'dirty-window', rng, 8, 16) },
      { stage: 'dirty-landing', capability: 'dirty-landing', duration: duration(scenario, 'dirty-landing', rng, 8, 20) },
      { stage: 'pre-rinse', capability: 'dish-pre-rinse', duration: duration(scenario, 'dish-pre-rinse', rng, 25, 55) },
      { stage: 'wash', capability: 'dish-wash', duration: duration(scenario, 'dish-wash', rng, 55, 110) },
      { stage: 'clean-landing', capability: 'clean-landing', duration: duration(scenario, 'clean-landing', rng, 12, 30) },
    ], undefined, id)
  }
  return tasks
}

const compatibleStationIds = (task: SimTaskDemand, equipment: readonly EquipmentItem[]) => {
  const accepted = task.compatibleCapabilities ?? [task.capability]
  const direct = equipment.filter((item) => item.capabilities.some((capability) => accepted.includes(capability)))
  const capability = task.capability
  const modeledOpenings = (capability === 'clean-window' || capability === 'dirty-window')
    ? direct.filter((item) => !item.movable && item.category === 'custom')
    : []
  const fallback = capability === 'clean-window'
    ? equipment.filter((item) => item.capabilities.includes('finish-plate'))
    : capability === 'dirty-window'
      ? equipment.filter((item) => item.capabilities.includes('dirty-landing'))
      : []
  return (modeledOpenings.length ? modeledOpenings : direct.length ? direct : fallback).map((item) => item.id).sort()
}

export function bindServiceTaskStations(demand: readonly SimTaskDemand[], equipment: readonly EquipmentItem[]): SimTask[] {
  return demand.map((task) => {
    const stationIds = compatibleStationIds(task, equipment)
    if (!stationIds.length) throw new Error(`Missing required station capability: ${task.capability}`)
    return { ...task, stationIds }
  })
}

export function generateServiceTasks(scenario: SimulationScenario, equipment: readonly EquipmentItem[], rng: Rng): SimTask[] {
  return bindServiceTaskStations(generateServiceTaskDemand(scenario, rng), equipment)
}
