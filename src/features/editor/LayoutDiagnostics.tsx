import { useState } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { fixByBoundary, fixByRearranging } from './auto-fix'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export function LayoutDiagnostics({ store }: { store: ProjectStore }) {
  const variant = useStore(store, getActiveVariant)
  const project = useStore(store, (state) => state.project)
  const [fixOpen, setFixOpen] = useState(false)
  const issues = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  const fixEquipment = () => {
    const moves = fixByRearranging(variant.architecture, variant.equipment, project.snapMm)
    store.getState().applyEquipmentMoves(moves)
    setFixOpen(false)
  }
  const fixBoundary = () => {
    const next = fixByBoundary(variant.architecture, variant.equipment, project.snapMm)
    store.getState().applySharedArchitecture(next)
    setFixOpen(false)
  }
  return (
    <section className="layout-diagnostics" aria-label="Layout checks">
      <div><span className="eyebrow">Checks</span><strong>{issues.length ? `${issues.length} items to inspect` : 'No geometry conflicts'}</strong></div>
      {issues.length > 0 && (
        <button type="button" className="autofix-button" onClick={() => setFixOpen((open) => !open)}>Auto-fix…</button>
      )}
      {issues.length > 0 && fixOpen && (
        <div className="autofix-dialog" role="dialog" aria-label="Choose an auto-fix">
          <p>This layout has {issues.length} geometric conflict{issues.length === 1 ? '' : 's'} (items outside the room, overlaps, or blocked clearances). How would you like to fix it?</p>
          <button type="button" onClick={fixEquipment}>
            <strong>Rearrange the equipment</strong>
            <span>Keeps the room as drawn; moves items back inside and out of each other's way.</span>
          </button>
          <button type="button" onClick={fixBoundary}>
            <strong>Adjust the room boundary</strong>
            <span>Keeps equipment where it is; nudges the walls outward just enough to fit everything.</span>
          </button>
          <button type="button" className="link-button" onClick={() => setFixOpen(false)}>Not now</button>
        </div>
      )}
      {issues.length > 0 && <details><summary>See gaps and conflicts</summary><div>{issues.slice(0, 10).map((issue) => <button type="button" key={issue.id} className={issue.severity} onClick={() => store.getState().selectItems(issue.itemIds)}><strong>{issue.title}</strong><span>{issue.message}</span></button>)}</div></details>}
    </section>
  )
}
