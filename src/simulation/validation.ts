import type { EquipmentItem, PointMm, StationCapability } from '../domain/project'
import { buildNavGrid, findRoute } from './nav-grid'
import type { SimulationInput } from './types'

export type SimulationValidationError = {
  code: 'missing-entry' | 'missing-window' | 'missing-capability' | 'unreachable'
  message: string
  capability?: StationCapability | 'cooking'
  itemIds: string[]
}

const stationGoal = (item: EquipmentItem): PointMm => {
  const radians = item.rotationDeg * Math.PI / 180
  const x = item.widthMm / 2
  const y = item.depthMm + 150
  return { x: item.xMm + x * Math.cos(radians) - y * Math.sin(radians), y: item.yMm + x * Math.sin(radians) + y * Math.cos(radians) }
}

export function validateSimulationInput(input: SimulationInput): SimulationValidationError[] {
  const errors: SimulationValidationError[] = []
  const entry = input.architecture.openings.find((opening) => opening.flow === 'entry' && opening.kind === 'door')
  if (!entry) errors.push({ code: 'missing-entry', message: 'D2 staff entry is required before a service can run.', itemIds: [] })
  const cleanWindow = input.architecture.openings.find((opening) => opening.flow === 'clean-out' && opening.kind === 'service-window')
  const dirtyWindow = input.architecture.openings.find((opening) => opening.flow === 'dirty-in' && opening.kind === 'service-window')
  if (!cleanWindow) errors.push({ code: 'missing-window', message: 'A clean service window is required.', itemIds: [] })
  if (!dirtyWindow) errors.push({ code: 'missing-window', message: 'A dirty return window is required.', itemIds: [] })
  const required: (StationCapability | 'cooking')[] = ['cooking', 'cold-retrieval', 'food-prep', 'finish-plate', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash']
  const cookingCapabilities: StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook']
  const stations: EquipmentItem[] = []
  required.forEach((capability) => {
    const station = capability === 'cooking'
      ? input.equipment.find((item) => item.capabilities.some((value) => cookingCapabilities.includes(value)))
      : input.equipment.find((item) => item.capabilities.includes(capability))
    if (!station) errors.push({ code: 'missing-capability', capability, message: `Assign ${capability.replaceAll('-', ' ')} to at least one equipment item.`, itemIds: [] })
    else stations.push(station)
  })
  if (!entry || errors.some((error) => error.code === 'missing-capability')) return errors
  const entryPoint = { x: entry.wall === 'right' ? input.architecture.widthMm - 150 : 150, y: entry.offsetMm + entry.widthMm / 2 }
  const grid = buildNavGrid({ architecture: input.architecture, equipment: input.equipment }, 100)
  const routeTargets = [...new Map(stations.map((station) => [station.id, station])).values()]
  routeTargets.forEach((station) => {
    try { findRoute(grid, entryPoint, stationGoal(station)) }
    catch { errors.push({ code: 'unreachable', message: `${station.label} cannot be reached from D2 on the current circulation grid.`, itemIds: [station.id] }) }
  })
  for (const opening of [cleanWindow, dirtyWindow]) if (opening) {
    const target = { x: opening.wall === 'right' ? input.architecture.widthMm - 150 : opening.wall === 'left' ? 150 : opening.offsetMm + opening.widthMm / 2, y: opening.wall === 'top' ? 150 : opening.wall === 'bottom' ? input.architecture.depthMm - 150 : opening.offsetMm + opening.widthMm / 2 }
    try { findRoute(grid, entryPoint, target) } catch { errors.push({ code: 'unreachable', message: `${opening.label} cannot be reached from D2.`, itemIds: [] }) }
  }
  return errors
}
