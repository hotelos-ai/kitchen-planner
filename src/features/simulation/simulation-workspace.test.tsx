import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { createProjectStore, projectStore } from '../../state/project-store'
import { appStateStore } from '../../state/app-state-store'
import { SimulationWorkspace } from './SimulationWorkspace'

describe('simulation workspace', () => {
  beforeEach(() => {
    projectStore.getState().replaceProject(createSeedProject())
    appStateStore.getState().reset()
  })

  it('turns an agent-requested run into visible playback', async () => {
    const run = vi.fn(runSimulation)
    const project = projectStore.getState().project
    appStateStore.getState().requestSimulationRun({
      scenarioId: project.activeScenarioId,
      variantId: project.activeVariantId,
      seed: 4242,
      playback: true,
    })

    render(<SimulationWorkspace run={run} />)

    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ seed: 4242 }),
    }))
    expect(appStateStore.getState().requestedSimulationRun).toBeNull()
  })

  it('runs the approved five-person 50-cover scenario and displays metrics', async () => {
    render(<SimulationWorkspace run={runSimulation} />)
    expect(screen.getByLabelText(/Covers/i)).toHaveValue(50)
    expect(screen.getByLabelText(/Head chef count/i)).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByText(/Dirty-clean crossings/i)).toBeInTheDocument()
    expect(screen.getByText(/Live backlog/i)).toBeInTheDocument()
    expect(screen.getByText(/Average served wait/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Wait-time distribution/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Layout verdict/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Playback speed/i)).toHaveValue('25')
    fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '2000' } })
    expect(screen.getAllByLabelText(/live queue/i).length).toBeGreaterThan(0)
  })

  it('switches among operations, 3D, and Walk without rerunning or resetting time', async () => {
    const run = vi.fn(runSimulation)
    const FakeThreeScene = ({ view }: { view: string }) => <div data-testid="simulation-3d-scene">{view}</div>
    render(<SimulationWorkspace run={run} threeRenderer={FakeThreeScene} />)
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '900' } })
    await userEvent.click(screen.getByRole('button', { name: '3D Overview' }))
    expect(screen.getByTestId('simulation-3d-scene')).toHaveTextContent('overview-3d')
    await userEvent.click(screen.getByRole('button', { name: 'Walk Kitchen' }))
    expect(screen.getByTestId('simulation-3d-scene')).toHaveTextContent('walk')
    await userEvent.click(screen.getByRole('button', { name: '2D Operations' }))
    expect(screen.getByLabelText(/Simulation time/i)).toHaveValue('900')
    expect(run).toHaveBeenCalledOnce()
  })

  it('validates and runs the active variant architecture and layout constraints rather than the compatibility mirror', async () => {
    const project = createSeedProject()
    project.architecture.wallHeightMm = 2100
    project.variants[0].architecture.wallHeightMm = 4700
    project.variants[0].layoutConstraints = { minimumAisleMm: 0, noGoZones: [] }
    const store = createProjectStore(project)
    const run = vi.fn(runSimulation)

    render(<SimulationWorkspace store={store} run={run} />)
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))

    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      architecture: expect.objectContaining({ wallHeightMm: 4700 }),
      layoutConstraints: { minimumAisleMm: 0, noGoZones: [] },
    }))
  })
})
