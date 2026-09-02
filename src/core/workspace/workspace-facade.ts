import { analyzeLayout } from '../../domain/layout-diagnostics'
import type { EquipmentItem, KitchenProject, LayoutVariant } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'
import { executeWorkspaceBatch } from './execute-workspace-batch'
import { createPreviewRegistry } from './preview-registry'
import type { WorkspaceOperation } from './workspace-operation'

type FacadeError = { ok: false; revision: number; code: string; message: string; issues?: unknown; operationIndex?: number }

export type WorkspaceSimulationRequest = {
  variantId: string
  scenarioId: string
  seed: number
  outputMode?: 'full' | 'metrics-only'
}

type PreviewCandidate = {
  project: KitchenProject
  changedIds: string[]
  warnings: string[]
  diagnostics: ReturnType<typeof diagnosticsDelta>
  intent?: string
}

type FacadeDependencies = {
  store: ProjectStore
  listCatalog?: (filters?: unknown) => unknown[]
  getRequirements?: (input: { variantId: string; scenarioId?: string }) => unknown[]
  suggestPlacement?: (input: { variantId: string; catalogId: string; preferredPoint?: { xMm: number; yMm: number } }) => unknown
  runSimulation?: (input: WorkspaceSimulationRequest & { outputMode: 'full' | 'metrics-only' }) => unknown
  runAutoLayout?: (input: unknown) => unknown
  cancelRun?: (input: { runId: string }) => unknown
  resolveCatalogComponent?: (
    operation: Extract<WorkspaceOperation, { type: 'add_component' }>,
    project: KitchenProject,
  ) => EquipmentItem
  resolveAdoptedVariant?: (
    operation: Extract<WorkspaceOperation, { type: 'adopt_auto_layout_result' }>,
    project: KitchenProject,
  ) => LayoutVariant
}

const diagnosticsFor = (project: KitchenProject, variantIds: readonly string[]) => variantIds.flatMap((variantId) => {
  const variant = project.variants.find((candidate) => candidate.id === variantId)
  return variant ? analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints }).map((issue) => ({ ...issue, variantId })) : []
})

const diagnosticsDelta = (before: KitchenProject, after: KitchenProject, variantIds: readonly string[]) => {
  const previous = diagnosticsFor(before, variantIds)
  const next = diagnosticsFor(after, variantIds)
  const key = (issue: { variantId: string; id: string }) => `${issue.variantId}\u0000${issue.id}`
  const previousKeys = new Set(previous.map(key))
  const nextKeys = new Set(next.map(key))
  return {
    added: next.filter((issue) => !previousKeys.has(key(issue))),
    resolved: previous.filter((issue) => !nextKeys.has(key(issue))),
    current: next,
  }
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
      resolveAdoptedVariant: dependencies.resolveAdoptedVariant,
    })
    if (!result.ok) return {
      ok: false as const,
      revision: result.revision,
      code: result.code,
      message: result.message,
      issues: result.issues,
      operationIndex: result.operationIndex,
    }
    const targetedVariantIds = [...new Set(result.normalizedOperations.map((operation) => operation.variantId))]
    const diagnostics = diagnosticsDelta(state.project, result.project, targetedVariantIds)
    const candidate: PreviewCandidate = {
      project: result.project,
      changedIds: result.changedIds,
      warnings: result.warnings,
      diagnostics,
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
      diagnostics,
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
      diagnostics: structuredClone(preview.preview.candidate.diagnostics),
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
    runSimulation(input: WorkspaceSimulationRequest): unknown | FacadeError {
      if (dependencies.runSimulation) return dependencies.runSimulation({ ...input, outputMode: input.outputMode ?? 'full' })
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
