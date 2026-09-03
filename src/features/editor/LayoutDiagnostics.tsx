import { useState } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export function LayoutDiagnostics({ store }: { store: ProjectStore }) {
  const variant = useStore(store, getActiveVariant)
  const project = useStore(store, (state) => state.project)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const issues = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  const blockers = issues.filter((issue) => issue.severity === 'error')
  const resetWorking = () => {
    const result = store.getState().resetToWorkingSnapshot()
    setResetNotice(result.restored
      ? result.parked > 0
        ? `Reset to the last working version. ${result.parked} item${result.parked === 1 ? '' : 's'} that did not fit were moved to the side of the plan.`
        : 'Reset to the last working version.'
      : 'No working version saved yet.')
  }
  return (
    <section className="layout-diagnostics" aria-label="Layout checks">
      <div><span className="eyebrow">Checks</span><strong>{blockers.length ? `${blockers.length} blocking conflict${blockers.length === 1 ? '' : 's'}` : 'Ready · no blocking conflicts'}</strong></div>
      {project.lastWorking && (
        <button type="button" className="autofix-reset" onClick={resetWorking}>Reset to last working version</button>
      )}
      {resetNotice && <p className="autofix-notice" role="status">{resetNotice}<button type="button" aria-label="Dismiss notice" onClick={() => setResetNotice(null)}>×</button></p>}
      {issues.length > 0 && <details><summary>Review details · {issues.length}</summary><div>{issues.slice(0, 10).map((issue) => <button type="button" key={issue.id} className={issue.severity} onClick={() => store.getState().selectItems(issue.itemIds)}><strong>{issue.title}</strong><span>{issue.message}</span></button>)}</div></details>}
    </section>
  )
}
