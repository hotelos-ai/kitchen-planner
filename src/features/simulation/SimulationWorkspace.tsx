import { useMemo, useState, type ComponentType } from 'react'
import { useStore } from 'zustand'
import type { StaffRole } from '../../domain/project'
import { runSimulation } from '../../simulation/engine'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import { validateSimulationInput } from '../../simulation/validation'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { FindingsPanel } from './FindingsPanel'
import { LayoutVerdict } from './LayoutVerdict'
import { LiveServiceHUD } from './LiveServiceHUD'
import { PlaybackControls } from './PlaybackControls'
import { ScenarioEditor } from './ScenarioEditor'
import { Scorecard } from './Scorecard'
import { SimulationScene } from './SimulationScene'
import { SimulationThreeScene, type SimulationThreeSceneProps } from './SimulationThreeScene'
import { SimulationViewSwitcher, type SimulationView } from './SimulationViewSwitcher'
import { WaitTimeDistribution } from './WaitTimeDistribution'
import { useSimulationSession } from './useSimulationSession'
import { ConfidenceLedger, SimulationSetup, StressTestPresets } from './SimulationSetup'

type Props = { store?: ProjectStore; run?: (input: SimulationInput) => SimulationResult; threeRenderer?: ComponentType<SimulationThreeSceneProps> }
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean; labels: boolean }

