import { useState, type ChangeEvent } from 'react'
import { useStore } from 'zustand'
import { exportProject, importProject } from '../state/persistence'
import { projectStore, type ProjectStore } from '../state/project-store'

export function ProjectExchange({ store = projectStore }: { store?: ProjectStore }) {
  const project = useStore(store, (state) => state.project)
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const onExport = () => {
    try {
      const blob = new Blob([exportProject(project)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const revoke = URL.revokeObjectURL.bind(URL)
      const link = document.createElement('a')
      link.href = url
      link.download = 'hotelos-kitchen-planner.json'
      link.click()
      setTimeout(() => revoke(url), 0)
      setMessage({ kind: 'status', text: 'All layouts exported.' })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Export failed' }) }
  }
  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      store.getState().replaceProject(importProject(await file.text()))
      setMessage({ kind: 'status', text: `Imported ${file.name}.` })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Import failed' }) }
    event.target.value = ''
  }
  return (
    <div className="project-exchange">
      <button type="button" onClick={onExport}>Export all layouts</button>
      <label className="import-project">Import<input type="file" accept="application/json,.json" aria-label="Import project JSON" onChange={onImport} /></label>
      <button type="button" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)} aria-label="Keyboard help">?</button>
      {showHelp && <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts"><strong>Keyboard shortcuts</strong><span>Arrow keys · move by snap</span><span>Shift + arrows · move by 5× snap</span><span>⌘/Ctrl Z · undo</span><span>⌘/Ctrl Shift Z or Ctrl Y · redo</span><span>⌘/Ctrl D · duplicate</span><span>[ / ] · rotate left / right</span><span>Delete · remove</span><span>Escape · close transient UI, then clear selection</span></div>}
      {message && <div className={`exchange-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}<button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
    </div>
  )
}
