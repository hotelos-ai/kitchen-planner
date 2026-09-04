import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useStore } from 'zustand'
import type { StaffRole } from '../../domain/project'
import { runSimulationResponsive } from '../../simulation/responsive-runner'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import { simulationValidationWarnings, validateSimulationInput } from '../../simulation/validation'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { appStateStore } from '../../state/app-state-store'
import { EssentialsChecker } from '../editor/EssentialsChecker'
import { LayoutDiagnostics } from '../editor/LayoutDiagnostics'
import { AutoFixStrategyDialog } from '../editor/AutoFixStrategyDialog'
import { ValidationAutoFix } from '../editor/ValidationAutoFix'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../../state/simulation-run-store'
import { FindingsPanel } from './FindingsPanel'
import { LayoutVerdict } from './LayoutVerdict'
import { LiveServiceHUD } from './LiveServiceHUD'
import { PlaybackControls } from './PlaybackControls'
import { ScenarioEditor } from './ScenarioEditor'
import { Scorecard } from './Scorecard'
import { SimulationScene } from './SimulationScene'
import { SimulationThreeScene, type SimulationThreeSceneProps } from './SimulationThreeScene'
import { SimulationViewSwitcher } from './SimulationViewSwitcher'
import { WaitTimeDistribution } from './WaitTimeDistribution'
import { useSimulationSession } from './useSimulationSession'
import { ConfidenceLedger, SimulationSetup, StressTestPresets } from './SimulationSetup'

type Props = {
  store?: ProjectStore
  run?: (input: SimulationInput, signal?: AbortSignal) => SimulationResult | Promise<SimulationResult>
  runStore?: SimulationRunStore
  threeRenderer?: ComponentType<SimulationThreeSceneProps>
}
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean; labels: boolean }

