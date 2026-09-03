import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from '../app/workflow'

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
  requestedSimulationRun: SimulationRunRequest | null
  agentIntent: string | null
  lastAgentAction: AgentAction | null
  setStage(stage: WorkflowStage): void
  setView(view: ViewMode): void
  setOverlay(overlay: WorkspaceOverlay): void
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
  requestedSimulationRun: null,
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
    toggleOverlay: (overlay) => set((state) => ({ overlay: state.overlay === overlay ? null : overlay })),
    requestSimulationRun: (input) => {
      const request: SimulationRunRequest = {
        id: makeId('simulation-run'),
        scenarioId: input.scenarioId,
        variantId: input.variantId,
        seed: input.seed,
        playback: input.playback ?? true,
      }
      set({ requestedSimulationRun: request })
      return request
    },
    consumeSimulationRun: (id) => {
      const request = get().requestedSimulationRun
      if (!request || (id !== undefined && request.id !== id)) return null
      set({ requestedSimulationRun: null })
      return request
    },
    clearSimulationRun: () => set({ requestedSimulationRun: null }),
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
