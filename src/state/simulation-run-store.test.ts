import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { runSimulation } from '../simulation/engine'
import { createSimulationRunStore, MAX_STORED_SIMULATION_RUNS, selectSimulationRun } from './simulation-run-store'

const resultFor = (seed: number) => {
  const project = createSeedProject()
  return runSimulation({
    architecture: project.variants[0].architecture,
    equipment: project.variants[0].equipment,
    scenario: { ...project.scenarios[0], seed, covers: 2, durationMinutes: 5 },
  })
}

describe('simulation run store', () => {
  it('keeps the exact full result and replaces the previous run for a layout/scenario key', () => {
    const store = createSimulationRunStore()
    const first = resultFor(11)
    const second = resultFor(12)
    store.getState().storeRun({ variantId: 'layout-a', scenarioId: 'dinner', result: first, seed: 11, ranAtRevision: 3, ranAt: '2026-09-03T01:00:00.000Z' })
    store.getState().storeRun({ variantId: 'layout-a', scenarioId: 'dinner', result: second, seed: 12, ranAtRevision: 4, ranAt: '2026-09-03T02:00:00.000Z' })

    expect(selectSimulationRun(store.getState(), 'layout-a', 'dinner')).toMatchObject({
      result: second,
      seed: 12,
      ranAtRevision: 4,
      ranAt: '2026-09-03T02:00:00.000Z',
    })
    expect(selectSimulationRun(store.getState(), 'layout-a', 'dinner')?.result).toBe(second)
    expect(store.getState().leastRecentlyUsed).toEqual(['layout-a:dinner'])
  })

  it('evicts the least-recently stored key after three runs', () => {
    const store = createSimulationRunStore()
    for (let index = 0; index <= MAX_STORED_SIMULATION_RUNS; index += 1) {
      store.getState().storeRun({
        variantId: `layout-${index}`,
        scenarioId: 'dinner',
        result: resultFor(index),
        seed: index,
        ranAtRevision: index,
      })
    }

    expect(Object.keys(store.getState().runs)).toHaveLength(MAX_STORED_SIMULATION_RUNS)
    expect(selectSimulationRun(store.getState(), 'layout-0', 'dinner')).toBeNull()
    expect(store.getState().leastRecentlyUsed).toEqual(['layout-1:dinner', 'layout-2:dinner', 'layout-3:dinner'])
  })

  it('drops playback frames from non-active LRU entries while preserving the exact active result', () => {
    const store = createSimulationRunStore()
    const inactive = resultFor(21)
    const active = resultFor(22)

    store.getState().storeRun({
      variantId: 'layout-a',
      scenarioId: 'dinner',
      result: inactive,
      seed: 21,
      ranAtRevision: 1,
    })
    store.getState().storeRun({
      variantId: 'layout-b',
      scenarioId: 'dinner',
      result: active,
      seed: 22,
      ranAtRevision: 1,
    })

    const retainedInactive = selectSimulationRun(store.getState(), 'layout-a', 'dinner')
    expect(inactive.frames.length).toBeGreaterThan(0)
    expect(retainedInactive?.result).not.toBe(inactive)
    expect(retainedInactive?.result.frames).toEqual([])
    expect(retainedInactive?.result.metrics).toBe(inactive.metrics)
    expect(selectSimulationRun(store.getState(), 'layout-b', 'dinner')?.result).toBe(active)
    expect(active.frames.length).toBeGreaterThan(0)
  })

  it('keeps the active playback result exact when a background run is stored and evicts another history entry first', () => {
    const store = createSimulationRunStore()
    const active = resultFor(31)
    store.getState().storeRun({ variantId: 'layout-active', scenarioId: 'dinner', result: active, seed: 31, ranAtRevision: 1 })

    for (let index = 0; index < MAX_STORED_SIMULATION_RUNS; index += 1) {
      store.getState().storeRun({
        variantId: `layout-background-${index}`,
        scenarioId: 'dinner',
        result: resultFor(40 + index),
        seed: 40 + index,
        ranAtRevision: 1,
        active: false,
      })
    }

    expect(store.getState().activeRunKey).toBe('layout-active:dinner')
    expect(selectSimulationRun(store.getState(), 'layout-active', 'dinner')?.result).toBe(active)
    expect(selectSimulationRun(store.getState(), 'layout-active', 'dinner')?.result.frames.length).toBeGreaterThan(0)
    expect(selectSimulationRun(store.getState(), 'layout-background-0', 'dinner')).toBeNull()
    expect(selectSimulationRun(store.getState(), 'layout-background-2', 'dinner')?.result.frames).toEqual([])
  })
})
