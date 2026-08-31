import type { EquipmentItem, SimulationScenario, StaffRole, StationCapability } from '../domain/project'
import type { Rng } from './rng'
import type { SimTask } from './types'

const COOKING: StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook']
const COOK_ROLES: StaffRole[] = ['head-chef', 'sous-chef', 'cdp']
const WASH_ROLES: StaffRole[] = ['busser-washer']

function stationFor(capability: StationCapability, equipment: readonly EquipmentItem[], stage: string): string {
  const preferredId = stage === 'pre-rinse' ? 'pre-rinse-sink' : stage === 'dirty-window' || stage === 'dirty-landing' ? 'dirty-landing' : undefined
  const preferred = preferredId && equipment.find((item) => item.id === preferredId)
  if (preferred) return preferred.id
  const direct = equipment.find((item) => item.capabilities.includes(capability))
  if (direct) return direct.id
  if (capability === 'clean-window') return equipment.find((item) => item.capabilities.includes('finish-plate'))?.id ?? ''
  if (capability === 'dirty-window') return equipment.find((item) => item.capabilities.includes('dirty-landing'))?.id ?? ''
  return ''
}

const arrivalTime = (index: number, count: number, scenario: SimulationScenario, rng: Rng) => {
  const duration = scenario.durationMinutes * 60
  const progress = (index + rng.next() * .7) / Math.max(1, count)
  if (scenario.arrivalPattern === 'steady') return progress * duration * .85
  if (scenario.arrivalPattern === 'two-waves') return (index < count / 2 ? progress * duration * .35 : duration * .48 + (progress - .5) * duration * .55)
  return progress < .42 ? progress * duration * .42 : duration * .32 + (progress - .42) * duration * .68
}

function addChain(target: SimTask[], id: string, readyAtSeconds: number, flow: 'clean' | 'dirty', roles: StaffRole[], stages: { stage: string; capability: StationCapability; duration: number }[], equipment: readonly EquipmentItem[], orderId?: string, dishBatchId?: string) {
  let predecessorId: string | undefined
  stages.forEach((stage, index) => {
    const taskId = `${id}-${index}-${stage.stage}`
    const stationId = stationFor(stage.capability, equipment, stage.stage)
    if (!stationId) throw new Error(`Missing required station capability: ${stage.capability}`)
    target.push({ id: taskId, orderId, dishBatchId, predecessorId, capability: stage.capability, stationId, durationSeconds: Math.round(stage.duration), readyAtSeconds, flow, preferredRoles: roles })
    predecessorId = taskId
  })
}

export function generateServiceTasks(scenario: SimulationScenario, equipment: readonly EquipmentItem[], rng: Rng): SimTask[] {
  const tasks: SimTask[] = []
  const orderCount = Math.max(1, Math.ceil(scenario.covers / 2))
  const availableCooking = COOKING.filter((capability) => equipment.some((item) => item.capabilities.includes(capability)))
  if (!availableCooking.length) throw new Error('Missing required station capability: cooking')
  for (let index = 0; index < orderCount; index += 1) {
    const orderId = `order-${index + 1}`
    const cook = availableCooking[index % availableCooking.length]
    const cookedToOrder = index < Math.round(orderCount * scenario.cookToOrderRatio)
    addChain(tasks, orderId, arrivalTime(index, orderCount, scenario, rng), 'clean', COOK_ROLES, [
      { stage: 'retrieve', capability: 'cold-retrieval', duration: rng.between(20, 45) },
      { stage: 'prep', capability: 'food-prep', duration: rng.between(45, 120) },
      { stage: 'cook', capability: cook, duration: cookedToOrder ? rng.between(180, 540) : rng.between(60, 150) },
      { stage: 'finish', capability: 'finish-plate', duration: rng.between(25, 60) },
      { stage: 'pass', capability: 'clean-window', duration: rng.between(5, 15) },
    ], equipment, orderId)
  }
  const dishBatchCount = Math.max(1, Math.ceil(scenario.covers / 3))
  for (let index = 0; index < dishBatchCount; index += 1) {
    const id = `dish-${index + 1}`
    addChain(tasks, id, scenario.durationMinutes * 60 * (.38 + .52 * (index / dishBatchCount)), 'dirty', WASH_ROLES, [
      { stage: 'dirty-window', capability: 'dirty-window', duration: rng.between(8, 16) },
      { stage: 'dirty-landing', capability: 'dirty-landing', duration: rng.between(8, 20) },
      { stage: 'pre-rinse', capability: 'dish-pre-rinse', duration: rng.between(25, 55) },
      { stage: 'wash', capability: 'dish-wash', duration: rng.between(55, 110) },
      { stage: 'clean-landing', capability: 'clean-landing', duration: rng.between(12, 30) },
    ], equipment, undefined, id)
  }
  return tasks
}
