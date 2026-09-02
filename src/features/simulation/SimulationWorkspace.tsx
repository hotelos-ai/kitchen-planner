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

type Props = { store?: ProjectStore; run?: (input: SimulationInput) => SimulationResult; threeRenderer?: ComponentType<SimulationThreeSceneProps> }
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean; labels: boolean }

export function SimulationWorkspace({ store = projectStore, run = runSimulation, threeRenderer: ThreeRenderer = SimulationThreeScene }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const scenario = project.scenarios.find((value) => value.id === project.activeScenarioId) ?? project.scenarios[0]
  const [layers, setLayers] = useState<Layers>({ heatmap: true, trails: true, queues: true, clearances: false, flows: true, labels: true })
  const [followRole, setFollowRole] = useState<StaffRole | 'overview'>('overview')
  const [view, setView] = useState<SimulationView>('operations-2d')
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
    session.startRun()
  }
  const toggleLayer = (key: keyof Layers) => setLayers((current) => ({ ...current, [key]: !current[key] }))

  return (
    <section className="simulation-workspace">
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
        <ScenarioEditor scenario={scenario} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); session.clearRun() }} />
        {result && <><LayoutVerdict result={result} /><WaitTimeDistribution result={result} /><Scorecard result={result} /><FindingsPanel result={result} /></>}
        <aside className="simulation-assumptions" aria-label="Simulation assumptions"><strong>{scenario.covers} covers over {scenario.durationMinutes} minutes · {staffCount} staff · seed {scenario.seed}</strong><p>Mostly cooked to order ({Math.round(scenario.cookToOrderRatio * 100)}%). Durations are planning estimates and should be tuned after menu trials.</p><p className="disclaimer">Comparative planning aid — verify fire, ventilation, hygiene, accessibility, and worker safety with qualified local professionals.</p></aside>
      </div>
    </section>
  )
}
