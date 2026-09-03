import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { validateSimulationInput } from '../../simulation/validation'
import { createProjectStore, projectStore } from '../../state/project-store'
import { appStateStore } from '../../state/app-state-store'
import { createSimulationRunStore, simulationRunStore } from '../../state/simulation-run-store'
import { SimulationWorkspace } from './SimulationWorkspace'

describe('simulation workspace', () => {
  beforeEach(() => {
    projectStore.getState().replaceProject(createSeedProject())
    appStateStore.getState().reset()
    simulationRunStore.getState().clear()
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

  it('presents an agent-requested non-active layout without changing the document selection', async () => {
    const project = createSeedProject()
    const target = structuredClone(project.variants[0])
    target.id = 'agent-target-layout'
    target.name = 'Agent target layout'
    target.architecture.wallHeightMm = 4999
    project.variants.push(target)
    projectStore.getState().replaceProject(project)
    const run = vi.fn(runSimulation)
    appStateStore.getState().requestSimulationRun({
      scenarioId: project.activeScenarioId,
      variantId: target.id,
      seed: 4242,
      playback: false,
    })

    render(<SimulationWorkspace run={run} />)

    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      architecture: expect.objectContaining({ wallHeightMm: 4999 }),
    }))
    expect(projectStore.getState().project.activeVariantId).not.toBe(target.id)
  })

  it('reuses the exact agent-produced result instead of executing the engine twice', async () => {
    const runStore = createSimulationRunStore()
    const run = vi.fn(runSimulation)
    const project = projectStore.getState().project
    const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)!
    const scenario = project.scenarios.find((candidate) => candidate.id === project.activeScenarioId)!
    const agentResult = runSimulation({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario: { ...scenario, seed: 4242 },
      layoutConstraints: variant.layoutConstraints,
    })
    runStore.getState().storeRun({
      variantId: variant.id,
      scenarioId: scenario.id,
      result: agentResult,
      seed: 4242,
      ranAtRevision: projectStore.getState().revision,
    })
    appStateStore.getState().requestSimulationRun({
      scenarioId: scenario.id,
      variantId: variant.id,
      seed: 4242,
      playback: false,
    })

    render(<SimulationWorkspace run={run} runStore={runStore} />)

    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(run).not.toHaveBeenCalled()
  })

  it('runs the approved five-person 50-cover scenario and displays metrics', async () => {
    render(<SimulationWorkspace run={runSimulation} />)
    expect(screen.getByLabelText(/Covers/i)).toHaveValue(50)
    expect(screen.getByLabelText(/Head chef count/i)).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Scenario' })).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByRole('button', { name: 'Collapse scenario panel' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Covers/i)).toHaveValue(50)
    expect(screen.getByText(/Dirty-clean crossings/i)).toBeInTheDocument()
    expect(screen.getByText(/Live backlog/i)).toBeInTheDocument()
    expect(screen.getByText(/Average served wait/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Wait-time distribution/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Layout verdict/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Playback speed/i)).toHaveValue('25')
    fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '2000' } })
    expect(screen.getAllByLabelText(/live queue/i).length).toBeGreaterThan(0)
  })

  it('repairs geometry and missing essentials from the first Auto-fix click and enables Run', async () => {
    const project = createSeedProject()
    const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)!
    variant.equipment = variant.equipment.filter((item) => !item.capabilities.includes('hand-wash'))
    variant.equipment.find((item) => item.id === 'mixer')!.xMm = -500
    const store = createProjectStore(project)
    const run = vi.fn(runSimulation)
    render(<SimulationWorkspace store={store} run={run} />)

    const runButton = screen.getByRole('button', { name: /Run 60-minute service/i })
    expect(runButton).toBeDisabled()
    const beforeRevision = store.getState().revision

    await userEvent.click(screen.getByRole('button', { name: 'Auto-fix plan' }))

    await waitFor(() => expect(runButton).toBeEnabled())
    const next = store.getState()
    const fixedVariant = next.project.variants.find((candidate) => candidate.id === next.project.activeVariantId)!
    const scenario = next.project.scenarios.find((candidate) => candidate.id === next.project.activeScenarioId)!
    expect(validateSimulationInput({
      architecture: fixedVariant.architecture,
      equipment: fixedVariant.equipment,
      scenario,
      layoutConstraints: fixedVariant.layoutConstraints,
    })).toHaveLength(0)
    expect(fixedVariant.equipment.some((item) => item.capabilities.includes('hand-wash'))).toBe(true)
    expect(next.revision).toBe(beforeRevision + 1)
    expect(screen.queryByRole('dialog', { name: 'Auto-fix simulation plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Auto-fix plan' })).not.toBeInTheDocument()

    await userEvent.click(runButton)
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(run).toHaveBeenCalledOnce()
  })

  it('closes auto-fix and opens Space in Plan view for room remediation', async () => {
    const project = createSeedProject()
    const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)!
    variant.architecture.openings = variant.architecture.openings.filter((opening) => opening.flow !== 'entry')
    const store = createProjectStore(project)
    appStateStore.getState().setStage('simulate')
    appStateStore.getState().setView('scene')
    appStateStore.getState().setOverlay('compare')
    render(<SimulationWorkspace store={store} run={runSimulation} />)

    await userEvent.click(screen.getByRole('button', { name: 'Auto-fix plan' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Auto-fix simulation plan' })).getByRole('button', { name: 'Fix room setup' }))

    expect(screen.queryByRole('dialog', { name: 'Auto-fix simulation plan' })).not.toBeInTheDocument()
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', view: 'plan', overlay: null })
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

  it('persists generated and edited menu assumptions on the active scenario', async () => {
    const store = createProjectStore(createSeedProject())
    render(<SimulationWorkspace store={store} run={runSimulation} />)

    await userEvent.click(screen.getByRole('button', { name: /Quick estimate/i }))

    expect(store.getState().project.scenarios[0].menuItems).toHaveLength(4)
    const share = screen.getByLabelText('Grilled fish share percent')
    fireEvent.change(share, { target: { value: '24' } })
    expect(store.getState().project.scenarios[0].menuItems?.[0].sharePct).toBe(24)

    await userEvent.click(screen.getByRole('button', { name: 'Review assumptions' }))
    fireEvent.change(screen.getByLabelText('Grilled fish Cook active seconds'), { target: { value: '55' } })
    expect(store.getState().project.scenarios[0].menuItems?.[0].steps[2].activeSeconds).toBe(55)
  })

  it('uses a dedicated accessible affordance when the scenario panel is collapsed and preserves editor state', async () => {
    const store = createProjectStore(createSeedProject())
    render(<SimulationWorkspace store={store} run={runSimulation} />)

    await userEvent.click(screen.getByRole('button', { name: /Quick estimate/i }))
    const scenarioName = screen.getByRole('textbox', { name: 'Scenario name' })
    expect(scenarioName).toHaveValue('Dinner peak · mostly cooked to order')
    const panel = screen.getByRole('complementary', { name: 'Scenario' })
    const content = document.getElementById('simulation-scenario-content')!
    expect(panel).toHaveAttribute('data-collapsed', 'false')
    expect(content).not.toHaveAttribute('hidden')

    await userEvent.click(screen.getByRole('button', { name: 'Collapse scenario panel' }))

    expect(panel).toHaveAttribute('data-collapsed', 'true')
    expect(content).toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Expand scenario panel' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Scenario name' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expand scenario panel' }))

    expect(panel).toHaveAttribute('data-collapsed', 'false')
    expect(content).not.toHaveAttribute('hidden')
    expect(screen.getByRole('textbox', { name: 'Scenario name' })).toBe(scenarioName)
  })
})
