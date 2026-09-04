import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createWorkspaceFacade, type WorkspaceFacade } from '../core/workspace/workspace-facade'
import { analyzeLayout } from '../domain/layout-diagnostics'
import { parkOutside } from '../features/editor/auto-fix'
import type {
  Architecture,
  DisplayUnit,
  EquipmentItem,
  KitchenProject,
  LayoutVariant,
  PointMm,
  SimulationScenario,
} from '../domain/project'
import { createCatalogEquipmentItem, filterCatalog, getCatalogEntry, searchCatalog } from '../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../domain/catalog/suggest-placement'
import { applyEquipmentConfiguration as configureEquipmentItem } from '../domain/equipment-configurations'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { projectSchema } from '../domain/project-schema'
import { createCheckpoint, restoreCheckpointOnto } from '../domain/layout-checkpoints'
import { createSeedProject } from '../domain/seed-project'
import { orderEquipmentForPlan, reorderEquipmentForPlan, type PlanLayerAction } from '../domain/plan-layer-order'
import { appendHistory } from './history'
import { loadProject, saveProject } from './persistence'
import { runSimulation } from '../simulation/engine'

type CustomItemInput = {
  label: string
  widthMm: number
  depthMm: number
  heightMm?: number
}

type ResizeInput = Pick<EquipmentItem, 'widthMm' | 'depthMm'>

type AdoptAutoLayoutCandidateInput = {
  expectedDocumentId: string
  expectedRevision: number
  runId: string
  resultId: string
  baselineVariantId: string
  newVariantId: string
  name: string
  candidate: LayoutVariant
}

type AdoptAutoLayoutCandidateResult = ReturnType<WorkspaceFacade['applyOperations']> |
  { ok: false; revision: number; code: 'result-consumed' | 'stale-revision' | 'wrong-document'; message: string }

export interface ProjectState {
  project: KitchenProject
  documentId: string
  revision: number
  selectedIds: string[]
  past: KitchenProject[]
  future: KitchenProject[]
  revisionEntries: RevisionEntry[]
  applyWorkspaceOperations(operations: readonly unknown[], intent?: string): ReturnType<WorkspaceFacade['applyOperations']>
  adoptAutoLayoutCandidate(input: AdoptAutoLayoutCandidateInput): AdoptAutoLayoutCandidateResult
  selectItems(ids: string[]): void
  toggleItemSelection(id: string): void
  clearSelection(): void
  moveItems(ids: string[], point: PointMm): void
  nudgeItems(ids: string[], delta: PointMm): void
  rotateItems(ids: string[], deltaDeg?: number): void
  resizeItem(id: string, size: ResizeInput): void
  setDimensionsLocked(id: string, locked: boolean): void
  setComponentLocked(id: string, locked: boolean): void
  setAppearanceSkin(id: string, skinId: string): void
  reorderItem(id: string, action: PlanLayerAction): boolean
  updateItem(id: string, patch: Partial<EquipmentItem>): void
  applyEquipmentConfiguration(id: string, configurationId: string): boolean
  addCustomItem(input: CustomItemInput): string
  addCatalogItem(catalogId: string, position: { xMm: number; yMm: number }): string | null
  duplicateItem(id: string): string
  removeItems(ids: string[]): void
  setDisplayUnit(unit: DisplayUnit): void
  setSnapMm(intervalMm: number): void
  setArchitectureLocked(locked: boolean): void
  createVariant(name: string): string
  createEmptyVariant(name: string): string
  activateVariant(id: string): void
  renameVariant(id: string, name: string): void
  deleteVariant(id: string): void
  updateScenario(id: string, patch: Partial<SimulationScenario>): void
  commitProjectCandidate(project: unknown, expectedRevision: number, expectedDocumentId: string, entry?: Omit<RevisionEntry, 'revision'>): ProjectCommitResult
  replaceProject(project: KitchenProject): void
  patchProject(mutator: (project: KitchenProject) => void): ProjectCommitResult
  renameProject(name: string): void
  addNamedCheckpoint(label: string, variantId?: string): string | null
  checkpointAllLayouts(label: string): void
  restoreCheckpoint(checkpointId: string): boolean
  applySharedArchitecture(architecture: Architecture): ReturnType<WorkspaceFacade['applyOperations']>
  applyEquipmentMoves(moves: { id: string; xMm: number; yMm: number }[]): boolean
  captureWorkingSnapshot(): void
  resetToWorkingSnapshot(): { restored: boolean; parked: number }
  undo(): void
  redo(): void
}

