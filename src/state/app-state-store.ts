import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from '../app/workflow'
import type { PointMm } from '../domain/project'

export type AppCameraMode = 'perspective' | 'top'
export type AppWalkView = 'first-person' | 'third-person'
export type AppSimulationView = 'operations-2d' | 'overview-3d' | 'walk'
export type AppDialog = 'layout-wizard' | 'help' | 'agent-tools'
export type AppPanels = {
  catalog: boolean
  inspector: boolean
  essentials: boolean
  revisions: boolean
}
export type CameraFocusRequest = {
  id: string
  target: 'fit' | 'component' | 'point'
  componentId?: string
  point?: PointMm
  cameraMode?: AppCameraMode
}

export type SimulationRunRequestInput = {
  scenarioId: string
  variantId: string
  seed: number
  playback?: boolean
}

export type SimulationRunRequest = Omit<SimulationRunRequestInput, 'playback'> & {
  id: string
  playback: boolean
}

export type SimulationViewTarget = Pick<SimulationRunRequestInput, 'scenarioId' | 'variantId'>

export type AgentAction = {
  id: string
  documentId: string
  intent: string
  changedIds: string[]
  revision: number
}

export interface AppState {
  stage: WorkflowStage
  view: ViewMode
  overlay: WorkspaceOverlay
  walkMode: boolean
  walkView: AppWalkView
  cameraMode: AppCameraMode
  showClearances: boolean
  wallsTransparent: boolean
  showLabels: boolean
  simulationView: AppSimulationView
  panels: AppPanels
  showReference: boolean
  dialogsOpen: AppDialog[]
  cameraFocusRequest: CameraFocusRequest | null
  requestedSimulationRun: SimulationRunRequest | null
  simulationViewTarget: SimulationViewTarget | null
  agentIntent: string | null
  agentActivityVersion: number
  lastAgentAction: AgentAction | null
  agentActionHistory: AgentAction[]
  setStage(stage: WorkflowStage): void
  setView(view: ViewMode): void
  setOverlay(overlay: WorkspaceOverlay): void
  setWalkMode(walkMode: boolean): void
  setWalkView(walkView: AppWalkView): void
  setCameraMode(cameraMode: AppCameraMode): void
  setShowClearances(showClearances: boolean): void
  setWallsTransparent(wallsTransparent: boolean): void
  setShowLabels(showLabels: boolean): void
  setSimulationView(simulationView: AppSimulationView): void
  setPanels(panels: Partial<AppPanels>): void
  setShowReference(showReference: boolean): void
  setDialogOpen(dialog: AppDialog, open: boolean): void
  requestCameraFocus(request: Omit<CameraFocusRequest, 'id'>): CameraFocusRequest
  consumeCameraFocus(id: string): CameraFocusRequest | null
  toggleOverlay(overlay: Exclude<WorkspaceOverlay, null>): void
  requestSimulationRun(input: SimulationRunRequestInput): SimulationRunRequest
  consumeSimulationRun(id?: string): SimulationRunRequest | null
  clearSimulationRun(): void
  setAgentIntent(intent: string | null): void
  beginAgentActivity(): void
  setLastAgentAction(action: AgentAction | null): void
  clearLastAgentAction(id?: string): void
  reset(): void
}

export type AppStateStore = StoreApi<AppState>

const initialState = {
  stage: 'space' as const,
  view: 'plan' as const,
  overlay: null,
  walkMode: false,
  walkView: 'first-person' as const,
  cameraMode: 'perspective' as const,
  showClearances: false,
  wallsTransparent: true,
  showLabels: false,
  simulationView: 'operations-2d' as const,
  panels: {
    catalog: true,
    inspector: true,
    essentials: false,
    revisions: false,
  },
  showReference: false,
  dialogsOpen: [] as AppDialog[],
  cameraFocusRequest: null,
  requestedSimulationRun: null,
  simulationViewTarget: null,
  agentIntent: null,
  agentActivityVersion: 0,
  lastAgentAction: null,
  agentActionHistory: [],
}

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export function createAppStateStore(): AppStateStore {
  return createStore<AppState>((set, get) => ({
    ...initialState,
    setStage: (stage) => set({ stage }),
    setView: (view) => set({ view }),
    setOverlay: (overlay) => set({ overlay }),
    setWalkMode: (walkMode) => set({ walkMode }),
    setWalkView: (walkView) => set({ walkView }),
    setCameraMode: (cameraMode) => set({ cameraMode }),
    setShowClearances: (showClearances) => set({ showClearances }),
    setWallsTransparent: (wallsTransparent) => set({ wallsTransparent }),
    setShowLabels: (showLabels) => set({ showLabels }),
    setSimulationView: (simulationView) => set({ simulationView }),
    setPanels: (panels) => set((state) => ({ panels: { ...state.panels, ...panels } })),
    setShowReference: (showReference) => set({ showReference }),
    setDialogOpen: (dialog, open) => set((state) => {
      const dialogsOpen = open
        ? [...state.dialogsOpen.filter((candidate) => candidate !== dialog), dialog]
        : state.dialogsOpen.filter((candidate) => candidate !== dialog)
      return { dialogsOpen }
    }),
    requestCameraFocus: (input) => {
      const request = { ...input, id: makeId('camera-focus') }
      set({ cameraFocusRequest: request })
      return request
    },
    consumeCameraFocus: (id) => {
      const request = get().cameraFocusRequest
      if (!request || request.id !== id) return null
      set({ cameraFocusRequest: null })
      return request
    },
    toggleOverlay: (overlay) => set((state) => ({ overlay: state.overlay === overlay ? null : overlay })),
    requestSimulationRun: (input) => {
      const request: SimulationRunRequest = {
        id: makeId('simulation-run'),
        scenarioId: input.scenarioId,
        variantId: input.variantId,
        seed: input.seed,
        playback: input.playback ?? true,
      }
      set({
        requestedSimulationRun: request,
        simulationViewTarget: { variantId: input.variantId, scenarioId: input.scenarioId },
      })
      return request
    },
    consumeSimulationRun: (id) => {
      const request = get().requestedSimulationRun
      if (!request || (id !== undefined && request.id !== id)) return null
      set({ requestedSimulationRun: null })
      return request
    },
    clearSimulationRun: () => set({ requestedSimulationRun: null, simulationViewTarget: null }),
    setAgentIntent: (agentIntent) => set({ agentIntent }),
    beginAgentActivity: () => set((state) => ({ agentActivityVersion: state.agentActivityVersion + 1 })),
    setLastAgentAction: (lastAgentAction) => set((state) => ({
      lastAgentAction,
      agentActionHistory: lastAgentAction
        ? [lastAgentAction, ...state.agentActionHistory.filter((action) => action.id !== lastAgentAction.id)].slice(0, 30)
        : state.agentActionHistory,
    })),
    clearLastAgentAction: (id) => set((state) => (
      !state.lastAgentAction || (id !== undefined && state.lastAgentAction.id !== id)
        ? state
        : { lastAgentAction: null }
    )),
    reset: () => set(initialState),
  }))
}

export const appStateStore = createAppStateStore()
