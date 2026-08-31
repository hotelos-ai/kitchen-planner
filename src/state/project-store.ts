import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { normalizeRotation, snapMm } from '../domain/geometry'
import type {
  DisplayUnit,
  EquipmentItem,
  KitchenProject,
  LayoutVariant,
  PointMm,
  SimulationScenario,
} from '../domain/project'
import { createSeedProject } from '../domain/seed-project'
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
  selectedIds: string[]
  past: KitchenProject[]
  future: KitchenProject[]
  selectItems(ids: string[]): void
  toggleItemSelection(id: string): void
  clearSelection(): void
  moveItems(ids: string[], point: PointMm): void
  nudgeItems(ids: string[], delta: PointMm): void
  rotateItems(ids: string[], deltaDeg?: number): void
  resizeItem(id: string, size: ResizeInput): void
  setDimensionsLocked(id: string, locked: boolean): void
  updateItem(id: string, patch: Partial<EquipmentItem>): void
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

const mutateActiveVariant = (
  project: KitchenProject,
  mutation: (variant: LayoutVariant) => void,
): KitchenProject => {
  const next = structuredClone(project)
  const active = next.variants.find((variant) => variant.id === next.activeVariantId)
  if (!active) throw new Error(`Missing active variant: ${next.activeVariantId}`)
  mutation(active)
  active.updatedAt = new Date().toISOString()
  return next
}

export function createProjectStore(initialProject: KitchenProject): ProjectStore {
  return createStore<ProjectState>()((set, get) => {
    const commitProject = (mutation: (project: KitchenProject) => KitchenProject) => {
      set((state) => ({
        project: mutation(state.project),
        past: appendHistory(state.past, state.project),
        future: [],
      }))
    }

    return {
      project: structuredClone(initialProject),
      selectedIds: [],
      past: [],
      future: [],
      selectItems: (ids) => set({ selectedIds: [...new Set(ids)] }),
      toggleItemSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selected) => selected !== id)
          : [...state.selectedIds, id],
      })),
      clearSelection: () => set({ selectedIds: [] }),
      moveItems: (ids, point) => {
        const uniqueIds = [...new Set(ids)]
        if (!uniqueIds.length) return
        const state = get()
        const anchor = getActiveItem(state, uniqueIds[0])
        const snapped = { x: snapMm(point.x, state.project.snapMm), y: snapMm(point.y, state.project.snapMm) }
        const delta = { x: snapped.x - anchor.xMm, y: snapped.y - anchor.yMm }
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((item) => uniqueIds.includes(item.id) && item.movable
            ? { ...item, xMm: snapMm(item.xMm + delta.x, project.snapMm), yMm: snapMm(item.yMm + delta.y, project.snapMm) }
            : item)
        }))
      },
      nudgeItems: (ids, delta) => {
        const uniqueIds = [...new Set(ids)]
        if (!uniqueIds.length) return
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((item) => uniqueIds.includes(item.id) && item.movable
            ? { ...item, xMm: item.xMm + delta.x, yMm: item.yMm + delta.y }
            : item)
        }))
      },
      rotateItems: (ids, deltaDeg = 90) => {
        const uniqueIds = [...new Set(ids)]
        if (!uniqueIds.length) return
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((item) => uniqueIds.includes(item.id) && item.movable
            ? { ...item, rotationDeg: normalizeRotation(item.rotationDeg + deltaDeg) }
            : item)
        }))
      },
      resizeItem: (id, size) => {
        const item = getActiveItem(get(), id)
        if (item.dimensionsLocked || size.widthMm <= 0 || size.depthMm <= 0) return
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((value) => value.id === id ? { ...value, ...size } : value)
        }))
      },
      setDimensionsLocked: (id, locked) => {
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((item) => item.id === id ? { ...item, dimensionsLocked: locked } : item)
        }))
      },
      updateItem: (id, patch) => {
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.map((item) => item.id === id ? { ...item, ...patch, id: item.id } : item)
        }))
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
        commitProject((project) => mutateActiveVariant(project, (variant) => { variant.equipment.push(item) }))
        set({ selectedIds: [id] })
        return id
      },
      duplicateItem: (id) => {
        const source = getActiveItem(get(), id)
        const duplicateId = makeId(source.category)
        const duplicate: EquipmentItem = {
          ...structuredClone(source),
          id: duplicateId,
          label: `${source.label} copy`,
          xMm: source.xMm + get().project.snapMm,
          yMm: source.yMm + get().project.snapMm,
          approximate: false,
        }
        commitProject((project) => mutateActiveVariant(project, (variant) => { variant.equipment.push(duplicate) }))
        set({ selectedIds: [duplicateId] })
        return duplicateId
      },
      removeItems: (ids) => {
        const uniqueIds = [...new Set(ids)]
        if (!uniqueIds.some((id) => getActiveItem(get(), id).removable)) return
        commitProject((project) => mutateActiveVariant(project, (variant) => {
          variant.equipment = variant.equipment.filter((item) => !uniqueIds.includes(item.id) || !item.removable)
        }))
        set((state) => ({ selectedIds: state.selectedIds.filter((id) => !uniqueIds.includes(id)) }))
      },
      setDisplayUnit: (unit) => commitProject((project) => ({ ...project, displayUnit: unit })),
      setSnapMm: (intervalMm) => {
        if (!Number.isFinite(intervalMm) || intervalMm <= 0) return
        commitProject((project) => ({ ...project, snapMm: intervalMm }))
      },
      setArchitectureLocked: (locked) => commitProject((project) => ({
        ...project,
        architecture: { ...project.architecture, locked },
      })),
      createVariant: (name) => {
        const state = get()
        const parent = getActiveVariant(state)
        const id = makeId('variant')
        const now = new Date().toISOString()
        const variant: LayoutVariant = {
          ...structuredClone(parent),
          id,
          name: name.trim() || 'Untitled layout',
          parentId: parent.id,
          createdAt: now,
          updatedAt: now,
        }
        commitProject((project) => ({ ...project, variants: [...project.variants, variant] }))
        return id
      },
      activateVariant: (id) => {
        if (!get().project.variants.some((variant) => variant.id === id)) return
        set((state) => ({ project: { ...state.project, activeVariantId: id }, selectedIds: [] }))
      },
      renameVariant: (id, name) => commitProject((project) => ({
        ...project,
        variants: project.variants.map((variant) => variant.id === id ? { ...variant, name: name.trim() || variant.name } : variant),
      })),
      deleteVariant: (id) => {
        const state = get()
        if (state.project.variants.length <= 1 || !state.project.variants.some((variant) => variant.id === id)) return
        commitProject((project) => {
          const variants = project.variants.filter((variant) => variant.id !== id)
          return { ...project, variants, activeVariantId: project.activeVariantId === id ? variants[0].id : project.activeVariantId }
        })
        set({ selectedIds: [] })
      },
      updateScenario: (id, patch) => commitProject((project) => ({
        ...project,
        scenarios: project.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch, id: scenario.id } : scenario),
      })),
      replaceProject: (project) => set({ project: structuredClone(project), selectedIds: [], past: [], future: [] }),
      undo: () => set((state) => {
        const previous = state.past.at(-1)
        if (!previous) return state
        return { project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future] }
      }),
      redo: () => set((state) => {
        const next = state.future[0]
        if (!next) return state
        return { project: next, past: appendHistory(state.past, state.project), future: state.future.slice(1) }
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
