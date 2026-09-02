import { analyzeLayout } from '../../domain/layout-diagnostics'
import type { EquipmentItem, KitchenProject } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'
import { executeWorkspaceBatch } from './execute-workspace-batch'
import { createPreviewRegistry } from './preview-registry'
import type { WorkspaceOperation } from './workspace-operation'

type FacadeError = { ok: false; revision: number; code: string; message: string; issues?: unknown; operationIndex?: number }

type PreviewCandidate = {
  project: KitchenProject
  changedIds: string[]
  warnings: string[]
  intent?: string
}

type FacadeDependencies = {
  store: ProjectStore
  listCatalog?: (filters?: unknown) => unknown[]
  getRequirements?: (input: { variantId: string; scenarioId?: string }) => unknown[]
  suggestPlacement?: (input: { variantId: string; catalogId: string; preferredPoint?: { xMm: number; yMm: number } }) => unknown
  runSimulation?: (input: unknown) => unknown
  runAutoLayout?: (input: unknown) => unknown
  cancelRun?: (input: { runId: string }) => unknown
  resolveCatalogComponent?: (
    operation: Extract<WorkspaceOperation, { type: 'add_component' }>,
    project: KitchenProject,
  ) => EquipmentItem
}

const diagnosticsFor = (project: KitchenProject) => {
  const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId) ?? project.variants[0]
  return variant ? analyzeLayout(variant.architecture, variant.equipment) : []
}

export function createWorkspaceFacade(dependencies: FacadeDependencies) {
  const previews = createPreviewRegistry<'layout', WorkspaceOperation, PreviewCandidate>()

  const previewLayoutChanges = (input: { expectedRevision: number; operations: readonly unknown[]; intent?: string }) => {
    const state = dependencies.store.getState()
    const result = executeWorkspaceBatch({
      project: state.project,
      revision: state.revision,
      expectedRevision: input.expectedRevision,
      operations: input.operations,
      resolveCatalogComponent: dependencies.resolveCatalogComponent,
    })
    if (!result.ok) return {
      ok: false as const,
      revision: result.revision,
      code: result.code,
      message: result.message,
      issues: result.issues,
      operationIndex: result.operationIndex,
    }
    const candidate: PreviewCandidate = {
      project: result.project,
      changedIds: result.changedIds,
      warnings: result.warnings,
      intent: input.intent,
    }
    const previewToken = previews.issue({
      kind: 'layout',
      documentId: state.documentId,
      revision: state.revision,
      normalizedOperations: result.normalizedOperations,
      candidate,
    })
    return {
      ok: true as const,
      revision: state.revision,
      previewToken,
      changedIds: [...result.changedIds],
      warnings: [...result.warnings],
      normalizedOperations: structuredClone(result.normalizedOperations),
      diagnostics: diagnosticsFor(result.project),
    }
  }

  const applyLayoutChanges = (input: { previewToken: string }) => {
    const state = dependencies.store.getState()
    const expectation = { kind: 'layout' as const, documentId: state.documentId, revision: state.revision }
    const preview = previews.peek(input.previewToken, expectation)
    if (!preview.ok) return { ok: false as const, revision: state.revision, code: preview.code, message: preview.message }
    const committed = dependencies.store.getState().commitProjectCandidate(
      preview.preview.candidate.project,
      preview.preview.revision,
      preview.preview.documentId,
    )
    if (!committed.ok) return { ...committed, ok: false as const }
    const consumed = previews.consume(input.previewToken, expectation)
    if (!consumed.ok) return { ok: false as const, revision: committed.revision, code: consumed.code, message: consumed.message }
    return {
      ok: true as const,
      revision: committed.revision,
      changedIds: [...preview.preview.candidate.changedIds],
      warnings: [...preview.preview.candidate.warnings],
      diagnostics: diagnosticsFor(preview.preview.candidate.project),
    }
  }

  return {
    getComponentCatalog(filters?: unknown) {
      return structuredClone(dependencies.listCatalog?.(filters) ?? [])
    },
    getLayoutRequirements(input: { variantId: string; scenarioId?: string }) {
      return structuredClone(dependencies.getRequirements?.(input) ?? [])
    },
    suggestPlacement(input: { variantId: string; catalogId: string; preferredPoint?: { xMm: number; yMm: number } }) {
      return structuredClone(dependencies.suggestPlacement?.(input) ?? null)
    },
    previewLayoutChanges,
    applyLayoutChanges,
    applyOperations(operations: readonly unknown[], intent?: string) {
      const preview = previewLayoutChanges({ expectedRevision: dependencies.store.getState().revision, operations, intent })
      if (!preview.ok) return preview
      return applyLayoutChanges({ previewToken: preview.previewToken })
    },
    runSimulation(input: unknown): unknown | FacadeError {
      if (dependencies.runSimulation) return dependencies.runSimulation(input)
      return { ok: false, revision: dependencies.store.getState().revision, code: 'simulation-not-configured', message: 'Simulation service is not configured.' }
    },
    runAutoLayout(input: unknown): unknown | FacadeError {
      if (dependencies.runAutoLayout) return dependencies.runAutoLayout(input)
      return { ok: false, revision: dependencies.store.getState().revision, code: 'auto-layout-not-configured', message: 'Auto-layout service is not configured.' }
    },
    cancelRun(input: { runId: string }): unknown | FacadeError {
      if (dependencies.cancelRun) return dependencies.cancelRun(input)
      return { ok: false, revision: dependencies.store.getState().revision, code: 'run-not-found', message: `Run ${input.runId} is not active.` }
    },
  }
}

export type WorkspaceFacade = ReturnType<typeof createWorkspaceFacade>
