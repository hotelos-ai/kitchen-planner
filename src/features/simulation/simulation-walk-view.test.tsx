import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
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
vi.mock('../scene/walk/WalkScene', () => ({
  WalkScene: ({ view, onAvailabilityChange, onPositionChange }: {
    view: string
    onAvailabilityChange?(availability: { status: 'ready'; source: 'entry'; spawn: { xMm: number; yMm: number; headingRad: number } }): void
    onPositionChange?(position: { x: number; y: number; elevationMm: number; grounded: boolean; verticalVelocityMps: number }): void
  }) => {
    useEffect(() => {
      onAvailabilityChange?.({ status: 'ready', source: 'entry', spawn: { xMm: 800, yMm: 800, headingRad: 0 } })
      onPositionChange?.({ x: 2100, y: 3200, elevationMm: 650, grounded: false, verticalVelocityMps: 1.8 })
    }, [onAvailabilityChange, onPositionChange])
    return <output data-testid="simulation-walk-camera">{view}</output>
  },
}))

describe('simulation walk camera switching', () => {
  it('uses the same live pose and Canvas for first- and third-person views', async () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const result = runSimulation({ architecture: project.architecture, equipment: variant.equipment, scenario: project.scenarios[0] })
    const liveState = deriveLiveServiceState(result, 900)
    render(<SimulationThreeScene
      view="walk"
      project={project}
      variant={variant}
      result={result}
      liveState={liveState}
      elapsedSeconds={900}
      layers={{ heatmap: true, trails: true, queues: true, clearances: false, flows: true }}
      followRole="overview"
      onExitWalk={vi.fn()}
      webglSupported
    />)
    const canvas = screen.getByTestId('persistent-simulation-canvas')

    expect(screen.getByTestId('simulation-walk-camera')).toHaveTextContent('first-person')
    await userEvent.click(screen.getByRole('button', { name: 'Third-person view' }))

    expect(screen.getByTestId('persistent-simulation-canvas')).toBe(canvas)
    expect(screen.getByTestId('simulation-walk-camera')).toHaveTextContent('third-person')
    expect(screen.getByTestId('simulation-3d-scene')).toHaveAttribute('data-player-elevation-mm', '650')
    expect(screen.getByTestId('simulation-3d-scene')).toHaveAttribute('data-player-vertical-velocity', '1.8')
  })
})
