import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { createBrowserAutoLayoutRunner } from '../features/optimizer/browser-auto-layout-runner'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { configureWorkspaceAutoLayout, getWorkspaceFacade, getActiveVariant, projectStore } from '../state/project-store'
import { AppHeader, StageToolbar } from './AppHeader'
import { ProjectStartScreen } from './ProjectStartScreen'
import { createBlankProject } from '../domain/blank-project'
import { createSeedProject } from '../domain/seed-project'
import { AgentToolsPanel } from '../features/webmcp/AgentToolsPanel'
import { WebMcpProvider } from '../features/webmcp/WebMcpProvider'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from './workflow'
import { ErrorBoundary } from './ErrorBoundary'
import { HelpDialog } from './HelpDialog'
import { CURRENT_PROJECT_KEY, LAST_GOOD_PROJECT_KEY, LEGACY_CURRENT_PROJECT_KEY, LEGACY_LAST_GOOD_PROJECT_KEY } from '../state/persistence'
import './styles.css'

export const SESSION_FLAG_KEY = 'calmkitchen-designer:session'

const PlanWorkspace = lazy(() => import('../features/editor/PlanWorkspace').then((module) => ({ default: module.PlanWorkspace })))
const SceneWorkspace = lazy(() => import('../features/scene/SceneWorkspace').then((module) => ({ default: module.SceneWorkspace })))
const SimulationWorkspace = lazy(() => import('../features/simulation/SimulationWorkspace').then((module) => ({ default: module.SimulationWorkspace })))
const CompareWorkspace = lazy(() => import('../features/compare/CompareWorkspace').then((module) => ({ default: module.CompareWorkspace })))
const AutoLayoutWorkspace = lazy(() => import('../features/optimizer/AutoLayoutWorkspace').then((module) => ({ default: module.AutoLayoutWorkspace })))

export type WorkspaceView = ViewMode

void Promise.all([
  import('../features/simulation/SimulationWorkspace'),
  import('../features/compare/CompareWorkspace'),
  import('../features/optimizer/AutoLayoutWorkspace'),
])

