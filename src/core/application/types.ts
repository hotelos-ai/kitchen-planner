import type { CommandResult } from '../commands/execute-layout-command'
import type { LayoutQueryResult } from '../queries/layout-query'
import type { KitchenProject } from '../../domain/project'
import type { SimulationResult } from '../../simulation/types'
import type { LiveOrder, LiveStationQueue } from '../../simulation/live-state'
import type { SimulationScenario } from '../../domain/project'

export type ServiceResult<T> =
  | { ok: true; revision: number; data: T; warnings: string[]; dryRun: boolean }
  | { ok: false; revision: number; code: string; message: string; issues?: unknown }

export interface ApplicationService {
  executeLayout(input: { command: unknown; expectedRevision?: number; dryRun?: boolean }): CommandResult<KitchenProject>
  replaceProject(input: { project: unknown; expectedRevision?: number; dryRun?: boolean }): ServiceResult<{ projectId: string }>
  updateScenario(input: { scenarioId: string; patch: unknown; expectedRevision?: number; dryRun?: boolean }): ServiceResult<{ scenarioId: string }>
  queryLayout(query: unknown): LayoutQueryResult
  runScenario(input: { scenarioId: string; expectedRevision?: number }): ServiceResult<SimulationResult>
  querySimulation(input: { scenarioId: string; elapsedSeconds: number }): ServiceResult<SimulationQuerySnapshot>
}

export type SimulationQuerySnapshot = {
  assumptions: Pick<SimulationScenario, 'id' | 'name' | 'covers' | 'durationMinutes' | 'arrivalPattern' | 'cookToOrderRatio' | 'seed' | 'staff'>
  progress: { elapsedSeconds: number; durationSeconds: number; fraction: number; arrivedOrders: number; completedOrders: number; backlog: number; oldestOpenWaitSeconds: number }
  orders: LiveOrder[]
  stationQueues: LiveStationQueue[]
  metrics: SimulationResult['metrics']
  recommendations: string[]
}
