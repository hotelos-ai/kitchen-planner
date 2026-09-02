import { lazy, Suspense, useMemo, useState } from 'react'
import { createBrowserAutoLayoutRunner } from '../features/optimizer/browser-auto-layout-runner'
import { configureWorkspaceAutoLayout, getWorkspaceFacade, projectStore } from '../state/project-store'
import { ErrorBoundary } from './ErrorBoundary'
import { ProjectExchange } from './ProjectExchange'
import './styles.css'

const PlanWorkspace = lazy(() => import('../features/editor/PlanWorkspace').then((module) => ({ default: module.PlanWorkspace })))
const SceneWorkspace = lazy(() => import('../features/scene/SceneWorkspace').then((module) => ({ default: module.SceneWorkspace })))
const SimulationWorkspace = lazy(() => import('../features/simulation/SimulationWorkspace').then((module) => ({ default: module.SimulationWorkspace })))
const CompareWorkspace = lazy(() => import('../features/compare/CompareWorkspace').then((module) => ({ default: module.CompareWorkspace })))
const AutoLayoutWorkspace = lazy(() => import('../features/optimizer/AutoLayoutWorkspace').then((module) => ({ default: module.AutoLayoutWorkspace })))

export type WorkspaceView = 'plan' | 'scene' | 'split' | 'simulate' | 'compare' | 'auto-layout'

void Promise.all([
  import('../features/simulation/SimulationWorkspace'),
  import('../features/compare/CompareWorkspace'),
  import('../features/optimizer/AutoLayoutWorkspace'),
])

const VIEW_LABELS: Record<WorkspaceView, string> = {
  plan: 'Plan',
  scene: '3D',
  split: 'Split',
  simulate: 'Simulate',
  compare: 'Compare',
  'auto-layout': 'Auto-layout',
}

export function App() {
  const [view, setView] = useState<WorkspaceView>('plan')
  const autoLayoutRunner = useMemo(() => {
    const browserRunner = createBrowserAutoLayoutRunner(projectStore)
    configureWorkspaceAutoLayout(projectStore, {
      run: (input) => {
        const envelope = input as { request: Parameters<typeof browserRunner.run>[0]; onProgress?: Parameters<typeof browserRunner.run>[1] }
        return browserRunner.run(envelope.request, envelope.onProgress ?? (() => undefined))
      },
      cancel: () => { browserRunner.cancel?.(); return { ok: true } },
    })
    const facade = getWorkspaceFacade(projectStore)
    return {
      run: (request: Parameters<typeof browserRunner.run>[0], onProgress: Parameters<typeof browserRunner.run>[1]) => facade.runAutoLayout({ request, onProgress }) as ReturnType<typeof browserRunner.run>,
      cancel: () => facade.cancelRun({ runId: 'active-auto-layout' }),
    }
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">KP</span>
          <div>
            <h1>Kitchen Planner</h1>
            <p>Commercial kitchen planning and service simulation</p>
          </div>
        </div>
        <ProjectExchange />
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
      <ErrorBoundary>
        <Suspense fallback={<section className="workspace-placeholder">Loading workspace…</section>}>
          <section className={`workspace-surfaces${view === 'split' ? ' split-workspace' : ''}`}>
            <div
              className={`workspace-surface plan-surface${view === 'plan' || view === 'split' ? ' active' : ''}`}
              data-workspace-surface="plan"
              aria-hidden={view !== 'plan' && view !== 'split'}
            >
              <PlanWorkspace compact={view === 'split'} shortcutEnabled={view === 'plan' || view === 'scene' || view === 'split'} onInspectComponentIn3D={() => setView('scene')} />
            </div>
            <div
              className={`workspace-surface scene-surface${view === 'scene' || view === 'split' ? ' active' : ''}`}
              data-workspace-surface="scene"
              aria-hidden={view !== 'scene' && view !== 'split'}
            >
              <SceneWorkspace compact={view === 'split'} />
            </div>
            {view === 'simulate' && <div className="workspace-surface active"><SimulationWorkspace /></div>}
            {view === 'compare' && <div className="workspace-surface active"><CompareWorkspace /></div>}
            {view === 'auto-layout' && <div className="workspace-surface active"><AutoLayoutWorkspace runner={autoLayoutRunner} /></div>}
          </section>
        </Suspense>
      </ErrorBoundary>
    </main>
  )
}
