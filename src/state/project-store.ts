import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { CommandResult } from '../core/commands/execute-layout-command'
import { executeLayoutCommand } from '../core/commands/execute-layout-command'
import { createWorkspaceFacade, type WorkspaceFacade } from '../core/workspace/workspace-facade'
import type {
  DisplayUnit,
  EquipmentItem,
  KitchenProject,
  LayoutVariant,
  PointMm,
  SimulationScenario,
} from '../domain/project'
import { createCatalogEquipmentItem, getCatalogEntry } from '../domain/catalog/kitchen-catalog'
import { applyEquipmentConfiguration as configureEquipmentItem } from '../domain/equipment-configurations'
import { projectSchema } from '../domain/project-schema'
import { createSeedProject } from '../domain/seed-project'
import { kitchenSpatialAdapter } from '../domain/spatial-adapter'
import { appendHistory } from './history'
import { loadProject, saveProject } from './persistence'

type CustomItemInput = {
  label: string
  widthMm: number
  depthMm: number
  heightMm?: number
}

type ResizeInput = Pick<EquipmentItem, 'widthMm' | 'depthMm'>

export interface ProjectState {
  project: KitchenProject
  documentId: string
  revision: number
  selectedIds: string[]
  past: KitchenProject[]
  future: KitchenProject[]
  executeCommand(command: unknown, options?: { dryRun?: boolean; expectedRevision?: number }): CommandResult<KitchenProject>
  applyWorkspaceOperations(operations: readonly unknown[], intent?: string): ReturnType<WorkspaceFacade['applyOperations']>
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
  activateVariant(id: string): void
  renameVariant(id: string, name: string): void
  deleteVariant(id: string): void
  updateScenario(id: string, patch: Partial<SimulationScenario>): void
  commitProjectCandidate(project: unknown, expectedRevision: number, expectedDocumentId: string): ProjectCommitResult
  replaceProject(project: KitchenProject): void
  undo(): void
  redo(): void
}

export type ProjectStore = StoreApi<ProjectState>

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
  const store = createStore<ProjectState>()((set, get) => {
    const dispatch = (command: unknown, options: { dryRun?: boolean; expectedRevision?: number } = {}) => {
      const state = get()
      const result = executeLayoutCommand({
        envelope: { project: state.project, revision: state.revision },
        adapter: kitchenSpatialAdapter,
        command,
        ...options,
      })
      if (result.ok && !result.dryRun) {
        set({
          project: result.project,
          revision: result.revision,
          past: appendHistory(state.past, state.project),
          future: [],
        })
      }
      return result
    }

    const applyOperations = (operations: readonly unknown[], intent: string) => workspaceFacade.current!.applyOperations(operations, intent)
    const activeVariantId = () => get().project.activeVariantId

    return {
      project: structuredClone(initialProject),
      documentId: makeId('document'),
      revision: 0,
      selectedIds: [],
      past: [],
      future: [],
      executeCommand: dispatch,
      applyWorkspaceOperations: (operations, intent) => applyOperations(operations, intent ?? 'Update workspace'),
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
      updateItem: (id, patch) => {
        const current = getActiveItem(get(), id)
        const operations: unknown[] = []
        if (patch.widthMm !== undefined || patch.depthMm !== undefined) operations.push({
          type: 'resize_component', variantId: activeVariantId(), componentId: id,
          dimensions: { widthMm: patch.widthMm ?? current.widthMm, depthMm: patch.depthMm ?? current.depthMm, ...(patch.heightMm !== undefined ? { heightMm: patch.heightMm } : {}) },
        })
        if (patch.rotationDeg !== undefined && patch.rotationDeg !== current.rotationDeg) operations.push({ type: 'rotate_components', variantId: activeVariantId(), componentIds: [id], deltaDeg: patch.rotationDeg - current.rotationDeg })
        const componentPatch = Object.fromEntries(Object.entries(patch).filter(([key, value]) => value !== undefined && ['label', 'category', 'heightMm', 'capabilities', 'clearance', 'approximate', 'notes'].includes(key)))
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
      commitProjectCandidate: (project, expectedRevision, expectedDocumentId) => {
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
          selectedIds: state.selectedIds.filter((id) => parsed.data.variants.some((variant) => variant.equipment.some((item) => item.id === id))),
        })
        return { ok: true, revision: state.revision + 1 }
      },
      replaceProject: (project) => set({ project: structuredClone(project), documentId: makeId('document'), revision: 0, selectedIds: [], past: [], future: [] }),
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
    resolveCatalogComponent: (operation) => createCatalogEquipmentItem({
      catalogId: operation.catalogId,
      componentId: operation.componentId,
      position: operation.position,
      ...(operation.dimensions ? { dimensions: operation.dimensions } : {}),
      ...(operation.rotationDeg === undefined ? {} : { rotationDeg: operation.rotationDeg }),
      ...(operation.configurationId ? { configurationId: operation.configurationId } : {}),
      ...(operation.skinId ? { skinId: operation.skinId } : {}),
    }),
  })
  return store
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
