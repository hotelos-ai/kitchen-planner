import { useStore } from 'zustand'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export function LayoutDiagnostics({ store }: { store: ProjectStore }) {
  const variant = useStore(store, getActiveVariant)
  const issues = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  return (
    <section className="layout-diagnostics" aria-label="Layout checks">
      <div><span className="eyebrow">Checks</span><strong>{issues.length ? `${issues.length} items to inspect` : 'No geometry conflicts'}</strong></div>
      {issues.length > 0 && <details><summary>See gaps and conflicts</summary><div>{issues.slice(0, 10).map((issue) => <button type="button" key={issue.id} className={issue.severity} onClick={() => store.getState().selectItems(issue.itemIds)}><strong>{issue.title}</strong><span>{issue.message}</span></button>)}</div></details>}
    </section>
  )
}
