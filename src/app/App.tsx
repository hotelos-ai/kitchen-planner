import { useState } from 'react'
import './styles.css'

export type WorkspaceView = 'plan' | 'scene' | 'split' | 'simulate' | 'compare'

const VIEW_LABELS: Record<WorkspaceView, string> = {
  plan: 'Plan',
  scene: '3D',
  split: 'Split',
  simulate: 'Simulate',
  compare: 'Compare',
}

export function App() {
  const [view, setView] = useState<WorkspaceView>('plan')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">MR</span>
          <div>
            <h1>Manta Raja Kitchen Lab</h1>
            <p>Metric kitchen planning and service simulation</p>
          </div>
        </div>
        <nav aria-label="Workspace views" className="view-switcher">
          {(Object.keys(VIEW_LABELS) as WorkspaceView[]).map((next) => (
            <button
              key={next}
              type="button"
              aria-pressed={view === next}
              onClick={() => setView(next)}
            >
              {VIEW_LABELS[next]}
            </button>
          ))}
        </nav>
      </header>
      <section aria-live="polite" className="workspace-placeholder">
        <span>{VIEW_LABELS[view]} workspace</span>
      </section>
    </main>
  )
}
