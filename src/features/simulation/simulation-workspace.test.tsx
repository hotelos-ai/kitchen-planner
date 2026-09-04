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

  it('keeps simulation available with access warnings and explains the closest-point fallback', async () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const dirtyLanding = variant.equipment.find((item) => item.id === 'dirty-landing')!
    Object.assign(dirtyLanding, { xMm: 2700, yMm: 5950, widthMm: 700, depthMm: 600 })
    const store = createProjectStore(project)
    const run = vi.fn(runSimulation)
    render(<SimulationWorkspace store={store} run={run} />)

    const runButton = screen.getByRole('button', { name: /Run 60-minute service/i })
    expect(runButton).toBeEnabled()
    expect(screen.getByText(/modeled warnings.*simulation can still run/i)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Review warnings'))
    expect(screen.getByText(/staff walk to the closest reachable service point/i)).toBeInTheDocument()

    await userEvent.click(runButton)
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(run).toHaveBeenCalledOnce()
  })

  it('opens the compact strategy prompt and moves equipment without changing architecture', async () => {
    const project = createSeedProject()
    const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)!
    variant.equipment = variant.equipment.filter((item) => !item.capabilities.includes('hand-wash'))
    variant.equipment.find((item) => item.id === 'working-table')!.xMm = 4200
    const store = createProjectStore(project)
    const run = vi.fn(runSimulation)
    const architectureBefore = structuredClone(variant.architecture)
    render(<SimulationWorkspace store={store} run={run} />)

    const runButton = screen.getByRole('button', { name: /Run 60-minute service/i })
    expect(runButton).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Auto-fix plan' }))

    const dialog = screen.getByRole('dialog', { name: 'Choose an auto-fix strategy' })
    expect(within(dialog).getByRole('button', { name: 'Adjust the layout' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Move equipment' })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: /^(Adjust the layout|Move equipment)$/ })).toHaveLength(2)
    expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('region', { name: 'Layout checks' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('region', { name: 'Operational essentials' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move equipment' }))

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
    expect(fixedVariant.architecture).toEqual(architectureBefore)
    expect(screen.queryByRole('dialog', { name: 'Choose an auto-fix strategy' })).not.toBeInTheDocument()
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

    await userEvent.click(screen.getByRole('button', { name: 'Review issues' }))
    const review = screen.getByRole('dialog', { name: 'Auto-fix simulation plan' })
    await userEvent.click(within(review).getByText('Review details'))
    await userEvent.click(within(review).getByRole('button', { name: 'Fix room setup' }))

    expect(screen.queryByRole('dialog', { name: 'Auto-fix simulation plan' })).not.toBeInTheDocument()
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', view: 'plan', overlay: null })
  })

  it('switches among operations, 3D, and Walk without rerunning or resetting time', async () => {
    const run = vi.fn(runSimulation)
    const FakeThreeScene = ({ view, layers }: { view: string; layers: { labels: boolean } }) => <div data-testid="simulation-3d-scene">{view}:{String(layers.labels)}</div>
    render(<SimulationWorkspace run={run} threeRenderer={FakeThreeScene} />)
    expect(screen.getByRole('button', { name: 'Labels' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '900' } })
    await userEvent.click(screen.getByRole('button', { name: '3D Overview' }))
    expect(screen.getByTestId('simulation-3d-scene')).toHaveTextContent('overview-3d:false')
    await userEvent.click(screen.getByRole('button', { name: 'Walk Kitchen' }))
    expect(screen.getByTestId('simulation-3d-scene')).toHaveTextContent('walk')
    await userEvent.click(screen.getByRole('button', { name: '2D Operations' }))
    expect(screen.getByLabelText(/Simulation time/i)).toHaveValue('900')
    expect(run).toHaveBeenCalledOnce()
  })

  it('offers better-layout search and existing comparison after a completed run', async () => {
    const project = createSeedProject()
    const candidate = structuredClone(project.variants[0])
    candidate.id = 'existing-candidate'
    candidate.name = 'Existing candidate'
    project.variants.push(candidate)
    const store = createProjectStore(project)
    const onFindBetterLayout = vi.fn()
    const onCompareLayouts = vi.fn()
    render(<SimulationWorkspace store={store} run={runSimulation} onFindBetterLayout={onFindBetterLayout} onCompareLayouts={onCompareLayouts} />)

    expect(screen.queryByRole('button', { name: 'Find a better layout' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))

    await userEvent.click(await screen.findByRole('button', { name: 'Find a better layout' }))
    expect(onFindBetterLayout).toHaveBeenCalledWith({ baselineVariantId: project.activeVariantId, scenarioId: project.activeScenarioId })
    await userEvent.click(screen.getByRole('button', { name: 'Compare existing plans' }))
    expect(onCompareLayouts).toHaveBeenCalledOnce()
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
