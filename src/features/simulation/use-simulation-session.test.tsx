import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { createSimulationRunStore, selectSimulationRun } from '../../state/simulation-run-store'
import { useSimulationSession } from './useSimulationSession'

describe('useSimulationSession', () => {
  it('keeps one result while presentation views change outside the hook', () => {
    const project = createSeedProject()
    const runStore = createSimulationRunStore()
    const run = vi.fn(runSimulation)
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const { result, rerender } = renderHook(({ marker }) => ({ marker, session: useSimulationSession({ input, run, runStore }) }), { initialProps: { marker: '2d' } })
    act(() => result.current.session.startRun())
    const first = result.current.session.result
    rerender({ marker: '3d' })
    expect(result.current.session.result).toBe(first)
    expect(run).toHaveBeenCalledOnce()
  })

  it('subscribes to an exact result produced outside the UI without executing the engine again', () => {
    const project = createSeedProject()
    const runStore = createSimulationRunStore()
    const run = vi.fn(runSimulation)
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const { result } = renderHook(() => useSimulationSession({
      input,
      run,
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      revision: 7,
      runStore,
    }))
    const externallyProduced = runSimulation(input)

    act(() => {
      runStore.getState().storeRun({
        variantId: project.activeVariantId,
        scenarioId: project.activeScenarioId,
        result: externallyProduced,
        seed: input.scenario.seed,
        ranAtRevision: 7,
      })
      result.current.presentRun(false)
    })

    expect(result.current.result).toBe(externallyProduced)
    expect(result.current.playing).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('retains but does not present a result from an older project revision', () => {
    const project = createSeedProject()
    const runStore = createSimulationRunStore()
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const staleResult = runSimulation(input)
    runStore.getState().storeRun({
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      result: staleResult,
      seed: input.scenario.seed,
      ranAtRevision: 2,
    })

    const { result } = renderHook(() => useSimulationSession({
      input,
      run: runSimulation,
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      revision: 3,
      runStore,
    }))

    expect(result.current.result).toBeNull()
    expect(selectSimulationRun(runStore.getState(), project.activeVariantId, project.activeScenarioId)?.result).toBe(staleResult)
  })
})
