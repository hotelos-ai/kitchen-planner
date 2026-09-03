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
})