const facadeByStore = new WeakMap<ProjectStore, WorkspaceFacade>()
const autoLayoutServiceByStore = new WeakMap<ProjectStore, { run(input: unknown): unknown; cancel(input: { runId: string }): unknown }>()

export type ProjectStore = StoreApi<ProjectState>

export type RevisionEntry = {
  revision: number
  intent: string
  author: 'agent' | 'human'
  variantIds: string[]
  changedIds: string[]
}

export type ProjectCommitResult =
  | { ok: true; revision: number }
  | { ok: false; revision: number; code: 'stale-revision' | 'wrong-document' | 'invalid-project'; message: string; issues?: unknown }

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export function getActiveVariant(state: ProjectState): LayoutVariant {
  const variant = state.project.variants.find((value) => value.id === state.project.activeVariantId)
  if (!variant) throw new Error(`Missing active variant: ${state.project.activeVariantId}`)
  return variant
}

export function getVariantItem(state: ProjectState, variantId: string, itemId: string): EquipmentItem {
  const variant = state.project.variants.find((value) => value.id === variantId)
  const item = variant?.equipment.find((value) => value.id === itemId)
  if (!item) throw new Error(`Missing equipment item: ${variantId}/${itemId}`)
  return item
}

export function getActiveItem(state: ProjectState, itemId: string): EquipmentItem {
  return getVariantItem(state, state.project.activeVariantId, itemId)
}

