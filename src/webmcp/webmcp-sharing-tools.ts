import { z } from 'zod'
import { appStateStore } from '../state/app-state-store'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../state/simulation-run-store'
import { buildWorkspaceDeepLink } from '../app/workspace-deep-link'
import type { WebMcpToolDefinition } from './model-context'
import {
  downloadArtifact,
  resultsReportArtifact,
  SHARED_RESULT_SECTIONS,
  type SharedResultSection,
} from './project-artifacts'
import {
  currentRevision,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

const shareIncludeValues = ['report', 'workspace-link', ...SHARED_RESULT_SECTIONS] as const

const shareResultsInput = z.object({
  include: z.array(z.enum(shareIncludeValues)).min(1).max(shareIncludeValues.length)
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
  if (input.download && !input.include.some((value) => value === 'report' || SHARED_RESULT_SECTIONS.includes(value as SharedResultSection))) {
    context.addIssue({ code: 'custom', path: ['download'], message: 'download requires report or at least one report section in include.' })
  }
})

export type SharingToolDependencies = ToolDependencies & {
  runStore?: SimulationRunStore
  getHref?: () => string
}

/**
 * Creates the portable report + self-contained deep link sharing surface. Add
 * this factory to createWebMcpTools so it is included in the guide and normal
 * controller registration lifecycle.
 */
export function createSharingTools(deps: SharingToolDependencies): WebMcpToolDefinition[] {
  const runStore = deps.runStore ?? simulationRunStore
  return [{
    name: 'share_results',
    title: 'Share planning results',
    description: 'Create selected plan, metrics, findings, and assumptions sections as a scoped HTML report, a compressed self-contained workspace link, or both. The legacy report value requests every report section; workspace-link remains compatible.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        include: { type: 'array', items: { type: 'string', enum: shareIncludeValues }, description: 'Content to produce. plan, metrics, findings, and assumptions create a report containing only those sections. report is the compatibility shorthand for all sections; workspace-link adds a portable project link. Defaults to report plus workspace-link.' },
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
        shareProject.scenarios = [structuredClone(scenario)]
        shareProject.activeVariantId = primaryVariant.id
        shareProject.activeScenarioId = scenario.id
        shareProject.architecture = structuredClone(primaryVariant.architecture)
        delete shareProject.lastWorking
        const requestedSections = parsed.value.include.filter((value): value is SharedResultSection =>
          SHARED_RESULT_SECTIONS.includes(value as SharedResultSection))
        const includeFullReport = parsed.value.include.includes('report')
        const includeReport = includeFullReport || requestedSections.length > 0
        const artifact = includeReport ? resultsReportArtifact({
          project: shareProject,
          revision: state.revision,
          reports,
          ...(includeFullReport ? {} : { sections: requestedSections }),
        }) : undefined
        const includeWorkspaceLink = parsed.value.include.includes('workspace-link')
        const appState = appStateStore.getState()
        const workspaceUrl = includeWorkspaceLink ? buildWorkspaceDeepLink({
          project: shareProject,
          variantId: primaryVariant.id,
          scenarioId: scenario.id,
          stage: appState.stage,
          view: appState.view,
          overlay: appState.overlay,
          selectedIds: state.selectedIds.filter((id) => primaryVariant.equipment.some((item) => item.id === id)),
        }, deps.getHref?.()) : undefined
        const downloaded = artifact && parsed.value.download ? downloadArtifact(artifact) : false
        if (parsed.value.download && !downloaded) {
          return failure(state.revision, 'download-unavailable', 'The share report was generated, but this environment cannot start a browser download.', {
            ...(artifact ? { filename: artifact.filename, mimeType: artifact.mimeType } : {}),
            ...(artifact && parsed.value.returnContents ? { contents: artifact.contents } : {}),
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
          ...(artifact ? {
            filename: artifact.filename,
            mimeType: artifact.mimeType,
            reportSections: includeFullReport ? [...SHARED_RESULT_SECTIONS] : requestedSections,
            ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
            downloaded,
          } : {}),
          ...(includeWorkspaceLink ? {
            workspaceUrl,
            workspaceUrlScope: 'Portable snapshot: restores the shared layouts, scenario, view, and selection without local persistence.',
          } : {}),
        })
      } catch (error) {
        return failure(currentRevision(deps), 'share-failed', unknownErrorMessage(error))
      }
    },
  }]
}
