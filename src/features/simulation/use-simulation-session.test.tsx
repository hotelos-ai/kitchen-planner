import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { useSimulationSession } from './useSimulationSession'

describe('useSimulationSession', () => {
  it('keeps one result while presentation views change outside the hook', () => {
    const project = createSeedProject()
    const run = vi.fn(runSimulation)
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const { result, rerender } = renderHook(({ marker }) => ({ marker, session: useSimulationSession({ input, run }) }), { initialProps: { marker: '2d' } })
    act(() => result.current.session.startRun())
    const first = result.current.session.result
    rerender({ marker: '3d' })
    expect(result.current.session.result).toBe(first)
    expect(run).toHaveBeenCalledOnce()
  })
})
