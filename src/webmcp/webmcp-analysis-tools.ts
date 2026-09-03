import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import type { WebMcpToolDefinition } from './model-context'
import {
  currentRevision,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

export type AnalysisToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
}

const essentialsInput = z.object({
  variantId: z.string().min(1).max(128).optional(),
  scenarioId: z.string().min(1).max(128).optional(),
}).strict()

type Requirement = {
  severity?: unknown
  recommendedCatalogIds?: unknown
}

export function createAnalysisTools(deps: AnalysisToolDependencies): WebMcpToolDefinition[] {
  const checkOperationalEssentials: WebMcpToolDefinition = {
    name: 'check_operational_essentials',
    title: 'Check operational essentials',
    description:
      'Check scenario-based operational readiness for a layout: required stations, service flows, staffing, capacities, circulation, clearances, and professional-review reminders. Advisory planning guidance only, not regulatory certification.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        scenarioId: { type: 'string', description: 'Optional scenario ID; defaults to the active scenario.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, essentialsInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid operational essentials request.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) {
          return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        }
        const scenarioId = parsed.value.scenarioId ?? state.project.activeScenarioId
        const scenario = state.project.scenarios.find((candidate) => candidate.id === scenarioId)
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${scenarioId} does not exist.`)

        const requirements = deps.getFacade().getLayoutRequirements({ variantId: variant.id, scenarioId: scenario.id }) as Requirement[]
        const blockerCount = requirements.filter((requirement) => requirement.severity === 'blocker').length
        const warningCount = requirements.filter((requirement) => requirement.severity === 'warning').length
        const professionalReviewCount = requirements.filter((requirement) => requirement.severity === 'professional-review').length
        const recommendedCatalogIds = [...new Set(requirements.flatMap((requirement) =>
          Array.isArray(requirement.recommendedCatalogIds)
            ? requirement.recommendedCatalogIds.filter((id): id is string => typeof id === 'string')
            : [],
        ))]

        return success(state.revision, {
          variantId: variant.id,
          scenarioId: scenario.id,
          ready: blockerCount === 0,
          status: blockerCount > 0 ? 'blocked' : warningCount > 0 ? 'ready-with-warnings' : 'ready',
          counts: {
            total: requirements.length,
            blockers: blockerCount,
            warnings: warningCount,
            professionalReview: professionalReviewCount,
          },
          recommendedCatalogIds,
          requirements: structuredClone(requirements),
          certification: 'Scenario-based operational planning guidance only; not a regulatory certification.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [checkOperationalEssentials]
}
