import { useState, type ChangeEvent } from 'react'
import { useStore } from 'zustand'
import { exportProject, importProject } from '../state/persistence'
import { projectStore, type ProjectStore } from '../state/project-store'

function downloadText(filename: string, contents: string, type = 'application/json') {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ProjectExchange({ store = projectStore }: { store?: ProjectStore }) {
  const project = useStore(store, (state) => state.project)
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
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
    const rows = ['Item,Category,Width mm,Depth mm,X mm,Y mm', ...variant.equipment.map((item) => `${item.label},${item.category},${item.widthMm},${item.depthMm},${item.xMm},${item.yMm}`)]
    downloadText(`${slug}-equipment-schedule.csv`, rows.join('\n'), 'text/csv')
    setShowExport(false)
    setMessage({ kind: 'status', text: 'Equipment schedule exported.' })
  }
  const exportReport = () => {
    const html = `<!doctype html><html><head><title>${project.name}</title></head><body><h1>${project.name}</h1><p>${project.variants.length} layouts · ${project.scenarios.length} scenarios</p></body></html>`
    downloadText(`${slug}-report.html`, html, 'text/html')
    setShowExport(false)
    setMessage({ kind: 'status', text: 'Report exported.' })
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
            <button type="button" role="menuitem" onClick={() => { window.print(); setShowExport(false) }}>Export current view as image</button>
          </div>
        )}
      </div>
      <button type="button" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)} aria-label="Help and keyboard shortcuts">?</button>
      {showHelp && (
        <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts">
          <strong>Keyboard shortcuts</strong>
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
          <strong>{['Define the space', 'Arrange equipment', 'Simulate service', 'Compare layouts', 'Save your project'][tourStep]}</strong>
          <p>{[
            'Start in Space to draw walls, doors and fixed objects. The room is shared by every layout.',
            'Switch to Equipment and add items or a station template. Space stays locked until you return.',
            'Simulate a dinner peak to see queues, walking and bottlenecks.',
            'Compare appears once you have two layouts or scenarios.',
            'Use Save project to download a resumable file. Export is for PDF, schedules and reports.',
          ][tourStep]}</p>
          <footer>
            <button type="button" onClick={() => setTourStep(null)}>Close tour</button>
            {tourStep > 0 && <button type="button" onClick={() => setTourStep((step) => (step ?? 1) - 1)}>Back</button>}
            {tourStep < 4 && <button type="button" onClick={() => setTourStep((step) => (step ?? 0) + 1)}>Next</button>}
          </footer>
        </div>
      )}
    </div>
  )
}