const minutes = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} sec`
}

export function SimulationWorkspace({
  store = projectStore,
  run = (input, signal) => runSimulationResponsive(input, { signal }),
  runStore = simulationRunStore,
  threeRenderer: ThreeRenderer = SimulationThreeScene,
}: Props) {
  const project = useStore(store, (state) => state.project)
  const activeVariant = useStore(store, getActiveVariant)
  const simulationViewTarget = useStore(appStateStore, (state) => state.simulationViewTarget)
  const variant = project.variants.find((value) => value.id === simulationViewTarget?.variantId) ?? activeVariant
  const scenario = project.scenarios.find((value) => value.id === simulationViewTarget?.scenarioId)
    ?? project.scenarios.find((value) => value.id === project.activeScenarioId)
    ?? project.scenarios[0]
  const requestedRun = useStore(appStateStore, (state) => state.requestedSimulationRun)
  const [layers, setLayers] = useState<Layers>({ heatmap: true, trails: true, queues: true, clearances: false, flows: true, labels: false })
  const [followRole, setFollowRole] = useState<StaffRole | 'overview'>('overview')
  const view = useStore(appStateStore, (state) => state.simulationView)
  const setView = useStore(appStateStore, (state) => state.setSimulationView)
  const [scenarioCollapsed, setScenarioCollapsed] = useState(false)
  const [autoFixOpen, setAutoFixOpen] = useState(false)
  const [autoFixStatus, setAutoFixStatus] = useState('')
  const [autoFixStrategyOpen, setAutoFixStrategyOpen] = useState(false)
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
  const validationWarnings = useMemo(() => simulationValidationWarnings(simulationInput), [simulationInput])
  const requestedSimulationInput = useMemo(() => {
    if (!requestedRun) return null
    const requestedVariant = project.variants.find((candidate) => candidate.id === requestedRun.variantId)
    const requestedScenario = project.scenarios.find((candidate) => candidate.id === requestedRun.scenarioId)
    if (!requestedVariant || !requestedScenario) return null
    return {
      architecture: requestedVariant.architecture,
      equipment: requestedVariant.equipment,
      scenario: { ...requestedScenario, seed: requestedRun.seed },
      layoutConstraints: requestedVariant.layoutConstraints,
    }
  }, [project.scenarios, project.variants, requestedRun])
  const session = useSimulationSession({
    input: simulationInput,
    run,
    variantId: variant.id,
    scenarioId: scenario.id,
    revision: store.getState().revision,
    runStore,
  })
  const { result, liveState, elapsedSeconds, playing, speed } = session

  const startRun = () => {
    if (hasValidationErrors) return
    session.startRun()
  }

  useEffect(() => {
    if (!requestedRun) return
    appStateStore.getState().consumeSimulationRun(requestedRun.id)
    if (!requestedSimulationInput || validateSimulationInput(requestedSimulationInput).length > 0) return
    const stored = selectSimulationRun(runStore.getState(), requestedRun.variantId, requestedRun.scenarioId)
    if (stored && stored.seed === requestedRun.seed && stored.ranAtRevision === store.getState().revision) {
      session.presentRun(requestedRun.playback)
    } else session.startRun(requestedSimulationInput, requestedRun.playback, {
      variantId: requestedRun.variantId,
      scenarioId: requestedRun.scenarioId,
      revision: store.getState().revision,
    })
    // The request id is a one-shot command. Session methods intentionally stay
    // out of the dependency list so ordinary playback renders cannot replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedRun?.id, requestedSimulationInput, runStore, store])
  const toggleLayer = (key: keyof Layers) => setLayers((current) => ({ ...current, [key]: !current[key] }))
  const editRoom = () => {
    setAutoFixOpen(false)
    const appState = appStateStore.getState()
    appState.setOverlay(null)
    appState.setView('plan')
    appState.setStage('space')
  }
  const bottleneck = result ? Object.entries(result.metrics.stationUtilization).sort((left, right) => right[1] - left[1])[0]?.[0] : undefined

  return (
    <>
    <section className={`simulation-workspace three-panel${scenarioCollapsed ? ' scenario-collapsed' : ''}`}>
      <aside className="simulation-scenario-panel" aria-label="Scenario" data-collapsed={scenarioCollapsed}>
        {scenarioCollapsed && (
          <button
            type="button"
            className="scenario-expand-button"
            aria-controls="simulation-scenario-content"
            aria-expanded="false"
            aria-label="Expand scenario panel"
            onClick={() => setScenarioCollapsed(false)}
          >
            <span aria-hidden="true">›</span>
            <span className="scenario-expand-label">Scenario</span>
          </button>
        )}
        <div id="simulation-scenario-content" className="simulation-scenario-content" hidden={scenarioCollapsed}>
          <div className="panel-heading">
            <div className="scenario-panel-title-row">
              <span className="eyebrow">Scenario</span>
              <button
                type="button"
                className="scenario-collapse-button"
                aria-controls="simulation-scenario-content"
                aria-expanded="true"
                aria-label="Collapse scenario panel"
                onClick={() => setScenarioCollapsed(true)}
              >
                ‹
              </button>
            </div>
            <h2>{scenario.name}</h2>
            <label>Scenario
              <select aria-label="Active scenario" value={scenario.id} onChange={(event) => {
                appStateStore.getState().clearSimulationRun()
                store.getState().patchProject((project) => { project.activeScenarioId = event.target.value })
              }}>
                {project.scenarios.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>
          </div>
          <SimulationSetup scenario={scenario} store={store} onRun={startRun} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); session.clearRun() }} />
          <ScenarioEditor scenario={scenario} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); session.clearRun() }} />
          {result && <StressTestPresets scenario={scenario} store={store} onRun={startRun} />}
        </div>
      </aside>
      <div className="simulation-main">
        <div className="simulation-toolbar">
          <div><span className="eyebrow">Active layout</span><strong>{variant.name}</strong></div>
          <div className="layer-toggles">{(Object.keys(layers) as (keyof Layers)[]).map((key) => <button type="button" key={key} aria-pressed={layers[key]} onClick={() => toggleLayer(key)}>{key[0].toUpperCase() + key.slice(1)}</button>)}</div>
          <label className="follow-control">Follow<select aria-label="Follow staff role" value={followRole} onChange={(event) => setFollowRole(event.target.value as StaffRole | 'overview')}><option value="overview">Overview</option><option value="head-chef">Head chef</option><option value="sous-chef">Sous chef</option><option value="cdp">CDP</option><option value="busser-washer">Busser / washer</option></select></label>
          {hasValidationErrors && <button type="button" className="simulation-autofix-button" onClick={() => setAutoFixStrategyOpen(true)}>Auto-fix plan</button>}
          <button type="button" className="run-simulation" disabled={hasValidationErrors} onClick={startRun}>Run {scenario.durationMinutes}-minute service</button>
        </div>
        {(validationErrors.length > 0 || validationWarnings.length > 0 || autoFixStatus) && <div role={validationErrors.length > 0 ? 'alert' : 'status'} className={`simulation-validation${!validationErrors.length && validationWarnings.length ? ' warning' : ''}`}>
          <strong>{validationErrors.length > 0
            ? `${validationErrors.length} blocking issue${validationErrors.length === 1 ? '' : 's'} must be resolved before simulation`
            : validationWarnings.length > 0
              ? `${validationWarnings.length} modeled warning${validationWarnings.length === 1 ? '' : 's'} — simulation can still run`
              : 'Ready to simulate'}</strong>
          {autoFixStatus && <span>{autoFixStatus}</span>}
          {validationErrors.length > 0 && <button type="button" onClick={() => setAutoFixOpen(true)}>Review issues</button>}
          {!validationErrors.length && validationWarnings.length > 0 && <details>
            <summary>Review warnings</summary>
            <ul>{validationWarnings.map((warning, index) => <li key={`${warning.code}-${warning.itemIds.join('-')}-${index}`}>{warning.message}</li>)}</ul>
            <p>When a preferred approach is obstructed, staff walk to the closest reachable service point and complete the task there.</p>
          </details>}
        </div>}
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
    {autoFixStrategyOpen && (
      <AutoFixStrategyDialog
        store={store}
        onClose={() => setAutoFixStrategyOpen(false)}
        onResult={(result) => setAutoFixStatus(result.message)}
      />
    )}
    {autoFixOpen && (
      <div className="workspace-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAutoFixOpen(false) }}>
        <section
          className="essentials-dialog simulation-autofix-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Auto-fix simulation plan"
          onKeyDown={(event) => { if (event.key === 'Escape') setAutoFixOpen(false) }}
        >
          <button type="button" className="workspace-modal-close" aria-label="Close auto-fix plan" onClick={() => setAutoFixOpen(false)}>×</button>
          <h2>Resolve simulation blockers</h2>
          <p>Automatic changes use the same undoable workspace actions as the plan editor.</p>
          <ValidationAutoFix store={store} onEditRoom={editRoom} />
          {!hasValidationErrors && <p className="simulation-autofix-status" role="status">Simulation blockers resolved — close to run.</p>}
          <details className="validation-review-details">
            <summary>Review details</summary>
            <div>
              <LayoutDiagnostics store={store} />
              <EssentialsChecker store={store} onEditRoom={editRoom} showQuickFixes={false} />
              <section aria-label="Simulation validation details">
                <h3>Remaining simulation blockers</h3>
                {hasValidationErrors
                  ? <ul>{validationErrors.map((validationError, index) => <li key={`${validationError.code}-${index}`}>{validationError.message}</li>)}</ul>
                  : <p>None.</p>}
              </section>
            </div>
          </details>
        </section>
      </div>
    )}
    </>
  )
}
