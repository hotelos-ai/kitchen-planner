import { z } from 'zod'
import { appStateStore } from '../state/app-state-store'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../state/simulation-run-store'
import { buildWorkspaceDeepLink } from '../app/workspace-deep-link'
import type { WebMcpToolDefinition } from './model-context'
import { downloadArtifact, resultsReportArtifact } from './project-artifacts'
import {
  currentRevision,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

const shareResultsInput = z.object({
  include: z.array(z.enum(['report', 'workspace-link'])).min(1).max(2)
    .default(['report', 'workspace-link']),
  variantIds: z.array(z.string().min(1).max(128)).min(1).max(12).optional(),
  /** @deprecated Use variantIds. */
  variantId: z.string().min(1).max(128).optional(),
  scenarioId: z.string().min(1).max(128).optional(),
  download: z.boolean().default(false),
  returnContents: z.boolean().default(true),
}).strict().superRefine((input, context) => {
  if (new Set(input.include).size !== input.include.length) {
    context.addIssue({ code: 'custom', path: ['include'], message: 'include entries must be unique.' })
  }
  if (input.variantIds && new Set(input.variantIds).size !== input.variantIds.length) {
    context.addIssue({ code: 'custom', path: ['variantIds'], message: 'variantIds entries must be unique.' })
  }
  if (input.variantIds && input.variantId) {
    context.addIssue({ code: 'custom', path: ['variantId'], message: 'Use variantIds or the deprecated variantId alias, not both.' })
  }
  if (input.download && !input.include.includes('report')) {
    context.addIssue({ code: 'custom', path: ['download'], message: 'download requires report in include.' })
  }
})

export type SharingToolDependencies = ToolDependencies & {
  runStore?: SimulationRunStore
  getHref?: () => string
}

/**
 * Creates the portable report + local-project deep link sharing surface. Add
 * this factory to createWebMcpTools so it is included in the guide and normal
 * controller registration lifecycle.
 */
export function createSharingTools(deps: SharingToolDependencies): WebMcpToolDefinition[] {
  const runStore = deps.runStore ?? simulationRunStore
  return [{
    name: 'share_results',
    title: 'Share planning results',
    description: 'Create a scoped, self-contained HTML report, a compact workspace deep link, or both for selected layouts and one scenario. The portable report contains only requested layouts; the link restores the first layout in the same locally saved project, including view and selection.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        include: { type: 'array', items: { type: 'string', enum: ['report', 'workspace-link'] }, description: 'Artifacts to produce. Defaults to both report and workspace-link.' },
        variantIds: { type: 'array', items: { type: 'string' }, description: 'One or more layout variants to include. Defaults to the active layout; the first is used by the workspace link.' },
        variantId: { type: 'string', description: 'Deprecated single-layout alias retained for compatibility. Use variantIds for new calls.' },
        scenarioId: { type: 'string', description: 'Scenario to share; defaults to the active scenario.' },
        download: { type: 'boolean', description: 'Download the generated HTML report in the user browser. Defaults to false.' },
        returnContents: { type: 'boolean', description: 'Include the complete report HTML in the tool response. Set false for large reports. Defaults to true.' },
      },
    },
    annotations: { untrustedContentHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, shareResultsInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid sharing request.', parsed.issues)
        const state = deps.store.getState()
        const requestedVariantIds = parsed.value.variantIds
          ?? [parsed.value.variantId ?? state.project.activeVariantId]
        const variants = requestedVariantIds.map((id) => resolveVariant(state.project, id))
        const missingVariantId = requestedVariantIds.find((_, index) => !variants[index])
        if (missingVariantId) return failure(state.revision, 'missing-variant', `Layout variant ${missingVariantId} does not exist.`)
        const selectedVariants = variants.filter((variant) => variant !== undefined)
        const primaryVariant = selectedVariants[0]!
        const scenario = state.project.scenarios.find((candidate) => candidate.id === (parsed.value.scenarioId ?? state.project.activeScenarioId))
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${parsed.value.scenarioId ?? state.project.activeScenarioId} does not exist.`)

        const reports = selectedVariants.map((variant) => {
          const storedRun = selectSimulationRun(runStore.getState(), variant.id, scenario.id)
          const simulationStatus = storedRun === null
            ? 'not-run' as const
            : storedRun.ranAtRevision === state.revision ? 'current' as const : 'stale' as const
          return {
            variant,
            scenario,
            simulationStatus,
            simulation: simulationStatus === 'current' ? storedRun!.result : null,
          }
        })
        const shareProject = structuredClone(state.project)
        shareProject.variants = selectedVariants.map((variant) => structuredClone(variant))
        shareProject.activeVariantId = primaryVariant.id
        shareProject.activeScenarioId = scenario.id
        shareProject.architecture = structuredClone(primaryVariant.architecture)
        const artifact = resultsReportArtifact({
          project: shareProject,
          revision: state.revision,
          reports,
        })
        const appState = appStateStore.getState()
        const workspaceUrl = buildWorkspaceDeepLink({
          projectId: state.project.id,
          variantId: primaryVariant.id,
          scenarioId: scenario.id,
          stage: appState.stage,
          view: appState.view,
          overlay: appState.overlay,
          selectedIds: state.selectedIds.filter((id) => primaryVariant.equipment.some((item) => item.id === id)),
        }, deps.getHref?.())
        const includeReport = parsed.value.include.includes('report')
        const includeWorkspaceLink = parsed.value.include.includes('workspace-link')
        const downloaded = includeReport && parsed.value.download ? downloadArtifact(artifact) : false
        if (parsed.value.download && !downloaded) {
          return failure(state.revision, 'download-unavailable', 'The share report was generated, but this environment cannot start a browser download.', {
            ...(includeReport ? { filename: artifact.filename, mimeType: artifact.mimeType } : {}),
            ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
            ...(includeWorkspaceLink ? { workspaceUrl } : {}),
          })
        }
        return success(state.revision, {
          include: parsed.value.include,
          variantId: primaryVariant.id,
          variantIds: selectedVariants.map((variant) => variant.id),
          scenarioId: scenario.id,
          simulationStatus: reports[0].simulationStatus,
          simulationStatuses: reports.map(({ variant, simulationStatus }) => ({ variantId: variant.id, status: simulationStatus })),
          ...(includeReport ? {
            filename: artifact.filename,
            mimeType: artifact.mimeType,
            ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
            downloaded,
          } : {}),
          ...(includeWorkspaceLink ? {
            workspaceUrl,
            workspaceUrlScope: 'Restores state only where this project is already saved; use the self-contained report for portable sharing.',
          } : {}),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'share-failed', unknownErrorMessage(error))
      }
    },
  }]
}
