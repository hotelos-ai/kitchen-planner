import type { LayoutQueryResult } from '../queries/layout-query'
import type { SimulationResult } from '../../simulation/types'
import type { LiveOrder, LiveStationQueue } from '../../simulation/live-state'
import type { SimulationScenario } from '../../domain/project'
import type { WorkspaceFacade } from '../workspace/workspace-facade'

export type ServiceResult<T> =
  | { ok: true; revision: number; data: T; warnings: string[]; dryRun: boolean }
  | { ok: false; revision: number; code: string; message: string; issues?: unknown }

export type ApplicationService = WorkspaceFacade & {
  replaceProject(input: { project: unknown; expectedRevision?: number; dryRun?: boolean }): ServiceResult<{ projectId: string }>
  queryLayout(query: unknown): LayoutQueryResult
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