export function createProjectStore(initialProject: KitchenProject): ProjectStore {
  const workspaceFacade: { current?: WorkspaceFacade } = {}
  const adoptedCandidates = new Map<string, LayoutVariant>()
  const consumedAdoptedCandidates = new Set<string>()
  const adoptedCandidateKey = (runId: string, resultId: string) => `${runId}\u0000${resultId}`
  const store = createStore<ProjectState>()((set, get) => {
    const applyOperations = (operations: readonly unknown[], intent: string) => workspaceFacade.current!.applyOperations(operations, intent)
    const activeVariantId = () => get().project.activeVariantId

    return {
      project: structuredClone(initialProject),
      documentId: makeId('document'),
      revision: 0,
      selectedIds: [],
      past: [],
      future: [],
      revisionEntries: [],
      applyWorkspaceOperations: (operations, intent) => applyOperations(operations, intent ?? 'Update workspace'),
      adoptAutoLayoutCandidate: (input) => {
        const snapshot = get()
        if (snapshot.documentId !== input.expectedDocumentId) return {
          ok: false, revision: snapshot.revision, code: 'wrong-document',
          message: 'This result belongs to a project document that is no longer open.',
        }
        if (snapshot.revision !== input.expectedRevision) return {
          ok: false, revision: snapshot.revision, code: 'stale-revision',
          message: `This result was created at revision ${input.expectedRevision}; the workspace is now at revision ${snapshot.revision}. Run auto-layout again.`,
        }
        const key = adoptedCandidateKey(input.runId, input.resultId)
        if (consumedAdoptedCandidates.has(key)) return {
          ok: false,
          revision: get().revision,
          code: 'result-consumed',
          message: 'This auto-layout result has already been adopted.',
        }
        adoptedCandidates.set(key, structuredClone(input.candidate))
        try {
          const result = applyOperations([{
            type: 'adopt_auto_layout_result',
            variantId: input.baselineVariantId,
            runId: input.runId,
            resultId: input.resultId,
            newVariantId: input.newVariantId,
            name: input.name,
          }], 'Adopt auto-layout finalist')
          if (result.ok) consumedAdoptedCandidates.add(key)
          return result
        } finally {
          adoptedCandidates.delete(key)
        }
      },
      selectItems: (ids) => set({ selectedIds: [...new Set(ids)] }),
      toggleItemSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selected) => selected !== id)
          : [...state.selectedIds, id],
      })),
      clearSelection: () => set({ selectedIds: [] }),
      moveItems: (ids, point) => { if (ids.length) applyOperations([{ type: 'move_components', variantId: activeVariantId(), componentIds: ids, anchor: { xMm: point.x, yMm: point.y } }], 'Move components') },
      nudgeItems: (ids, delta) => { if (ids.length) applyOperations([{ type: 'nudge_components', variantId: activeVariantId(), componentIds: ids, delta: { xMm: delta.x, yMm: delta.y } }], 'Nudge components') },
      rotateItems: (ids, deltaDeg = 90) => { if (ids.length) applyOperations([{ type: 'rotate_components', variantId: activeVariantId(), componentIds: ids, deltaDeg }], 'Rotate components') },
      resizeItem: (id, size) => { applyOperations([{ type: 'resize_component', variantId: activeVariantId(), componentId: id, dimensions: size }], 'Resize component') },
      setDimensionsLocked: (id, locked) => { applyOperations([{ type: 'set_component_dimensions_lock', variantId: activeVariantId(), componentId: id, locked }], 'Set component dimension lock') },
      setComponentLocked: (id, locked) => { applyOperations([{ type: 'lock_components', variantId: activeVariantId(), componentIds: [id], locked }], 'Set component lock') },
      setAppearanceSkin: (id, skinId) => { applyOperations([{ type: 'skin_component', variantId: activeVariantId(), componentId: id, skinId }], 'Set component appearance') },
      reorderItem: (id, action) => {
        const variant = getActiveVariant(get())
        const before = orderEquipmentForPlan(variant.equipment)
        const ordered = reorderEquipmentForPlan(variant.equipment, id, action)
        if (before.every((item, index) => item.id === ordered[index]?.id)) return false
        return applyOperations(ordered.map((item, index) => ({
          type: 'update_component',
          variantId: variant.id,
          componentId: item.id,
          patch: { planLayerOrder: index },
        })), `Move component ${action}`).ok
      },
      updateItem: (id, patch) => {
        const current = getActiveItem(get(), id)
        const operations: unknown[] = []
        if (patch.widthMm !== undefined || patch.depthMm !== undefined) operations.push({
          type: 'resize_component', variantId: activeVariantId(), componentId: id,
          dimensions: { widthMm: patch.widthMm ?? current.widthMm, depthMm: patch.depthMm ?? current.depthMm, ...(patch.heightMm !== undefined ? { heightMm: patch.heightMm } : {}) },
        })
        if (patch.rotationDeg !== undefined && patch.rotationDeg !== current.rotationDeg) operations.push({ type: 'rotate_components', variantId: activeVariantId(), componentIds: [id], deltaDeg: patch.rotationDeg - current.rotationDeg })
        const componentPatch = Object.fromEntries(Object.entries(patch).filter(([key, value]) => value !== undefined && ['label', 'xMm', 'yMm', 'category', 'heightMm', 'capabilities', 'clearance', 'accessFlow', 'approximate', 'notes', 'planLayerOrder', 'baseElevationMm', 'shelfElevationsMm'].includes(key)))
        if (Object.keys(componentPatch).length) operations.push({ type: 'update_component', variantId: activeVariantId(), componentId: id, patch: componentPatch })
        if (operations.length) applyOperations(operations, 'Update component')
      },
      applyEquipmentConfiguration: (id, configurationId) => {
        let configured: EquipmentItem
        try {
          configured = configureEquipmentItem(getActiveItem(get(), id), configurationId)
        } catch {
          return false
        }
        void configured
        return applyOperations([{ type: 'configure_component', variantId: activeVariantId(), componentId: id, configurationId }], 'Configure component').ok
      },
      addCustomItem: (input) => {
        const id = makeId('custom')
        const result = applyOperations([{ type: 'add_custom_component', variantId: activeVariantId(), componentId: id, label: input.label.trim() || 'Custom item', position: { xMm: 1500, yMm: 3500 }, dimensions: { widthMm: Math.max(100, input.widthMm), depthMm: Math.max(100, input.depthMm), heightMm: Math.max(100, input.heightMm ?? 850) } }], 'Add custom component')
        if (result.ok) set({ selectedIds: [id] })
        return id
      },
      addCatalogItem: (catalogId, position) => {
        const entry = getCatalogEntry(catalogId)
        if (!entry) return null
        const id = makeId(entry.catalogId)
        if (entry.category === 'architecture') {
          const variant = getActiveVariant(get())
          const architecture = variant.architecture
          if (catalogId === 'architecture-no-go-zone') return null
          let patch: Record<string, unknown> | undefined
          if (entry.tags.includes('opening')) {
            const segments = architecture.roomPolygon.map((start, segmentIndex) => {
              const end = architecture.roomPolygon[(segmentIndex + 1) % architecture.roomPolygon.length]
              const dx = end.x - start.x; const dy = end.y - start.y
              const lengthSquared = dx * dx + dy * dy || 1
              const fraction = Math.max(0, Math.min(1, ((position.xMm - start.x) * dx + (position.yMm - start.y) * dy) / lengthSquared))
              const projected = { x: start.x + dx * fraction, y: start.y + dy * fraction }
              return { segmentIndex, start, end, length: Math.sqrt(lengthSquared), fraction, distance: Math.hypot(projected.x - position.xMm, projected.y - position.yMm) }
            }).sort((left, right) => left.distance - right.distance || left.segmentIndex - right.segmentIndex)
            const target = segments[0]
            const widthMm = Math.min(entry.typicalDimensions.widthMm, target.length)
            const offsetMm = Math.max(0, Math.min(target.length - widthMm, target.fraction * target.length - widthMm / 2))
            const midpoint = { x: (target.start.x + target.end.x) / 2, y: (target.start.y + target.end.y) / 2 }
            const edgeDistances = [
              { wall: 'top' as const, value: midpoint.y }, { wall: 'right' as const, value: architecture.widthMm - midpoint.x },
              { wall: 'bottom' as const, value: architecture.depthMm - midpoint.y }, { wall: 'left' as const, value: midpoint.x },
            ].sort((left, right) => left.value - right.value)
            const serviceWindow = catalogId === 'architecture-service-window' || catalogId === 'architecture-dirty-window' || catalogId === 'architecture-pass-hatch'
            const regularWindow = catalogId === 'architecture-window'
            patch = { openings: [...architecture.openings, {
              id, label: entry.displayName, kind: serviceWindow ? 'service-window' : regularWindow ? 'window' : 'door', wall: edgeDistances[0].wall,
              segmentIndex: target.segmentIndex, offsetMm, widthMm,
              ...(serviceWindow
                ? { sillHeightMm: 900, heightMm: 900, flow: catalogId === 'architecture-dirty-window' ? 'dirty-in' as const : 'clean-out' as const }
                : regularWindow
                  ? { sillHeightMm: 1_000, heightMm: entry.typicalDimensions.heightMm, flow: 'closed' as const }
                  : { flow: 'entry' as const, doorType: 'hinged' as const, swingDepthMm: widthMm, swingHinge: 'start' as const, swingDirection: 'inward' as const }),
            }] }
          } else if (catalogId === 'architecture-pillar' || catalogId === 'architecture-partition') {
            patch = { pillars: [...architecture.pillars, { id, xMm: position.xMm, yMm: position.yMm, widthMm: entry.typicalDimensions.widthMm, depthMm: entry.typicalDimensions.depthMm }] }
          } else if (catalogId === 'architecture-service-zone') {
            patch = { storageZones: [...architecture.storageZones, { id, label: entry.displayName, xMm: position.xMm, yMm: position.yMm, widthMm: entry.typicalDimensions.widthMm, depthMm: entry.typicalDimensions.depthMm, adjacent: false }] }
          }
          if (!patch) return null
          const operations = get().project.variants.map((target) => ({ type: 'update_architecture' as const, variantId: target.id, patch: { ...patch, locked: false } }))
          const result = applyOperations(operations, 'Add architectural component')
          if (result.ok) set({ selectedIds: [] })
          return result.ok ? id : null
        }
        const configurationId = entry.configurationIds[0]
        const skinId = entry.appearanceSkinIds[0]
        const result = applyOperations([{
          type: 'add_component',
          variantId: activeVariantId(),
          componentId: id,
          catalogId,
          position,
          ...(configurationId ? { configurationId } : {}),
          ...(skinId ? { skinId } : {}),
        }], 'Add catalog component')
        if (!result.ok) return null
        set({ selectedIds: [id] })
        return id
      },
      duplicateItem: (id) => {
        const source = getActiveItem(get(), id)
        const duplicateId = makeId(source.category)
        const result = applyOperations([{ type: 'duplicate_components', variantId: activeVariantId(), components: [{ componentId: id, duplicateId }] }], 'Duplicate component')
        if (result.ok) {
          set({ selectedIds: [duplicateId] })
        }
        return duplicateId
      },
      removeItems: (ids) => {
        const result = ids.length ? applyOperations([{ type: 'remove_components', variantId: activeVariantId(), componentIds: ids }], 'Remove components') : null
        if (result?.ok) set((state) => ({ selectedIds: state.selectedIds.filter((id) => !ids.includes(id)) }))
      },
      setDisplayUnit: (unit) => { applyOperations([{ type: 'update_workspace_settings', variantId: activeVariantId(), patch: { displayUnit: unit } }], 'Set display unit') },
      setSnapMm: (intervalMm) => { applyOperations([{ type: 'update_workspace_settings', variantId: activeVariantId(), patch: { snapMm: intervalMm } }], 'Set snap interval') },
      setArchitectureLocked: (locked) => { applyOperations([{ type: 'update_architecture', variantId: activeVariantId(), patch: { locked } }], 'Set architecture lock') },
      createVariant: (name) => {
        const id = makeId('variant')
        applyOperations([{ type: 'create_layout', variantId: id, parentVariantId: activeVariantId(), name: name.trim() || 'Untitled layout', equipmentMode: 'duplicate' }], 'Create layout')
        return id
      },
      createEmptyVariant: (name) => {
        const id = makeId('variant')
        applyOperations([{ type: 'create_layout', variantId: id, parentVariantId: activeVariantId(), name: name.trim() || 'Empty layout', equipmentMode: 'empty' }], 'Create empty layout')
        return id
      },
      activateVariant: (id) => {
        const result = applyOperations([{ type: 'activate_layout', variantId: id }], 'Activate layout')
        if (result.ok) set({ selectedIds: [] })
      },
      renameVariant: (id, name) => { applyOperations([{ type: 'rename_layout', variantId: id, name: name.trim() || get().project.variants.find((variant) => variant.id === id)?.name || 'Untitled layout' }], 'Rename layout') },
      deleteVariant: (id) => {
        const result = applyOperations([{ type: 'remove_layout', variantId: id }], 'Remove layout')
        if (result.ok) set({ selectedIds: [] })
      },
      updateScenario: (id, patch) => {
        const { id: _ignoredId, ...scenarioPatch } = patch as Partial<SimulationScenario> & { id?: string }
        void _ignoredId
        applyOperations([{ type: 'update_scenario', variantId: activeVariantId(), scenarioId: id, patch: scenarioPatch }], 'Update scenario')
      },
      commitProjectCandidate: (project, expectedRevision, expectedDocumentId, entry) => {
        const state = get()
        if (state.documentId !== expectedDocumentId) return { ok: false, revision: state.revision, code: 'wrong-document', message: 'The open project was replaced after this candidate was prepared.' }
        if (state.revision !== expectedRevision) return { ok: false, revision: state.revision, code: 'stale-revision', message: `Expected revision ${expectedRevision}, received ${state.revision}.` }
        const parsed = projectSchema.safeParse(project)
        if (!parsed.success) return { ok: false, revision: state.revision, code: 'invalid-project', message: 'Project candidate is invalid.', issues: parsed.error.issues }
        set({
          project: structuredClone(parsed.data),
          revision: state.revision + 1,
          past: appendHistory(state.past, state.project),
          future: [],
          revisionEntries: entry ? appendHistory(state.revisionEntries, { ...entry, revision: state.revision + 1 }) : state.revisionEntries,
          selectedIds: state.selectedIds.filter((id) => parsed.data.variants.some((variant) => variant.equipment.some((item) => item.id === id))),
        })
        return { ok: true, revision: state.revision + 1 }
      },
      replaceProject: (project) => set({ project: structuredClone(project), documentId: makeId('document'), revision: 0, selectedIds: [], past: [], future: [], revisionEntries: [] }),
      patchProject: (mutator) => {
        const snapshot = get()
        const project = structuredClone(snapshot.project)
        mutator(project)
        return get().commitProjectCandidate(project, snapshot.revision, snapshot.documentId)
      },
      renameProject: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        get().patchProject((project) => { project.name = trimmed })
      },
      addNamedCheckpoint: (label, variantId) => {
        const snapshot = get()
        const variant = snapshot.project.variants.find((candidate) => candidate.id === (variantId ?? snapshot.project.activeVariantId)) ?? getActiveVariant(snapshot)
        const checkpoint = createCheckpoint(variant, snapshot.revision, label.trim() || `Rev ${snapshot.revision}`)
        const result = get().patchProject((project) => {
          const target = project.variants.find((candidate) => candidate.id === variant.id)
          if (target) target.checkpoints = [...(target.checkpoints ?? []), checkpoint]
        })
        return result.ok ? checkpoint.id : null
      },
      checkpointAllLayouts: (label) => {
        const snapshot = get()
        const trimmed = label.trim() || `Rev ${snapshot.revision}`
        get().patchProject((project) => {
          project.variants.forEach((variant) => {
            variant.checkpoints = [...(variant.checkpoints ?? []), createCheckpoint(variant, snapshot.revision, trimmed)]
          })
        })
      },
      restoreCheckpoint: (checkpointId) => {
        const snapshot = get()
        const variant = getActiveVariant(snapshot)
        const checkpoint = variant.checkpoints?.find((entry) => entry.id === checkpointId)
        if (!checkpoint) return false
        const restored = restoreCheckpointOnto(variant, checkpoint)
        const current = createCheckpoint(variant, snapshot.revision, 'Current before restore')
        const result = get().patchProject((project) => {
          const target = project.variants.find((candidate) => candidate.id === variant.id)
          if (!target) return
          target.architecture = restored.architecture
          target.equipment = restored.equipment
          target.updatedAt = restored.updatedAt
          target.checkpoints = [...(target.checkpoints ?? []), current]
          if (project.activeVariantId === target.id) project.architecture = structuredClone(restored.architecture)
        })
        return result.ok
      },
      captureWorkingSnapshot: () => {
        const variant = getActiveVariant(get())
        const clean = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints }).length === 0
        if (!clean) return
        set((state) => ({
          project: {
            ...state.project,
            lastWorking: {
              architecture: structuredClone(state.project.architecture),
              equipmentByVariant: Object.fromEntries(state.project.variants.map((entry) => [entry.id, structuredClone(entry.equipment)])),
            },
          },
        }))
      },
      resetToWorkingSnapshot: () => {
        const project = get().project
        const snapshot = project.lastWorking
        if (!snapshot) return { restored: false, parked: 0 }
        const activeId = project.activeVariantId
        const current = getActiveVariant(get())
        const snapshotIds = new Set(snapshot.equipmentByVariant[activeId]?.map((item) => item.id) ?? [])
        const newcomers = current.equipment.filter((item) => !snapshotIds.has(item.id))
        const parkedMoves = parkOutside(snapshot.architecture, newcomers, snapshot.equipmentByVariant[activeId] ?? [], project.snapMm)
        const operations = project.variants.flatMap((variant) => [
          { type: 'update_architecture' as const, variantId: variant.id, patch: {
            widthMm: snapshot.architecture.widthMm,
            depthMm: snapshot.architecture.depthMm,
            wallHeightMm: snapshot.architecture.wallHeightMm,
            roomPolygon: snapshot.architecture.roomPolygon,
            openings: snapshot.architecture.openings,
            pillars: snapshot.architecture.pillars,
            storageZones: snapshot.architecture.storageZones,
            locked: false,
          } },
        ])
        const equipmentOps = [
          ...(snapshot.equipmentByVariant[activeId] ?? []).map((item) => ({ type: 'update_component' as const, variantId: activeId, componentId: item.id, patch: { xMm: item.xMm, yMm: item.yMm } })),
          ...parkedMoves.map((move) => ({ type: 'update_component' as const, variantId: activeId, componentId: move.id, patch: { xMm: move.xMm, yMm: move.yMm } })),
        ].filter((op) => current.equipment.some((item) => item.id === op.componentId))
        const result = applyOperations([...operations, ...equipmentOps], 'Reset to last working version')
        return { restored: result.ok, parked: parkedMoves.length }
      },
      applyEquipmentMoves: (moves) => {
        if (moves.length === 0) return true
        const variant = getActiveVariant(get())
        const operations = moves
          .filter((move) => variant.equipment.some((item) => item.id === move.id && !variant.layoutConstraints?.lockedComponentIds?.includes(move.id)))
          .map((move) => ({ type: 'update_component' as const, variantId: activeVariantId(), componentId: move.id, patch: { xMm: move.xMm, yMm: move.yMm } }))
        if (operations.length === 0) return false
        const result = applyOperations(operations, 'Auto-fix equipment positions')
        return result.ok
      },
      applySharedArchitecture: (architecture) => {
        const operations = get().project.variants.flatMap((variant) => [
          { type: 'update_architecture' as const, variantId: variant.id, patch: { locked: false } },
          {
            type: 'update_architecture' as const,
            variantId: variant.id,
            patch: {
              widthMm: architecture.widthMm,
              depthMm: architecture.depthMm,
              wallHeightMm: architecture.wallHeightMm,
              roomPolygon: architecture.roomPolygon.map((point) => ({ xMm: point.x, yMm: point.y })),
              openings: architecture.openings,
              pillars: architecture.pillars,
              storageZones: architecture.storageZones,
            },
          },
        ])
        return applyOperations(operations, 'Update shared space')
      },
      undo: () => set((state) => {
        const previous = state.past.at(-1)
        if (!previous) return state
        return { project: previous, revision: state.revision + 1, past: state.past.slice(0, -1), future: [state.project, ...state.future] }
      }),
      redo: () => set((state) => {
        const next = state.future[0]
        if (!next) return state
        return { project: next, revision: state.revision + 1, past: appendHistory(state.past, state.project), future: state.future.slice(1) }
      }),
    }
  })
  workspaceFacade.current = createWorkspaceFacade({
    store,
    listCatalog: (filters) => {
      const input = (filters ?? {}) as { query?: string; category?: Parameters<typeof filterCatalog>[1]['category']; capability?: string }
      return [...filterCatalog(searchCatalog(input.query ?? ''), { ...(input.category ? { category: input.category } : {}), ...(input.capability ? { capability: input.capability } : {}) })]
    },
    getRequirements: ({ variantId, scenarioId }) => {
      const project = store.getState().project
      const variant = project.variants.find((candidate) => candidate.id === variantId)
      const scenario = project.scenarios.find((candidate) => candidate.id === (scenarioId ?? project.activeScenarioId))
      if (!variant || !scenario) return []
      return evaluateOperationalRequirements({ architecture: variant.architecture, equipment: variant.equipment, scenario, layoutConstraints: variant.layoutConstraints })
    },
    suggestPlacement: ({ variantId, catalogId, preferredPoint }) => {
      const project = store.getState().project
      const variant = project.variants.find((candidate) => candidate.id === variantId)
      const entry = getCatalogEntry(catalogId)
      if (!variant || !entry) return null
      return suggestCatalogPlacement({ architecture: variant.architecture, equipment: variant.equipment, entry, snapMm: project.snapMm, layoutConstraints: variant.layoutConstraints, ...(preferredPoint ? { preferredPoint } : {}) })
    },
    runSimulation: ({ variantId, scenarioId, seed, outputMode }) => {
      const project = store.getState().project
      const variant = project.variants.find((candidate) => candidate.id === variantId)
      const scenario = project.scenarios.find((candidate) => candidate.id === scenarioId)
      if (!variant || !scenario) throw new Error('Unknown simulation layout or scenario.')
      return runSimulation({ architecture: variant.architecture, equipment: variant.equipment, layoutConstraints: variant.layoutConstraints, scenario: { ...scenario, seed }, outputMode })
    },
    runAutoLayout: (input) => autoLayoutServiceByStore.get(store)?.run(input) ?? { ok: false, revision: store.getState().revision, code: 'auto-layout-not-configured', message: 'Auto-layout service is not configured.' },
    cancelRun: (input) => autoLayoutServiceByStore.get(store)?.cancel(input) ?? { ok: false, revision: store.getState().revision, code: 'run-not-found', message: `Run ${input.runId} is not active.` },
    resolveCatalogComponent: (operation) => createCatalogEquipmentItem({
      catalogId: operation.catalogId,
      componentId: operation.componentId,
      position: operation.position,
      ...(operation.dimensions ? { dimensions: operation.dimensions } : {}),
      ...(operation.rotationDeg === undefined ? {} : { rotationDeg: operation.rotationDeg }),
      ...(operation.configurationId ? { configurationId: operation.configurationId } : {}),
      ...(operation.skinId ? { skinId: operation.skinId } : {}),
    }),
    resolveAdoptedVariant: (operation) => {
      const candidate = adoptedCandidates.get(adoptedCandidateKey(operation.runId, operation.resultId))
      if (!candidate) throw new Error('The auto-layout result is unavailable or has already been adopted.')
      return structuredClone(candidate)
    },
  })
  facadeByStore.set(store, workspaceFacade.current)
  return store
}

