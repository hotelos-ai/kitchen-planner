import { lazy, Suspense, useState } from 'react'
import './styles.css'

const PlanWorkspace = lazy(() => import('../features/editor/PlanWorkspace').then((module) => ({ default: module.PlanWorkspace })))
const SceneWorkspace = lazy(() => import('../features/scene/SceneWorkspace').then((module) => ({ default: module.SceneWorkspace })))
const SimulationWorkspace = lazy(() => import('../features/simulation/SimulationWorkspace').then((module) => ({ default: module.SimulationWorkspace })))
const CompareWorkspace = lazy(() => import('../features/compare/CompareWorkspace').then((module) => ({ default: module.CompareWorkspace })))

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
      <Suspense fallback={<section className="workspace-placeholder">Loading workspace…</section>}>
        {view === 'plan' && <PlanWorkspace />}
        {view === 'scene' && <SceneWorkspace />}
        {view === 'split' && <section className="split-workspace"><PlanWorkspace compact /><SceneWorkspace compact /></section>}
        {view === 'simulate' && <SimulationWorkspace />}
        {view === 'compare' && <CompareWorkspace />}
      </Suspense>
    </main>
  )
}
