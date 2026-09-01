import { analyzeLayout } from '../../domain/layout-diagnostics'
import { projectSchema, scenarioSchema } from '../../domain/project-schema'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { executeLayoutQuery } from '../queries/layout-query'
import type { ApplicationService, ServiceResult } from './types'

const stale = <T,>(revision: number, expectedRevision?: number): ServiceResult<T> | null =>
  expectedRevision !== undefined && expectedRevision !== revision
    ? { ok: false, revision, code: 'stale-revision', message: `Expected revision ${expectedRevision}, received ${revision}.` }
    : null

export function createApplicationService(input: {
  store: ProjectStore
  runSimulation: (simulationInput: SimulationInput) => SimulationResult
}): ApplicationService {
  return {
    executeLayout: ({ command, ...options }) => input.store.getState().executeCommand(command, options),
    replaceProject: ({ project, expectedRevision, dryRun = false }) => {
      const state = input.store.getState()
      const conflict = stale<{ projectId: string }>(state.revision, expectedRevision)
      if (conflict) return conflict
      const parsed = projectSchema.safeParse(project)
      if (!parsed.success) return { ok: false, revision: state.revision, code: 'invalid-project', message: 'Project payload is invalid.', issues: parsed.error.issues }
      if (!dryRun) input.store.getState().replaceProject(parsed.data)
      return { ok: true, revision: dryRun ? state.revision : input.store.getState().revision, data: { projectId: parsed.data.id }, warnings: [], dryRun }
    },
    updateScenario: ({ scenarioId, patch, expectedRevision, dryRun = false }) => {
      const state = input.store.getState()
      const conflict = stale<{ scenarioId: string }>(state.revision, expectedRevision)
      if (conflict) return conflict
      const scenario = state.project.scenarios.find((candidate) => candidate.id === scenarioId)
      if (!scenario) return { ok: false, revision: state.revision, code: 'missing-scenario', message: `Scenario ${scenarioId} does not exist.` }
      const parsed = scenarioSchema.safeParse({ ...scenario, ...(patch && typeof patch === 'object' ? patch : {}), id: scenario.id })
      if (!parsed.success) return { ok: false, revision: state.revision, code: 'invalid-scenario', message: 'Scenario patch is invalid.', issues: parsed.error.issues }
      if (!dryRun) input.store.getState().updateScenario(scenarioId, parsed.data)
      return { ok: true, revision: dryRun ? state.revision : input.store.getState().revision, data: { scenarioId }, warnings: [], dryRun }
    },
    queryLayout: (query) => {
      const state = input.store.getState()
      return executeLayoutQuery({ project: state.project, revision: state.revision }, kitchenSpatialAdapter, query, (project) => {
        const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)
        return analyzeLayout(project.architecture, variant?.equipment ?? [])
      })
    },
    runScenario: ({ scenarioId, expectedRevision }) => {
      const state = input.store.getState()
      const conflict = stale<SimulationResult>(state.revision, expectedRevision)
      if (conflict) return conflict
      const scenario = state.project.scenarios.find((candidate) => candidate.id === scenarioId)
      if (!scenario) return { ok: false, revision: state.revision, code: 'missing-scenario', message: `Scenario ${scenarioId} does not exist.` }
      const result = input.runSimulation({ architecture: state.project.architecture, equipment: getActiveVariant(state).equipment, scenario })
      return { ok: true, revision: state.revision, data: result, warnings: [...result.warnings], dryRun: false }
    },
  }
}
