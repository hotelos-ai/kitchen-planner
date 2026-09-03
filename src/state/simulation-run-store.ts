import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SimulationResult } from '../simulation/types'

export const MAX_STORED_SIMULATION_RUNS = 3

export type StoredSimulationRun = {
  variantId: string
  scenarioId: string
  result: SimulationResult
  seed: number
  ranAtRevision: number
  ranAt: string
}

export type StoreSimulationRunInput = Omit<StoredSimulationRun, 'ranAt'> & {
  ranAt?: string
  /** False retains the run for reads without replacing the visible playback result. */
  active?: boolean
}

export interface SimulationRunState {
  runs: Record<string, StoredSimulationRun>
  leastRecentlyUsed: string[]
  activeRunKey: string | null
  storeRun(input: StoreSimulationRunInput): StoredSimulationRun
  removeRun(variantId: string, scenarioId: string): void
  clear(): void
}

export type SimulationRunStore = StoreApi<SimulationRunState>

export const simulationRunKey = (variantId: string, scenarioId: string) => `${variantId}:${scenarioId}`

export const selectSimulationRun = (
  state: SimulationRunState,
  variantId: string,
  scenarioId: string,
): StoredSimulationRun | null => state.runs[simulationRunKey(variantId, scenarioId)] ?? null

const withoutPlaybackFrames = (run: StoredSimulationRun): StoredSimulationRun => {
  if (run.result.frames.length === 0) return run
  return {
    ...run,
    result: {
      ...run.result,
      frames: [],
    },
  }
}

export function createSimulationRunStore(): SimulationRunStore {
  return createStore<SimulationRunState>((set) => ({
    runs: {},
    leastRecentlyUsed: [],
    activeRunKey: null,
    storeRun: (input) => {
      const { active = true, ...runInput } = input
      const stored: StoredSimulationRun = {
        ...runInput,
        ranAt: input.ranAt ?? new Date().toISOString(),
      }
      const key = simulationRunKey(input.variantId, input.scenarioId)
      set((state) => {
        const leastRecentlyUsed = [...state.leastRecentlyUsed.filter((candidate) => candidate !== key), key]
        const runs = { ...state.runs, [key]: stored }
        const activeRunKey = active ? key : (state.activeRunKey ?? key)
        // Only the active run needs its potentially large playback series.
        // Historical entries retain their aggregates and evidence for WebMCP
        // reads without keeping duplicate frame sets.
        for (const candidate of leastRecentlyUsed) {
          if (candidate !== activeRunKey && runs[candidate]) runs[candidate] = withoutPlaybackFrames(runs[candidate])
        }
        while (leastRecentlyUsed.length > MAX_STORED_SIMULATION_RUNS) {
          const evictionIndex = leastRecentlyUsed.findIndex((candidate) => candidate !== activeRunKey)
          const [evicted] = leastRecentlyUsed.splice(evictionIndex < 0 ? 0 : evictionIndex, 1)
          if (evicted) delete runs[evicted]
        }
        return { runs, leastRecentlyUsed, activeRunKey }
      })
      return stored
    },
    removeRun: (variantId, scenarioId) => {
      const key = simulationRunKey(variantId, scenarioId)
      set((state) => {
        if (!(key in state.runs)) return state
        const runs = { ...state.runs }
        delete runs[key]
        return {
          runs,
          leastRecentlyUsed: state.leastRecentlyUsed.filter((candidate) => candidate !== key),
          activeRunKey: state.activeRunKey === key ? null : state.activeRunKey,
        }
      })
    },
    clear: () => set({ runs: {}, leastRecentlyUsed: [], activeRunKey: null }),
  }))
}

/**
 * Presentation-only simulation state. It is intentionally independent of the
 * project store, persistence, revision history, and exported project JSON.
 */
export const simulationRunStore = createSimulationRunStore()