export function App() {
  const [stage, setStage] = useState<WorkflowStage>('space')
  const [view, setView] = useState<ViewMode>('plan')
  const [overlay, setOverlay] = useState<WorkspaceOverlay>(null)
  const project = useStore(projectStore, (state) => state.project)
  const selectedIds = useStore(projectStore, (state) => state.selectedIds)
  const selectedItem = useStore(projectStore, (state) => getActiveVariant(state).equipment.find((item) => item.id === state.selectedIds[0]))
  const canUndo = useStore(projectStore, (state) => state.past.length > 0)
  const canRedo = useStore(projectStore, (state) => state.future.length > 0)

  const [showReference, setShowReference] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStartsAtRoom, setWizardStartsAtRoom] = useState(false)
  const [essentialsOpen, setEssentialsOpen] = useState(false)
  const [revisionsOpen, setRevisionsOpen] = useState(false)
  const [sourceImageUrl, setSourceImageUrl] = useState('/reference/kitchen-sketch.png')
  const [closedLayout, setClosedLayout] = useState<{ name: string; revision: number; undo(): boolean } | null>(null)
  const [showStartScreen, setShowStartScreen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const hasSession = typeof localStorage !== 'undefined' && Boolean(
      localStorage.getItem(SESSION_FLAG_KEY)
      ?? localStorage.getItem(CURRENT_PROJECT_KEY)
      ?? localStorage.getItem(LAST_GOOD_PROJECT_KEY)
      ?? localStorage.getItem(LEGACY_CURRENT_PROJECT_KEY)
      ?? localStorage.getItem(LEGACY_LAST_GOOD_PROJECT_KEY),
    )
    if (!hasSession) setShowStartScreen(true)
  }, [])

  const beginSession = () => {
    localStorage.setItem(SESSION_FLAG_KEY, '1')
    setShowStartScreen(false)
  }
  const [aiToolsOpen, setAiToolsOpen] = useState(false)

  const dragResizeEnabled = Boolean(selectedItem && !selectedItem.dimensionsLocked)
  const canCompare = project.variants.length >= 2 || project.scenarios.length >= 2
  const showAutoLayout = stage !== 'space'

  const essentialsCount = useMemo(() => {
    const variant = getActiveVariant(projectStore.getState())
    const scenario = project.scenarios.find((entry) => entry.id === project.activeScenarioId) ?? project.scenarios[0]
    if (!scenario) return 0
    return evaluateOperationalRequirements({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
      layoutConstraints: variant.layoutConstraints,
    }).filter((result) => result.severity !== 'professional-review').length
  }, [project])

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

  const openWizard = () => { setWizardStartsAtRoom(false); setWizardOpen(true) }

  useEffect(() => {
    if (showStartScreen) return
    projectStore.getState().captureWorkingSnapshot()
  }, [stage, showStartScreen])

  const focusTourStep = (step: number) => {
    setOverlay(null)
    if (step === 0) { setStage('space'); setView('plan') }
    else if (step === 1) { setStage('equipment'); setView('plan') }
    else if (step === 2) { setStage('simulate') }
    else if (step === 3) { setOverlay('compare') }
    else { setStage('equipment'); setView('plan') }
  }

  return (
    <WebMcpProvider>
      <main className="app-shell" data-app="calmkitchen-designer" data-app-stage={stage} data-app-view={view} data-app-overlay={overlay ?? 'none'}>
        <AppHeader
          minimal={showStartScreen}
          store={projectStore}
          view={view}
          stage={stage}
          overlay={overlay}
          canCompare={canCompare}
          showAutoLayout={showAutoLayout}
          onViewChange={setView}
          onStageChange={setStage}
          onOpenCompare={() => setOverlay((current) => current === 'compare' ? null : 'compare')}
          onOpenAutoLayout={() => setOverlay((current) => current === 'auto-layout' ? null : 'auto-layout')}
          aiToolsOpen={aiToolsOpen}
          onOpenAiTools={() => setAiToolsOpen((open) => !open)}
          onTourFocus={focusTourStep}
          onCloseOverlay={() => setOverlay(null)}
        onNewProject={() => {
          projectStore.getState().replaceProject(createBlankProject())
          setStage('space')
          setView('plan')
          setOverlay(null)
          setShowStartScreen(true)
        }}
        onOpenSettings={() => { setInspectorOpen(true); setRevisionsOpen(false); setEssentialsOpen(false) }}
      />
      <ErrorBoundary>
        <Suspense fallback={<section className="workspace-placeholder">Loading workspace…</section>}>
          {showStartScreen ? (
            <ProjectStartScreen
              onCreateRoom={(architecture) => {
                projectStore.getState().applySharedArchitecture(architecture)
                beginSession()
                setStage('space')
              }}
              onScratch={() => { projectStore.getState().replaceProject(createBlankProject()); setStage('space'); setView('plan') }}
              onStarterKitchen={() => { projectStore.getState().replaceProject(createSeedProject()); beginSession(); setStage('space'); setView('plan') }}
              onDrawManually={() => { beginSession(); setStage('space'); setWizardOpen(true); setWizardStartsAtRoom(true) }}
              onTraceImage={(url) => { beginSession(); setSourceImageUrl(url); setShowReference(true); setStage('space') }}
              onOpenProject={(opened) => { projectStore.getState().replaceProject(opened); beginSession(); setStage('space') }}
            />
          ) : (
          <section className={`workspace-surfaces${view === 'split' && overlay === null && stage !== 'simulate' ? ' split-workspace' : ''}`}>
            {overlay === 'compare' && <div className="workspace-surface active"><CompareWorkspace /></div>}
            {overlay === 'auto-layout' && <div className="workspace-surface active"><AutoLayoutWorkspace runner={autoLayoutRunner} /></div>}
            {overlay === null && stage === 'simulate' && <div className="workspace-surface active"><SimulationWorkspace /></div>}
            {overlay === null && stage !== 'simulate' && view === 'plan' && (
              <div className="canvas-toolbar-wrap">
                <StageToolbar
                  store={projectStore}
                  stage={stage}
                  catalogOpen={catalogOpen}
                  inspectorOpen={inspectorOpen}
                  essentialsCount={essentialsCount}
                  showReference={showReference}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  dragResizeEnabled={dragResizeEnabled}
                  hasSelection={selectedIds.length > 0}
                  onToggleCatalog={() => setCatalogOpen((open) => !open)}
                  onToggleInspector={() => setInspectorOpen((open) => !open)}
                  onOpenEssentials={() => { setEssentialsOpen(true); setRevisionsOpen(false); setInspectorOpen(true) }}
                  onOpenRevisions={() => { setInspectorOpen(true); setRevisionsOpen(true); setEssentialsOpen(false) }}
                  onUndo={() => projectStore.getState().undo()}
                  onRedo={() => projectStore.getState().redo()}
                  onToggleReference={() => setShowReference((value) => !value)}
                  onRotateLeft={() => projectStore.getState().rotateItems(selectedIds, -90)}
                  onRotateRight={() => projectStore.getState().rotateItems(selectedIds, 90)}
                  onToggleResize={() => selectedItem && projectStore.getState().setDimensionsLocked(selectedItem.id, !selectedItem.dimensionsLocked)}
                  onAddLayout={openWizard}
                  onClosedLayout={(closed) => setClosedLayout(closed)}
                />
              </div>
            )}
            {overlay === null && stage !== 'simulate' && (
              <>
                <div
                  className={`workspace-surface plan-surface${view === 'plan' || view === 'split' ? ' active' : ''}`}
                  data-workspace-surface="plan"
                  aria-hidden={view !== 'plan' && view !== 'split'}
                >
                  <PlanWorkspace
                    store={projectStore}
                    stage={stage}
                    compact={view === 'split'}
                    shortcutEnabled={view === 'plan' || view === 'scene' || view === 'split'}
                    showReference={showReference}
                    catalogOpen={catalogOpen}
                    inspectorOpen={inspectorOpen}
                    essentialsOpen={essentialsOpen}
                    revisionsOpen={revisionsOpen}
                    sourceImageUrl={sourceImageUrl}
                    wizardOpen={wizardOpen}
                    wizardStartsAtRoom={wizardStartsAtRoom}
                    closedLayout={closedLayout}
                    onInspectComponentIn3D={() => setView('scene')}
                    onStageChange={setStage}
                    onCatalogOpenChange={setCatalogOpen}
                    onInspectorOpenChange={setInspectorOpen}
                    onEssentialsOpenChange={setEssentialsOpen}
                    onRevisionsOpenChange={setRevisionsOpen}
                    onSourceImageUrlChange={setSourceImageUrl}
                    onWizardOpenChange={setWizardOpen}
                    onWizardStartsAtRoomChange={setWizardStartsAtRoom}
                    onClosedLayoutChange={setClosedLayout}
                    onAddLayout={openWizard}
                  />
                </div>
                <div
                  className={`workspace-surface scene-surface${view === 'scene' || view === 'split' ? ' active' : ''}`}
                  data-workspace-surface="scene"
                  aria-hidden={view !== 'scene' && view !== 'split'}
                >
                  <SceneWorkspace compact={view === 'split'} />
                </div>
              </>
            )}
          </section>
          )}
        </Suspense>
        {aiToolsOpen && <AgentToolsPanel onClose={() => setAiToolsOpen(false)} />}
      </ErrorBoundary>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      <footer className="app-footer">
        <span className="footer-brand">
          <svg viewBox="0 0 214.2 214.2" aria-hidden="true"><path fill="#b1d15b" d="M190.1,0l-27.9,45.9c-3.5,5.7-9.8,9.4-16.6,9.4h-76.8c-6.8,0-13.3-3.7-16.8-9.4L24.4,0H0v214.2h24.4l27.7-45.6c3.5-5.9,10-9.4,16.8-9.4h76.8c6.8,0,13.1,3.5,16.6,9.4l27.9,45.6h24.2V0h-24.2ZM133,133.2h-51.9v-51.8h51.9v51.8Z"/></svg>
          CalmKitchen Designer <span style={{ fontWeight: 400 }}>by HotelOS</span>
        </span>
        <span className="footer-sep" aria-hidden="true"></span>
        <span className="footer-tag">Use your own agents and AI to help design your commercial kitchen</span>
        <span className="footer-right">
          <button type="button" className="link-button" onClick={() => setHelpOpen(true)}>How to</button>
          <span className="footer-sep" aria-hidden="true"></span>
          <a href="https://hotelos.ai/kitchen" target="_blank" rel="noreferrer">hotelos.ai/kitchen</a>
          <span className="footer-sep" aria-hidden="true"></span>
          <a href="https://kitchen.hotelos.ai" target="_blank" rel="noreferrer">CalmKitchen home</a>
        </span>
      </footer>
      </main>
    </WebMcpProvider>
  )
}
