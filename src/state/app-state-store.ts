import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from '../app/workflow'
import type { PointMm } from '../domain/project'

export type AppCameraMode = 'perspective' | 'top'
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
  intent: string
  changedIds: string[]
  revision: number
}

export interface AppState {
  stage: WorkflowStage
  view: ViewMode
  overlay: WorkspaceOverlay
  walkMode: boolean
  cameraMode: AppCameraMode
  cameraFocusRequest: CameraFocusRequest | null
  requestedSimulationRun: SimulationRunRequest | null
  simulationViewTarget: SimulationViewTarget | null
  agentIntent: string | null
  lastAgentAction: AgentAction | null
  setStage(stage: WorkflowStage): void
  setView(view: ViewMode): void
  setOverlay(overlay: WorkspaceOverlay): void
  setWalkMode(walkMode: boolean): void
  setCameraMode(cameraMode: AppCameraMode): void
  requestCameraFocus(request: Omit<CameraFocusRequest, 'id'>): CameraFocusRequest
  consumeCameraFocus(id: string): CameraFocusRequest | null
  toggleOverlay(overlay: Exclude<WorkspaceOverlay, null>): void
  requestSimulationRun(input: SimulationRunRequestInput): SimulationRunRequest
  consumeSimulationRun(id?: string): SimulationRunRequest | null
  clearSimulationRun(): void
  setAgentIntent(intent: string | null): void
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
  cameraMode: 'perspective' as const,
  cameraFocusRequest: null,
  requestedSimulationRun: null,
  simulationViewTarget: null,
  agentIntent: null,
  lastAgentAction: null,
}

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export function createAppStateStore(): AppStateStore {
  return createStore<AppState>((set, get) => ({
    ...initialState,
    setStage: (stage) => set({ stage }),
    setView: (view) => set({ view }),
    setOverlay: (overlay) => set({ overlay }),
    setWalkMode: (walkMode) => set({ walkMode }),
    setCameraMode: (cameraMode) => set({ cameraMode }),
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
    setLastAgentAction: (lastAgentAction) => set({ lastAgentAction }),
    clearLastAgentAction: (id) => set((state) => (
      !state.lastAgentAction || (id !== undefined && state.lastAgentAction.id !== id)
        ? state
        : { lastAgentAction: null }
    )),
    reset: () => set(initialState),
  }))
}

export const appStateStore = createAppStateStore()
