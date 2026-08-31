import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { StaffRole } from '../../domain/project'
import { runSimulation } from '../../simulation/engine'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import { validateSimulationInput } from '../../simulation/validation'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { FindingsPanel } from './FindingsPanel'
import { PlaybackControls } from './PlaybackControls'
import { ScenarioEditor } from './ScenarioEditor'
import { Scorecard } from './Scorecard'
import { SimulationScene } from './SimulationScene'

type Props = { store?: ProjectStore; run?: (input: SimulationInput) => SimulationResult }
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean }

export function SimulationWorkspace({ store = projectStore, run = runSimulation }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const scenario = project.scenarios.find((value) => value.id === project.activeScenarioId) ?? project.scenarios[0]
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [layers, setLayers] = useState<Layers>({ heatmap: true, trails: true, queues: true, clearances: false, flows: true })
  const [followRole, setFollowRole] = useState<StaffRole | 'overview'>('overview')
  const lastTick = useRef(0)
  const staffCount = scenario.staff.reduce((sum, entry) => sum + entry.count, 0)
  const validationErrors = useMemo(() => validateSimulationInput({ architecture: project.architecture, equipment: variant.equipment, scenario }), [project.architecture, scenario, variant.equipment])
  if (staffCount < 1) validationErrors.unshift({ code: 'missing-capability', message: 'Add at least one staff member.', itemIds: [] })
  const hasValidationErrors = validationErrors.length > 0

  useEffect(() => {
    if (!playing || !result) return
    let frameId = 0
    lastTick.current = performance.now()
    const tick = (now: number) => {
      const delta = (now - lastTick.current) / 1000 * speed
      lastTick.current = now
      setElapsedSeconds((current) => {
        const next = Math.min(result.durationSeconds, current + delta)
        if (next >= result.durationSeconds) setPlaying(false)
        return next
      })
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [playing, result, speed])

  const startRun = () => {
    if (hasValidationErrors) return
    const next = run({ architecture: project.architecture, equipment: variant.equipment, scenario })
    setResult(next); setElapsedSeconds(0); setPlaying(false)
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
        {result ? <>
          <SimulationScene result={result} elapsedSeconds={elapsedSeconds} architecture={project.architecture} equipment={variant.equipment} layers={layers} followRole={followRole} />
          <PlaybackControls elapsedSeconds={elapsedSeconds} durationSeconds={result.durationSeconds} playing={playing} speed={speed} onPlaying={setPlaying} onElapsed={setElapsedSeconds} onSpeed={setSpeed} />
        </> : <div className="simulation-empty"><div className="service-orbit" aria-hidden="true"><span /><span /><span /><span /><span /></div><h2>Pressure-test this layout</h2><p>Run the approved five-person dinner scenario to see routes, queues, station pressure, and dirty/clean crossings.</p><button type="button" disabled={hasValidationErrors} onClick={startRun}>Start pressure test</button></div>}
      </div>
      <div className="simulation-sidebar">
        <ScenarioEditor scenario={scenario} onChange={(patch) => { store.getState().updateScenario(scenario.id, patch); setResult(null); setPlaying(false) }} />
        {result && <><Scorecard result={result} /><FindingsPanel result={result} /></>}
        <aside className="simulation-assumptions" aria-label="Simulation assumptions"><strong>{scenario.covers} covers over {scenario.durationMinutes} minutes · {staffCount} staff · seed {scenario.seed}</strong><p>Mostly cooked to order ({Math.round(scenario.cookToOrderRatio * 100)}%). Durations are planning estimates and should be tuned after menu trials.</p><p className="disclaimer">Comparative planning aid — verify fire, ventilation, hygiene, accessibility, and worker safety with qualified local professionals.</p></aside>
      </div>
    </section>
  )
}
