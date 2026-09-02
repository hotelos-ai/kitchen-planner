import { useState } from 'react'
import { useStore } from 'zustand'
import type { DisplayUnit } from '../domain/project'
import { exportProject } from '../state/persistence'
import { projectStore, type ProjectStore } from '../state/project-store'

type Props = {
  store?: ProjectStore
  onNewProject(): void
  onOpenSettings(): void
}

export function ProjectMenu({ store = projectStore, onNewProject, onOpenSettings }: Props) {
  const project = useStore(store, (state) => state.project)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const saveCopy = () => {
    const blob = new Blob([exportProject(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copy.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setOpen(false)
  }

  return (
    <div className="project-context">
      <button type="button" className="project-name-button" aria-label="Project menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {project.name} ▾
      </button>
      <span className="save-state">Saved on this device</span>
      {open && (
        <div className="project-menu" role="menu" aria-label="Project menu">
          {renaming ? (
            <form onSubmit={(event) => { event.preventDefault(); store.getState().renameProject(draft); setRenaming(false); setOpen(false) }}>
              <input aria-label="Rename project" value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
              <button type="submit">Save name</button>
            </form>
          ) : (
            <button type="button" role="menuitem" onClick={() => { setDraft(project.name); setRenaming(true) }}>Rename project</button>
          )}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings() }}>Project profile</button>
          <label role="menuitem">Units
            <select aria-label="Project display units" value={project.displayUnit} onChange={(event) => store.getState().setDisplayUnit(event.target.value as DisplayUnit)}>
              <option value="mm">Millimetres</option>
              <option value="cm">Centimetres</option>
              <option value="in">Inches</option>
              <option value="ft">Feet + inches</option>
            </select>
          </label>
          <button type="button" role="menuitem" onClick={saveCopy}>Save a copy</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings() }}>Project settings</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onNewProject() }}>New project</button>
        </div>
      )}
    </div>
  )
}
