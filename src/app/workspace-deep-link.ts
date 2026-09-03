import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { KitchenProject } from '../domain/project'
import type { AppStateStore } from '../state/app-state-store'
import { exportProject, importProject } from '../state/persistence'
import type { ProjectStore } from '../state/project-store'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from './workflow'

const DEEP_LINK_VERSION = 'v2'
const LEGACY_DEEP_LINK_VERSION = 'v1'
export const MAX_DEEP_LINK_PROJECT_BYTES = 128 * 1_024
export const MAX_DEEP_LINK_PAYLOAD_LENGTH = 32 * 1_024
export const MAX_WORKSPACE_HASH_LENGTH = 48 * 1_024
const STAGES = new Set<WorkflowStage>(['space', 'equipment', 'simulate'])
const VIEWS = new Set<ViewMode>(['plan', 'scene', 'split'])
const OVERLAYS = new Set<Exclude<WorkspaceOverlay, null>>(['compare', 'auto-layout'])
const V2_PARAMETERS = new Set(['workspace', 'project', 'payload', 'variant', 'scenario', 'stage', 'view', 'overlay', 'select'])
const V2_SINGLE_PARAMETERS = ['workspace', 'project', 'payload', 'variant', 'scenario', 'stage', 'view', 'overlay'] as const

export type WorkspaceDeepLinkState = {
  project: KitchenProject
  variantId: string
  scenarioId: string
  stage: WorkflowStage
  view: ViewMode
  overlay: WorkspaceOverlay
  /** Component IDs to restore in the linked layout. Repeated `select` params preserve multi-selection. */
  selectedIds?: readonly string[]
}

export type ResolvedWorkspaceDeepLink = {
  /** Present for portable v2 links; absent for legacy local-project v1 links. */
  project?: KitchenProject
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

const utf8Length = (value: string): number => new TextEncoder().encode(value).byteLength

const encodeProject = (project: KitchenProject): string => {
  const json = JSON.stringify(JSON.parse(exportProject(project)))
  if (utf8Length(json) > MAX_DEEP_LINK_PROJECT_BYTES) {
    throw new Error(`Project is too large for a workspace link (maximum ${MAX_DEEP_LINK_PROJECT_BYTES} bytes).`)
  }
  const payload = compressToEncodedURIComponent(json)
  if (!payload || payload.length > MAX_DEEP_LINK_PAYLOAD_LENGTH) {
    throw new Error(`Compressed project is too large for a workspace link (maximum ${MAX_DEEP_LINK_PAYLOAD_LENGTH} characters).`)
  }
  return payload
}

const decodeProject = (payload: string): KitchenProject | null => {
  if (!payload || payload.length > MAX_DEEP_LINK_PAYLOAD_LENGTH) return null
  try {
    const json = decompressFromEncodedURIComponent(payload)
    if (!json || utf8Length(json) > MAX_DEEP_LINK_PROJECT_BYTES) return null
    return importProject(json)
  } catch {
    return null
  }
}

/** Builds a compressed, self-contained link to a validated project snapshot and workspace view. */
export function buildWorkspaceDeepLink(state: WorkspaceDeepLinkState, href = defaultHref()): string {
  const url = new URL(href, 'https://kitchen.hotelos.ai/')
  const params = new URLSearchParams()
  params.set('workspace', DEEP_LINK_VERSION)
  params.set('project', state.project.id)
  params.set('payload', encodeProject(state.project))
  params.set('variant', state.variantId)
  params.set('scenario', state.scenarioId)
  params.set('stage', state.stage)
  params.set('view', state.view)
  params.set('overlay', state.overlay ?? 'none')
  state.selectedIds?.forEach((id) => {
    if (id) params.append('select', id)
  })
  url.hash = params.toString()
  if (url.hash.length > MAX_WORKSPACE_HASH_LENGTH) {
    throw new Error(`Workspace link is too large (maximum ${MAX_WORKSPACE_HASH_LENGTH} characters).`)
  }
  return url.toString()
}

/** Resolves whitelisted state and strictly validates any embedded project before returning it. */
export function resolveWorkspaceDeepLink(hash: string, currentProject?: KitchenProject): ResolvedWorkspaceDeepLink | null {
  if (!hash || hash.length > MAX_WORKSPACE_HASH_LENGTH) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const version = params.get('workspace')
  let project: KitchenProject
  let portable = false
  if (version === DEEP_LINK_VERSION) {
    if ([...params.keys()].some((key) => !V2_PARAMETERS.has(key))) return null
    if (V2_SINGLE_PARAMETERS.some((key) => params.getAll(key).length !== 1)) return null
    const decoded = decodeProject(params.get('payload') ?? '')
    if (!decoded || params.get('project') !== decoded.id) return null
    project = decoded
    portable = true
  } else if (version === LEGACY_DEEP_LINK_VERSION) {
    if (!currentProject || params.get('project') !== currentProject.id) return null
    project = currentProject
  } else return null

  const requestedVariant = params.get('variant')
  const requestedScenario = params.get('scenario')
  const stage = params.get('stage')
  const view = params.get('view')
  const overlay = params.get('overlay')
  const requestedSelection = params.getAll('select')
  if (portable && (
    !STAGES.has(stage as WorkflowStage)
    || !VIEWS.has(view as ViewMode)
    || !(overlay === 'none' || OVERLAYS.has(overlay as Exclude<WorkspaceOverlay, null>))
  )) return null
  const resolvedVariant = project.variants.find((candidate) => candidate.id === requestedVariant)
    ?? project.variants.find((candidate) => candidate.id === project.activeVariantId)
  const validComponentIds = new Set(resolvedVariant?.equipment.map((item) => item.id) ?? [])

  return {
    ...(portable ? { project } : {}),
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

  const withResolvedSelection = (project: KitchenProject): KitchenProject => {
    const candidate = structuredClone(project)
    candidate.activeVariantId = resolved.variantId
    candidate.activeScenarioId = resolved.scenarioId
    const activeVariant = candidate.variants.find((variant) => variant.id === candidate.activeVariantId)
    if (activeVariant) candidate.architecture = structuredClone(activeVariant.architecture)
    return candidate
  }
  const canonicalCurrentProject = resolved.project === undefined
    ? undefined
    : withResolvedSelection(importProject(exportProject(projectState.project)))
  const portableProject = resolved.project === undefined ? undefined : withResolvedSelection(resolved.project)
  const samePortableSnapshot = resolved.project !== undefined
    && JSON.stringify(portableProject) === JSON.stringify(canonicalCurrentProject)
  const shouldReplaceProject = resolved.project !== undefined && !samePortableSnapshot
  if (shouldReplaceProject) {
    projectState.replaceProject(portableProject!)
  } else if (
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
