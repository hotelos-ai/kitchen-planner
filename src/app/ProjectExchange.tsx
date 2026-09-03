import { useEffect, useState, type ChangeEvent } from 'react'
import { useStore } from 'zustand'
import { exportProject, importProject } from '../state/persistence'
import { projectStore, type ProjectStore } from '../state/project-store'
import { downloadArtifact, projectArtifact } from '../webmcp/project-artifacts'
import { appStateStore } from '../state/app-state-store'
import { selectSimulationRun, simulationRunStore, type SimulationRunStore } from '../state/simulation-run-store'
import { buildWorkspaceDeepLink } from './workspace-deep-link'

const TOUR_STEPS = [
  { title: 'Define the space', body: 'Drag the room outline to reshape it, or add doors, service windows, and pillars. The floor plan is shared by every layout.' },
  { title: 'Fit out the kitchen', body: 'Add equipment from the library or drop in a station template. Select anything to inspect and configure it.' },
  { title: 'Simulate service', body: 'Run a dinner peak to see queues, staff walking, and bottlenecks — deterministically, with playback.' },
  { title: 'Compare layouts', body: 'With two layouts or scenarios, Compare shows metric deltas and evidence-backed findings side by side.' },
  { title: 'Save your project', body: 'Save project downloads a resumable file. Export covers PDFs, equipment schedules, and reports.' },
] as const

function downloadText(filename: string, contents: string, type = 'application/json') {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ProjectExchange({ store = projectStore, runStore = simulationRunStore, onTourFocus }: { store?: ProjectStore; runStore?: SimulationRunStore; onTourFocus?(step: number): void }) {
  const project = useStore(store, (state) => state.project)
  const revision = useStore(store, (state) => state.revision)
  const storedRun = useStore(runStore, (state) => selectSimulationRun(state, project.activeVariantId, project.activeScenarioId))
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)

  useEffect(() => {
    if (tourStep !== null) onTourFocus?.(tourStep)
  }, [tourStep, onTourFocus])

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const onExport = () => {
    try {
      downloadText(`${slug}.json`, exportProject(project))
      setMessage({ kind: 'status', text: 'Project saved.' })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Save failed' }) }
  }
  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      store.getState().replaceProject(importProject(await file.text()))
      setMessage({ kind: 'status', text: `Opened ${file.name}.` })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Open failed' }) }
    event.target.value = ''
  }
  const exportSchedule = () => {
    const variant = project.variants.find((entry) => entry.id === project.activeVariantId) ?? project.variants[0]
    downloadArtifact(projectArtifact({ project, variant, revision, format: 'equipment-schedule-csv' }))
    setShowExport(false)
    setMessage({ kind: 'status', text: 'Equipment schedule exported.' })
  }
  const exportReport = () => {
    const variant = project.variants.find((entry) => entry.id === project.activeVariantId) ?? project.variants[0]
    const scenario = project.scenarios.find((entry) => entry.id === project.activeScenarioId) ?? project.scenarios[0]
    downloadArtifact(projectArtifact({
      project,
      variant,
      revision,
      format: 'report-html',
      scenario,
      simulation: storedRun?.ranAtRevision === revision ? storedRun.result : null,
    }))
    setShowExport(false)
    setMessage({ kind: 'status', text: 'Report exported.' })
  }
  const copyWorkspaceLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
      const appState = appStateStore.getState()
      await navigator.clipboard.writeText(buildWorkspaceDeepLink({
        projectId: project.id,
        variantId: project.activeVariantId,
        scenarioId: project.activeScenarioId,
        stage: appState.stage,
        view: appState.view,
        overlay: appState.overlay,
        selectedIds: store.getState().selectedIds,
      }))
      setShowExport(false)
      setMessage({ kind: 'status', text: 'Workspace link copied. It reopens this saved project in this browser.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not copy workspace link.' })
    }
  }
  return (
    <div className="project-exchange">
      <button type="button" onClick={onExport} title="Download the complete project so it can be opened again later.">Save project</button>
      <label className="import-project">Open project<input type="file" accept="application/json,.json" aria-label="Open project JSON" onChange={onImport} /></label>
      <div className="export-menu">
        <button type="button" aria-expanded={showExport} onClick={() => setShowExport((value) => !value)}>Export</button>
        {showExport && (
          <div className="shortcut-popover export-popover" role="menu" aria-label="Export">
            <button type="button" role="menuitem" onClick={onExport}>Save project file</button>
            <button type="button" role="menuitem" onClick={() => { window.print(); setShowExport(false) }}>Export current plan as PDF</button>
            <button type="button" role="menuitem" onClick={() => { window.print(); setShowExport(false) }}>Export all layouts as PDF</button>
            <button type="button" role="menuitem" onClick={exportSchedule}>Export equipment schedule</button>
            <button type="button" role="menuitem" onClick={exportReport}>Export simulation report</button>
            <button type="button" role="menuitem" onClick={() => void copyWorkspaceLink()}>Copy workspace link</button>
          </div>
        )}
      </div>
      <button type="button" className="icon-btn" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)} aria-label="Help and keyboard shortcuts">?</button>
      {showHelp && (
        <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts">
          <strong>Keyboard shortcuts</strong>
          <span>1 / 2 / 3 · Space / Equipment / Simulate</span>
          <span>Arrow keys · move by snap</span>
          <span>Shift + arrows · move by 5× snap</span>
          <span>⌘/Ctrl Z · undo</span>
          <span>⌘/Ctrl Shift Z or Ctrl Y · redo</span>
          <span>⌘/Ctrl D · duplicate</span>
          <span>[ / ] · rotate left / right</span>
          <span>Delete · remove</span>
          <span>Escape · close transient UI, then clear selection</span>
          <span>Guided path: Space → Equipment → Simulate → Compare → Save project</span>
          <button type="button" onClick={() => { setShowHelp(false); setTourStep(0) }}>Start guided tour</button>
        </div>
      )}
      {message && <div className={`exchange-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}<button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
      {tourStep !== null && (
        <div className="guided-tour" role="dialog" aria-label="Guided tour">
          <div className="tour-head">
            <span className="eyebrow">Guided tour · {tourStep + 1} of {TOUR_STEPS.length}</span>
            <button type="button" className="tour-close" aria-label="Close tour" onClick={() => setTourStep(null)}>×</button>
          </div>
          <strong>{TOUR_STEPS[tourStep].title}</strong>
          <p>{TOUR_STEPS[tourStep].body}</p>
          <div className="tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((_, index) => (
              <i key={index} className={index === tourStep ? 'current' : index < tourStep ? 'done' : ''} />
            ))}
          </div>
          <footer>
            <button type="button" className="link-button" onClick={() => setTourStep(null)}>End tour</button>
            <span className="tour-nav">
              {tourStep > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setTourStep((step) => (step ?? 1) - 1)}>Back</button>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTourStep((step) => (step === TOUR_STEPS.length - 1 ? null : (step ?? 0) + 1))}>
                {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </span>
          </footer>
        </div>
      )}
    </div>
  )
}