export function getWorkspaceFacade(store: ProjectStore = projectStore): WorkspaceFacade {
  const facade = facadeByStore.get(store)
  if (!facade) throw new Error('Workspace facade is unavailable for this store.')
  return facade
}

export function configureWorkspaceAutoLayout(
  store: ProjectStore,
  service: { run(input: unknown): unknown; cancel(input: { runId: string }): unknown },
): void {
  autoLayoutServiceByStore.set(store, service)
}

const isStorage = (value: unknown): value is Storage => {
  const candidate = value as Partial<Storage> | null | undefined
  return typeof candidate?.getItem === 'function' && typeof candidate?.setItem === 'function'
}

const browserStorage = typeof window !== 'undefined' && isStorage(window.localStorage) ? window.localStorage : null
const initialProject = browserStorage ? loadProject(browserStorage) : createSeedProject()
export const projectStore = createProjectStore(initialProject)

let autosaveTimer: ReturnType<typeof setTimeout> | undefined
if (browserStorage) {
  projectStore.subscribe((state, previous) => {
    if (state.project === previous.project) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveProject(browserStorage, state.project), 250)
  })
}

export function flushAutosave(): void {
  if (!browserStorage) return
  clearTimeout(autosaveTimer)
  saveProject(browserStorage, projectStore.getState().project)
}

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector)
}
