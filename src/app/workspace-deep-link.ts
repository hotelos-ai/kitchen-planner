import type { KitchenProject } from '../domain/project'
import type { AppStateStore } from '../state/app-state-store'
import type { ProjectStore } from '../state/project-store'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from './workflow'

const DEEP_LINK_VERSION = 'v1'
const MAX_HASH_LENGTH = 4_096
const STAGES = new Set<WorkflowStage>(['space', 'equipment', 'simulate'])
const VIEWS = new Set<ViewMode>(['plan', 'scene', 'split'])
const OVERLAYS = new Set<Exclude<WorkspaceOverlay, null>>(['compare', 'auto-layout'])

export type WorkspaceDeepLinkState = {
  projectId: string
  variantId: string
  scenarioId: string
  stage: WorkflowStage
  view: ViewMode
  overlay: WorkspaceOverlay
  /** Component IDs to restore in the linked layout. Repeated `select` params preserve multi-selection. */
  selectedIds?: readonly string[]
}

export type ResolvedWorkspaceDeepLink = {
  variantId: string
  scenarioId: string
  stage?: WorkflowStage
  view?: ViewMode
  overlay?: WorkspaceOverlay
  /** Undefined means the legacy link did not specify selection; an empty array means it explicitly resolves to no valid items. */
  selectedIds?: string[]
}

const defaultHref = (): string => {
  if (typeof window !== 'undefined') return window.location.href
  return 'https://kitchen.hotelos.ai/'
}

/**
 * Builds a compact, data-free link to a view of a project. The project itself
 * intentionally remains in validated persistence (or an exported project
 * file), rather than being copied into an unbounded URL fragment.
 */
export function buildWorkspaceDeepLink(state: WorkspaceDeepLinkState, href = defaultHref()): string {
  const url = new URL(href, 'https://kitchen.hotelos.ai/')
  const params = new URLSearchParams()
  params.set('workspace', DEEP_LINK_VERSION)
  params.set('project', state.projectId)
  params.set('variant', state.variantId)
  params.set('scenario', state.scenarioId)
  params.set('stage', state.stage)
  params.set('view', state.view)
  params.set('overlay', state.overlay ?? 'none')
  state.selectedIds?.forEach((id) => {
    if (id) params.append('select', id)
  })
  url.hash = params.toString()
  return url.toString()
}

/** Resolve only whitelisted state, and only against the currently open project. */
export function resolveWorkspaceDeepLink(hash: string, project: KitchenProject): ResolvedWorkspaceDeepLink | null {
  if (!hash || hash.length > MAX_HASH_LENGTH) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('workspace') !== DEEP_LINK_VERSION || params.get('project') !== project.id) return null

  const requestedVariant = params.get('variant')
  const requestedScenario = params.get('scenario')
  const stage = params.get('stage')
  const view = params.get('view')
  const overlay = params.get('overlay')
  const requestedSelection = params.getAll('select')
  const resolvedVariant = project.variants.find((candidate) => candidate.id === requestedVariant)
    ?? project.variants.find((candidate) => candidate.id === project.activeVariantId)
  const validComponentIds = new Set(resolvedVariant?.equipment.map((item) => item.id) ?? [])

  return {
    variantId: project.variants.some((candidate) => candidate.id === requestedVariant)
      ? requestedVariant!
      : project.activeVariantId,
    scenarioId: project.scenarios.some((candidate) => candidate.id === requestedScenario)
      ? requestedScenario!
      : project.activeScenarioId,
    ...(STAGES.has(stage as WorkflowStage) ? { stage: stage as WorkflowStage } : {}),
    ...(VIEWS.has(view as ViewMode) ? { view: view as ViewMode } : {}),
    ...(overlay === 'none'
      ? { overlay: null }
      : OVERLAYS.has(overlay as Exclude<WorkspaceOverlay, null>)
        ? { overlay: overlay as Exclude<WorkspaceOverlay, null> }
        : {}),
    ...(requestedSelection.length > 0
      ? { selectedIds: [...new Set(requestedSelection.filter((id) => validComponentIds.has(id)))] }
      : {}),
  }
}

/**
 * Restores one resolved link atomically. Invalid IDs fall back to the active
 * project selections; invalid UI values are ignored.
 */
export function applyWorkspaceDeepLink(
  hash: string,
  projectStore: ProjectStore,
  appStateStore: AppStateStore,
): boolean {
  const projectState = projectStore.getState()
  const resolved = resolveWorkspaceDeepLink(hash, projectState.project)
  if (!resolved) return false

  if (
    resolved.variantId !== projectState.project.activeVariantId
    || resolved.scenarioId !== projectState.project.activeScenarioId
  ) {
    const candidate = structuredClone(projectState.project)
    candidate.activeVariantId = resolved.variantId
    candidate.activeScenarioId = resolved.scenarioId
    const activeVariant = candidate.variants.find((variant) => variant.id === candidate.activeVariantId)
    if (activeVariant) candidate.architecture = structuredClone(activeVariant.architecture)
    projectState.commitProjectCandidate(candidate, projectState.revision, projectState.documentId)
  }

  const appState = appStateStore.getState()
  if (resolved.stage !== undefined) appState.setStage(resolved.stage)
  if (resolved.view !== undefined) appStateStore.getState().setView(resolved.view)
  if (resolved.overlay !== undefined) appStateStore.getState().setOverlay(resolved.overlay)
  if (resolved.selectedIds !== undefined) projectStore.getState().selectItems(resolved.selectedIds)
  return true
}
