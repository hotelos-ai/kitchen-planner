import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { CommandResult } from '../core/commands/execute-layout-command'
import { executeLayoutCommand } from '../core/commands/execute-layout-command'
import type {
  DisplayUnit,
  EquipmentItem,
  KitchenProject,
  LayoutVariant,
  PointMm,
  SimulationScenario,
} from '../domain/project'
import { applyEquipmentConfiguration as configureEquipmentItem } from '../domain/equipment-configurations'
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
  revision: number
  selectedIds: string[]
  past: KitchenProject[]
  future: KitchenProject[]
  executeCommand(command: unknown, options?: { dryRun?: boolean; expectedRevision?: number }): CommandResult<KitchenProject>
  selectItems(ids: string[]): void
  toggleItemSelection(id: string): void
  clearSelection(): void
  moveItems(ids: string[], point: PointMm): void
  nudgeItems(ids: string[], delta: PointMm): void
  rotateItems(ids: string[], deltaDeg?: number): void
  resizeItem(id: string, size: ResizeInput): void
  setDimensionsLocked(id: string, locked: boolean): void
  updateItem(id: string, patch: Partial<EquipmentItem>): void
  applyEquipmentConfiguration(id: string, configurationId: string): boolean
  addCustomItem(input: CustomItemInput): string
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
  replaceProject(project: KitchenProject): void
  undo(): void
  redo(): void
}

export type ProjectStore = StoreApi<ProjectState>

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
  return createStore<ProjectState>()((set, get) => {
    const commitProject = (mutation: (project: KitchenProject) => KitchenProject) => {
      set((state) => ({
        project: mutation(state.project),
        revision: state.revision + 1,
        past: appendHistory(state.past, state.project),
        future: [],
      }))
    }

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

    return {
      project: structuredClone(initialProject),
      revision: 0,
      selectedIds: [],
      past: [],
      future: [],
      executeCommand: dispatch,
      selectItems: (ids) => set({ selectedIds: [...new Set(ids)] }),
      toggleItemSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selected) => selected !== id)
          : [...state.selectedIds, id],
      })),
      clearSelection: () => set({ selectedIds: [] }),
      moveItems: (ids, point) => { if (ids.length) dispatch({ type: 'move-items', ids, anchor: point }) },
      nudgeItems: (ids, delta) => { if (ids.length) dispatch({ type: 'nudge-items', ids, delta }) },
      rotateItems: (ids, deltaDeg = 90) => { if (ids.length) dispatch({ type: 'rotate-items', ids, deltaDeg }) },
      resizeItem: (id, size) => { dispatch({ type: 'resize-item', id, ...size }) },
      setDimensionsLocked: (id, locked) => { dispatch({ type: 'set-dimensions-locked', id, locked }) },
      updateItem: (id, patch) => { dispatch({ type: 'update-item', id, patch }) },
      applyEquipmentConfiguration: (id, configurationId) => {
        let configured: EquipmentItem
        try {
          configured = configureEquipmentItem(getActiveItem(get(), id), configurationId)
        } catch {
          return false
        }
        return dispatch({ type: 'update-item', id, patch: configured }).ok
      },
      addCustomItem: (input) => {
        const id = makeId('custom')
        const item: EquipmentItem = {
          id,
          label: input.label.trim() || 'Custom item',
          category: 'custom',
          widthMm: Math.max(100, input.widthMm),
          depthMm: Math.max(100, input.depthMm),
          heightMm: Math.max(100, input.heightMm ?? 850),
          xMm: 1500,
          yMm: 3500,
          rotationDeg: 0,
          dimensionsLocked: false,
          movable: true,
          removable: true,
          capabilities: [],
        }
        const result = dispatch({ type: 'add-item', item })
        if (result.ok) set({ selectedIds: [id] })
        return id
      },
      duplicateItem: (id) => {
        const source = getActiveItem(get(), id)
        const duplicateId = makeId(source.category)
        const result = dispatch({ type: 'duplicate-item', id, duplicateId, patch: { approximate: false } })
        if (result.ok) {
          set({ selectedIds: [duplicateId] })
        }
        return duplicateId
      },
      removeItems: (ids) => {
        const result = ids.length ? dispatch({ type: 'remove-items', ids }) : null
        if (result?.ok) set((state) => ({ selectedIds: state.selectedIds.filter((id) => !ids.includes(id)) }))
      },
      setDisplayUnit: (unit) => { dispatch({ type: 'set-display-unit', unit }) },
      setSnapMm: (intervalMm) => { dispatch({ type: 'set-snap', intervalMm }) },
      setArchitectureLocked: (locked) => { dispatch({ type: 'set-architecture-lock', locked }) },
      createVariant: (name) => {
        const id = makeId('variant')
        const now = new Date().toISOString()
        dispatch({ type: 'create-variant', id, name: name.trim() || 'Untitled layout', now })
        return id
      },
      activateVariant: (id) => {
        const result = dispatch({ type: 'activate-variant', id })
        if (result.ok) set({ selectedIds: [] })
      },
      renameVariant: (id, name) => { dispatch({ type: 'rename-variant', id, name: name.trim() || get().project.variants.find((variant) => variant.id === id)?.name || 'Untitled layout' }) },
      deleteVariant: (id) => {
        const result = dispatch({ type: 'remove-variant', id })
        if (result.ok) set({ selectedIds: [] })
      },
      updateScenario: (id, patch) => commitProject((project) => ({
        ...project,
        scenarios: project.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch, id: scenario.id } : scenario),
      })),
      replaceProject: (project) => set({ project: structuredClone(project), revision: 0, selectedIds: [], past: [], future: [] }),
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
