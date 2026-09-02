import { analyzeLayout } from '../../domain/layout-diagnostics'
import { projectSchema } from '../../domain/project-schema'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import type { SimulationResult } from '../../simulation/types'
import { deriveLiveServiceState } from '../../simulation/live-state'
import { getWorkspaceFacade, type ProjectStore } from '../../state/project-store'
import { executeLayoutQuery } from '../queries/layout-query'
import type { ApplicationService, ServiceResult } from './types'

const stale = <T,>(revision: number, expectedRevision?: number): ServiceResult<T> | null =>
  expectedRevision !== undefined && expectedRevision !== revision
    ? { ok: false, revision, code: 'stale-revision', message: `Expected revision ${expectedRevision}, received ${revision}.` }
    : null

export function createApplicationService(input: {
  store: ProjectStore
}): ApplicationService {
  const runs = new Map<string, { revision: number; result: SimulationResult }>()
  const facade = getWorkspaceFacade(input.store)
  return {
    ...facade,
    runSimulation: (request) => {
      const result = facade.runSimulation(request)
      if (result && typeof result === 'object' && 'events' in result && 'metrics' in result) {
        runs.set(request.scenarioId, { revision: input.store.getState().revision, result: result as SimulationResult })
      }
      return result
    },
    replaceProject: ({ project, expectedRevision, dryRun = false }) => {
      const state = input.store.getState()
      const conflict = stale<{ projectId: string }>(state.revision, expectedRevision)
      if (conflict) return conflict
      const parsed = projectSchema.safeParse(project)
      if (!parsed.success) return { ok: false, revision: state.revision, code: 'invalid-project', message: 'Project payload is invalid.', issues: parsed.error.issues }
      if (!dryRun) input.store.getState().replaceProject(parsed.data)
      return { ok: true, revision: dryRun ? state.revision : input.store.getState().revision, data: { projectId: parsed.data.id }, warnings: [], dryRun }
    },
    queryLayout: (query) => {
      const state = input.store.getState()
      return executeLayoutQuery({ project: state.project, revision: state.revision }, kitchenSpatialAdapter, query, (project) => {
        const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)
        return analyzeLayout(variant?.architecture ?? project.architecture, variant?.equipment ?? [])
      })
    },
    querySimulation: ({ scenarioId, elapsedSeconds }) => {
      const state = input.store.getState()
      const scenario = state.project.scenarios.find((candidate) => candidate.id === scenarioId)
      if (!scenario) return { ok: false, revision: state.revision, code: 'missing-scenario', message: `Scenario ${scenarioId} does not exist.` }
      const run = runs.get(scenarioId)
      if (!run) return { ok: false, revision: state.revision, code: 'missing-run', message: `Scenario ${scenarioId} has not been run.` }
      if (run.revision !== state.revision) return { ok: false, revision: state.revision, code: 'stale-run', message: 'The layout or scenario changed after this simulation was run.' }
      const live = deriveLiveServiceState(run.result, elapsedSeconds)
      return {
        ok: true,
        revision: state.revision,
        data: {
          assumptions: { id: scenario.id, name: scenario.name, covers: scenario.covers, durationMinutes: scenario.durationMinutes, arrivalPattern: scenario.arrivalPattern, cookToOrderRatio: scenario.cookToOrderRatio, seed: run.result.seed, staff: structuredClone(scenario.staff) },
          progress: { elapsedSeconds: live.elapsedSeconds, durationSeconds: run.result.durationSeconds, fraction: live.elapsedSeconds / Math.max(1, run.result.durationSeconds), arrivedOrders: live.arrivedOrders, completedOrders: live.completedOrders, backlog: live.backlog, oldestOpenWaitSeconds: live.oldestOpenWaitSeconds },
          orders: structuredClone(live.orders),
          stationQueues: structuredClone(live.stationQueues),
          metrics: structuredClone(run.result.metrics),
          recommendations: [...run.result.warnings],
        },
        warnings: [...run.result.warnings],
        dryRun: false,
      }
    },
  }
}