const minutes = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} sec`
}

export function SimulationWorkspace({ store = projectStore, run = runSimulation, threeRenderer: ThreeRenderer = SimulationThreeScene }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const scenario = project.scenarios.find((value) => value.id === project.activeScenarioId) ?? project.scenarios[0]
  const [layers, setLayers] = useState<Layers>({ heatmap: true, trails: true, queues: true, clearances: false, flows: true, labels: true })
  const [followRole, setFollowRole] = useState<StaffRole | 'overview'>('overview')
  const [view, setView] = useState<SimulationView>('operations-2d')
  const [scenarioCollapsed, setScenarioCollapsed] = useState(false)
  const staffCount = scenario.staff.reduce((sum, entry) => sum + entry.count, 0)
  const validationErrors = useMemo(() => validateSimulationInput({
    architecture: variant.architecture,
    equipment: variant.equipment,
    scenario,
    layoutConstraints: variant.layoutConstraints,
  }), [scenario, variant.architecture, variant.equipment, variant.layoutConstraints])
  const hasValidationErrors = validationErrors.length > 0
  const simulationInput = useMemo(() => ({
    architecture: variant.architecture,
    equipment: variant.equipment,
    scenario,
    layoutConstraints: variant.layoutConstraints,
  }), [scenario, variant.architecture, variant.equipment, variant.layoutConstraints])
  const session = useSimulationSession({ input: simulationInput, run })
  const { result, liveState, elapsedSeconds, playing, speed } = session

  const startRun = () => {
    if (hasValidationErrors) return
    setScenarioCollapsed(true)
    session.startRun()
  }
  const toggleLayer = (key: keyof Layers) => setLayers((current) => ({ ...current, [key]: !current[key] }))
  const bottleneck = result ? Object.entries(result.metrics.stationUtilization).sort((left, right) => right[1] - left[1])[0]?.[0] : undefined

  return (
    <section className={`simulation-workspace three-panel${scenarioCollapsed ? ' scenario-collapsed' : ''}`}>
      <aside className="simulation-scenario-panel" aria-label="Scenario">
        <div className="panel-heading">
          <span className="eyebrow">Scenario</span>
          <h2>{scenario.name}</h2>
          <label>Scenario
            <select aria-label="Active scenario" value={scenario.id} onChange={(event) => store.getState().patchProject((project) => { project.activeScenarioId = event.target.value })}>
              {project.scenarios.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
        </div>
        <SimulationSetup scenario={scenario} store={store} onRun={startRun} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); session.clearRun() }} />
        <ScenarioEditor scenario={scenario} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); session.clearRun() }} />
        {result && <StressTestPresets scenario={scenario} store={store} onRun={startRun} />}
        <button type="button" className="link-button" onClick={() => setScenarioCollapsed((value) => !value)}>{scenarioCollapsed ? 'Show scenario' : 'Collapse scenario'}</button>
      </aside>
      <div className="simulation-main">
        <div className="simulation-toolbar">
          <div><span className="eyebrow">Active layout</span><strong>{variant.name}</strong></div>
          <div className="layer-toggles">{(Object.keys(layers) as (keyof Layers)[]).map((key) => <button type="button" key={key} aria-pressed={layers[key]} onClick={() => toggleLayer(key)}>{key[0].toUpperCase() + key.slice(1)}</button>)}</div>
          <label className="follow-control">Follow<select aria-label="Follow staff role" value={followRole} onChange={(event) => setFollowRole(event.target.value as StaffRole | 'overview')}><option value="overview">Overview</option><option value="head-chef">Head chef</option><option value="sous-chef">Sous chef</option><option value="cdp">CDP</option><option value="busser-washer">Busser / washer</option></select></label>
          <button type="button" className="run-simulation" disabled={hasValidationErrors} onClick={startRun}>Run {scenario.durationMinutes}-minute service</button>
        </div>
        {validationErrors.length > 0 && <div role="alert" className="simulation-validation"><strong>Resolve before simulation</strong>{validationErrors.map((error, index) => <button type="button" key={`${error.code}-${index}`} onClick={() => error.itemIds.length && store.getState().selectItems(error.itemIds)}>{error.message}{error.itemIds.length ? ' Select affected equipment, then open Plan.' : ''}</button>)}</div>}
        {result && liveState ? <>
          <LiveServiceHUD result={result} state={liveState} />
          <div className="simulation-view-stage">
            <SimulationViewSwitcher value={view} onChange={setView} />
            {view === 'operations-2d'
              ? <SimulationScene result={result} liveState={liveState} elapsedSeconds={elapsedSeconds} architecture={variant.architecture} equipment={variant.equipment} layers={layers} followRole={followRole} />
              : <ThreeRenderer view={view} project={project} variant={variant} result={result} liveState={liveState} elapsedSeconds={elapsedSeconds} layers={layers} followRole={followRole} onExitWalk={() => setView('overview-3d')} />}
          </div>
          <PlaybackControls elapsedSeconds={elapsedSeconds} durationSeconds={result.durationSeconds} playing={playing} speed={speed} onPlaying={session.setPlaying} onElapsed={session.setElapsedSeconds} onSpeed={session.setSpeed} />
        </> : <div className="simulation-empty"><div className="service-orbit" aria-hidden="true"><span /><span /><span /><span /><span /></div><h2>Pressure-test this layout</h2><p>Run the approved five-person dinner scenario to see routes, queues, station pressure, and dirty/clean crossings.</p><button type="button" disabled={hasValidationErrors} onClick={startRun}>Start pressure test</button></div>}
      </div>
      <div className="simulation-sidebar">
        {result && (
          <section className="scorecard-heading simulation-primary-summary" aria-label={`${scenario.name} result`}>
            <div className="panel-heading"><span className="eyebrow">Results</span><h2>{scenario.name} result</h2></div>
            <p>At {scenario.covers} covers per hour, this layout is likely to experience delays at the {bottleneck?.replaceAll('-', ' ') ?? 'hot line'}.</p>
            <dl>
              <div><dt>Orders completed</dt><dd>{result.metrics.completedOrders} of {result.metrics.totalOrders}</dd></div>
              <div><dt>Typical ticket time</dt><dd>{minutes(result.metrics.orderCompletionP50Seconds)}</dd></div>
              <div><dt>Slowest 10% of orders</dt><dd>{minutes(result.metrics.orderCompletionP90Seconds)}</dd></div>
              <div><dt>Primary bottleneck</dt><dd>{bottleneck?.replaceAll('-', ' ') ?? 'Hot line'}</dd></div>
            </dl>
          </section>
        )}
        {result && <><LayoutVerdict result={result} /><WaitTimeDistribution result={result} /><Scorecard result={result} /><FindingsPanel result={result} /></>}
        <ConfidenceLedger userProvided={9} equipmentDerived={staffCount} templateEstimates={17} />
        <p className="simulation-assumptions-line">{scenario.covers} covers over {scenario.durationMinutes} minutes · {staffCount} staff · seed {scenario.seed}</p>
      </div>
    </section>
  )
}
