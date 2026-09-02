import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EquipmentItem, LayoutVariant } from '../../domain/project'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { deriveLiveServiceState } from '../../simulation/live-state'
import { SimulationThreeScene } from './SimulationThreeScene'

vi.mock('../scene/SceneCanvas', () => ({
  SceneCanvas: ({ children }: { children: ReactNode }) => <div data-testid="real-walk-simulation-canvas">{children}</div>,
}))
vi.mock('../scene/KitchenScene', () => ({ KitchenScene: () => <div>Kitchen geometry remains mounted</div> }))
vi.mock('../scene/agents/SimulatedStaff', () => ({ SimulatedStaff: () => null }))
vi.mock('../scene/agents/ChefAvatar', () => ({ ChefAvatar: () => null }))
vi.mock('./CompletedOrderFlow3D', () => ({ CompletedOrderFlow3D: () => null }))
vi.mock('./SimulationSpatialOverlays3D', () => ({ SimulationSpatialOverlays3D: () => null }))
vi.mock('./LiveSimulationOverlays', () => ({ LiveSimulationOverlays: () => null }))
vi.mock('../scene/walk/FirstPersonHands', () => ({ FirstPersonHands: () => null }))
vi.mock('../scene/walk/FirstPersonController', () => ({
  FirstPersonController: ({ spawn }: { spawn: { xMm: number; yMm: number; headingRad: number } }) => (
    <output data-testid="resolved-simulation-spawn" data-x={spawn.xMm} data-y={spawn.yMm}>{spawn.headingRad}</output>
  ),
}))

const blockerFor = (variant: LayoutVariant): EquipmentItem => ({
  id: 'complete-room-blocker', label: 'Complete room blocker', category: 'custom',
  xMm: 0, yMm: 0, widthMm: variant.architecture.widthMm, depthMm: variant.architecture.depthMm, heightMm: 2500,
  rotationDeg: 0, dimensionsLocked: true, movable: false, removable: false, capabilities: [],
})

const renderSimulationWalk = (variant: LayoutVariant) => {
  const project = createSeedProject()
  project.variants[0] = variant
  project.architecture = structuredClone(variant.architecture)
  const result = runSimulation({ architecture: createSeedProject().variants[0].architecture, equipment: createSeedProject().variants[0].equipment, scenario: project.scenarios[0] })
  return render(<SimulationThreeScene
    view="walk" project={project} variant={variant} result={result}
    liveState={deriveLiveServiceState(result, 900)} elapsedSeconds={900}
    layers={{ heatmap: true, trails: true, queues: true, clearances: false, flows: true, labels: true }}
    followRole="overview" onExitWalk={vi.fn()} webglSupported
  />)
}

describe('real simulation Walk spawn integration', () => {
  it('keeps overview mounted and retries the real resolver after geometry correction', async () => {
    const variant = structuredClone(createSeedProject().variants[0])
    variant.equipment = [blockerFor(variant)]
    renderSimulationWalk(variant)

    expect(await screen.findByRole('alert')).toHaveTextContent(/No safe walkthrough start/i)
    expect(screen.getByTestId('real-walk-simulation-canvas')).toBeInTheDocument()
    expect(screen.getByText('Kitchen geometry remains mounted')).toBeInTheDocument()
    expect(screen.queryByTestId('resolved-simulation-spawn')).not.toBeInTheDocument()

    variant.equipment.splice(0)
    fireEvent.click(screen.getByRole('button', { name: 'Retry Walk' }))

    await waitFor(() => expect(screen.getByTestId('resolved-simulation-spawn')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uses the real deterministic interior fallback when no entry is modeled', async () => {
    const variant = structuredClone(createSeedProject().variants[0])
    variant.architecture.openings = variant.architecture.openings.filter((opening) => opening.flow !== 'entry')
    variant.equipment = []
    renderSimulationWalk(variant)

    const spawn = await screen.findByTestId('resolved-simulation-spawn')
    expect(Number(spawn.getAttribute('data-x'))).toBeGreaterThan(0)
    expect(Number(spawn.getAttribute('data-y'))).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
