import { z } from 'zod'
import { appStateStore } from '../state/app-state-store'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../state/simulation-run-store'
import { buildWorkspaceDeepLink } from '../app/workspace-deep-link'
import type { WebMcpToolDefinition } from './model-context'
import { downloadArtifact, projectArtifact } from './project-artifacts'
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
  variantId: z.string().min(1).max(128).optional(),
  scenarioId: z.string().min(1).max(128).optional(),
  download: z.boolean().default(false),
  returnContents: z.boolean().default(true),
}).strict()

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
    description: 'Create a self-contained HTML planning report and a compact workspace deep link for the selected layout and scenario. The report is portable; the link restores the same locally saved project, layout, stage, and view. Optionally downloads the report for the user.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variantId: { type: 'string', description: 'Layout variant to share; defaults to the active layout.' },
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
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenario = state.project.scenarios.find((candidate) => candidate.id === (parsed.value.scenarioId ?? state.project.activeScenarioId))
        if (!scenario) return failure(state.revision, 'missing-scenario', `Scenario ${parsed.value.scenarioId ?? state.project.activeScenarioId} does not exist.`)

        const storedRun = selectSimulationRun(runStore.getState(), variant.id, scenario.id)
        const simulationStatus = storedRun === null
          ? 'not-run'
          : storedRun.ranAtRevision === state.revision ? 'current' : 'stale'
        const shareProject = structuredClone(state.project)
        shareProject.activeVariantId = variant.id
        shareProject.activeScenarioId = scenario.id
        shareProject.architecture = structuredClone(variant.architecture)
        const artifact = projectArtifact({
          project: shareProject,
          variant,
          revision: state.revision,
          format: 'report-html',
          simulation: simulationStatus === 'current' ? storedRun!.result : null,
        })
        const appState = appStateStore.getState()
        const workspaceUrl = buildWorkspaceDeepLink({
          projectId: state.project.id,
          variantId: variant.id,
          scenarioId: scenario.id,
          stage: appState.stage,
          view: appState.view,
          overlay: appState.overlay,
        }, deps.getHref?.())
        const downloaded = parsed.value.download ? downloadArtifact(artifact) : false
        if (parsed.value.download && !downloaded) {
          return failure(state.revision, 'download-unavailable', 'The share report was generated, but this environment cannot start a browser download.', {
            filename: artifact.filename,
            mimeType: artifact.mimeType,
            ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
            workspaceUrl,
          })
        }
        return success(state.revision, {
          variantId: variant.id,
          scenarioId: scenario.id,
          simulationStatus,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
          downloaded,
          workspaceUrl,
          workspaceUrlScope: 'Restores state only where this project is already saved; use the self-contained report for portable sharing.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'share-failed', unknownErrorMessage(error))
      }
    },
  }]
}
