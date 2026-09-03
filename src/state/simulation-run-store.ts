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
}

export interface SimulationRunState {
  runs: Record<string, StoredSimulationRun>
  leastRecentlyUsed: string[]
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

export function createSimulationRunStore(): SimulationRunStore {
  return createStore<SimulationRunState>((set) => ({
    runs: {},
    leastRecentlyUsed: [],
    storeRun: (input) => {
      const stored: StoredSimulationRun = {
        ...input,
        ranAt: input.ranAt ?? new Date().toISOString(),
      }
      const key = simulationRunKey(input.variantId, input.scenarioId)
      set((state) => {
        const leastRecentlyUsed = [...state.leastRecentlyUsed.filter((candidate) => candidate !== key), key]
        const runs = { ...state.runs, [key]: stored }
        while (leastRecentlyUsed.length > MAX_STORED_SIMULATION_RUNS) {
          const evicted = leastRecentlyUsed.shift()
          if (evicted) delete runs[evicted]
        }
        return { runs, leastRecentlyUsed }
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
        }
      })
    },
    clear: () => set({ runs: {}, leastRecentlyUsed: [] }),
  }))
}

/**
 * Presentation-only simulation state. It is intentionally independent of the
 * project store, persistence, revision history, and exported project JSON.
 */
export const simulationRunStore = createSimulationRunStore()
