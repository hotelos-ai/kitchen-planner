import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { deriveLiveServiceState } from '../../simulation/live-state'
import { SimulationThreeScene } from './SimulationThreeScene'

vi.mock('../scene/SceneCanvas', () => ({
  SceneCanvas: ({ children }: { children: ReactNode }) => <div data-testid="persistent-simulation-canvas">{children}</div>,
}))
vi.mock('../scene/KitchenScene', () => ({ KitchenScene: () => <div>Kitchen overview geometry</div> }))
vi.mock('../scene/agents/SimulatedStaff', () => ({ SimulatedStaff: () => null }))
vi.mock('../scene/agents/ChefAvatar', () => ({ ChefAvatar: () => null }))
vi.mock('./CompletedOrderFlow3D', () => ({ CompletedOrderFlow3D: () => null }))
vi.mock('./SimulationSpatialOverlays3D', () => ({ SimulationSpatialOverlays3D: () => null }))
vi.mock('./LiveSimulationOverlays', () => ({ LiveSimulationOverlays: () => null }))
vi.mock('../scene/walk/WalkScene', async () => {
  const React = await import('react')
  return {
    WalkScene: ({ active, onAvailabilityChange }: {
      active: boolean
      onAvailabilityChange?(availability: { status: string; code?: string; message?: string }): void
    }) => {
      React.useEffect(() => {
        if (active) onAvailabilityChange?.({
          status: 'unavailable',
          code: 'no-valid-spawn',
          message: 'No safe walkthrough start is available. Add a staff entry or clear space inside the room.',
        })
      }, [active, onAvailabilityChange])
      return null
    },
  }
})

describe('simulation 3D recovery', () => {
  it('keeps the live overview mounted when simulation Walk is unavailable', async () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const result = runSimulation({ architecture: project.architecture, equipment: variant.equipment, scenario: project.scenarios[0] })
    const liveState = deriveLiveServiceState(result, 900)
    const onExitWalk = vi.fn()

    render(
      <SimulationThreeScene
        view="walk"
        project={project}
        variant={variant}
        result={result}
        liveState={liveState}
        elapsedSeconds={900}
        layers={{ heatmap: true, trails: true, queues: true, clearances: false, flows: true, labels: true }}
        followRole="overview"
        onExitWalk={onExitWalk}
        webglSupported
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/No safe walkthrough start/i)
    expect(screen.getByTestId('persistent-simulation-canvas')).toBeInTheDocument()
    expect(screen.getByText('Kitchen overview geometry')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Return to 3D overview' }))
    expect(onExitWalk).toHaveBeenCalledOnce()
  })
})
