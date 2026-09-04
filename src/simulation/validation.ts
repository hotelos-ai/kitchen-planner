import {
  evaluateOperationalRequirements,
  type OperationalRequirementInput,
  type OperationalRequirementResult,
} from '../domain/requirements/operational-requirements'
import { getCatalogEntry } from '../domain/catalog/kitchen-catalog'
import type { EquipmentItem, StaffRole, StationCapability } from '../domain/project'
import type { SimulationInput } from './types'

export type SimulationValidationError = Pick<OperationalRequirementResult, 'code' | 'message' | 'itemIds'>
  & Partial<Omit<OperationalRequirementResult, 'code' | 'message' | 'itemIds'>>

const STAFF_ROLES = new Set<StaffRole>(['head-chef', 'sous-chef', 'cdp', 'busser-washer'])
const CAPABILITIES = new Set<StationCapability>([
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
])
const error = (code: string, message: string, itemIds: string[], details: Partial<SimulationValidationError> = {}): SimulationValidationError => ({
  code,
  message,
  itemIds,
  severity: 'blocker',
  ...details,
})

export const physicalStationCapacity = (item: EquipmentItem): number => {
  const catalog = item.catalogId ? getCatalogEntry(item.catalogId) : undefined
  if (catalog) {
    const configured = catalog.physicalConfigurations.find((preset) => preset.id === item.configurationPreset)
    return Math.max(1, (configured ?? catalog).capacity.workPositions)
  }
  return Math.max(1, Math.floor(item.widthMm / 600))
}

export function validateSimulationInput(input: SimulationInput & Pick<OperationalRequirementInput, 'layoutConstraints'>): SimulationValidationError[] {
  const errors: SimulationValidationError[] = evaluateOperationalRequirements(input).filter((result) => result.severity === 'blocker')

  input.scenario.staff.forEach((assignment) => {
    if (!STAFF_ROLES.has(assignment.role as StaffRole)) {
      errors.push(error('scenario-staff-role-invalid', `Unknown simulation staff role: ${assignment.role}.`, [String(assignment.role)]))
    }
  })

  Object.entries(input.scenario.stationCapacities ?? {}).forEach(([stationId, configured]) => {
    const station = input.equipment.find((item) => item.id === stationId)
    if (!station || !Number.isInteger(configured) || configured < 1) return
    const physical = physicalStationCapacity(station)
    if (configured > physical) errors.push(error(
      'station-capacity-exceeds-physical',
      `${station.label} is configured for ${configured} concurrent tasks but its modeled physical capacity is ${physical}.`,
      [station.id],
      { source: 'scenario-capacity', scope: 'scenario', requiredCapacity: physical, actualCapacity: configured },
    ))
  })

  Object.entries(input.scenario.taskDurations ?? {}).forEach(([capability, range]) => {
    if (!CAPABILITIES.has(capability as StationCapability)) {
      errors.push(error('task-duration-capability-invalid', `Unknown task duration capability: ${capability}.`, [capability]))
      return
    }
    if (!range || !Number.isFinite(range.minSeconds) || !Number.isFinite(range.maxSeconds)
      || range.minSeconds <= 0 || range.maxSeconds <= 0 || range.minSeconds > range.maxSeconds) {
      errors.push(error('task-duration-range-invalid', `Task duration range for ${capability} must be finite, positive, and ordered minimum to maximum.`, [capability]))
    }
  })

  return errors
}

export function simulationValidationWarnings(input: SimulationInput & Pick<OperationalRequirementInput, 'layoutConstraints'>): SimulationValidationError[] {
  return evaluateOperationalRequirements(input)
    .filter((result) => result.severity === 'warning')
}
