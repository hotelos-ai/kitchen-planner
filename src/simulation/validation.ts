import {
  evaluateOperationalRequirements,
  type OperationalRequirementInput,
  type OperationalRequirementResult,
} from '../domain/requirements/operational-requirements'
import type { SimulationInput } from './types'

export type SimulationValidationError = Pick<OperationalRequirementResult, 'code' | 'message' | 'itemIds'>
  & Partial<Omit<OperationalRequirementResult, 'code' | 'message' | 'itemIds'>>

export function validateSimulationInput(input: SimulationInput & Pick<OperationalRequirementInput, 'layoutConstraints'>): SimulationValidationError[] {
  return evaluateOperationalRequirements(input).filter((result) => result.severity === 'blocker')
}
