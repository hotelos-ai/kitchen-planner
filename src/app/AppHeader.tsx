import { useEffect, useMemo } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../domain/layout-diagnostics'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { validateSimulationInput } from '../simulation/validation'
import { getActiveVariant, projectStore, type ProjectStore } from '../state/project-store'
import { formatBaseSpaceLabel, formatLayoutTabLabel } from './layout-labels'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from './workflow'
import { VIEW_MODES, WORKFLOW_STAGES, workflowStageFromDigit } from './workflow'
import { LayoutVariants, type ClosedLayout } from '../features/editor/LayoutVariants'
import { ProjectExchange } from './ProjectExchange'
import { ProjectMenu } from './ProjectMenu'

export type StageToolbarProps = {
  store: ProjectStore
  stage: WorkflowStage
  catalogOpen: boolean
  inspectorOpen: boolean
  essentialsCount: number
  showReference: boolean
  canUndo: boolean
  canRedo: boolean
  dragResizeEnabled: boolean
  hasSelection: boolean
  onToggleCatalog(): void
  onToggleInspector(): void
  onOpenEssentials(): void
  onUndo(): void
  onRedo(): void
  onToggleReference(): void
  onRotateLeft(): void
  onRotateRight(): void
  onToggleResize(): void
  onAddLayout?(): void
  onClosedLayout?(layout: ClosedLayout): void
  onOpenRevisions?(): void
  onCompare?(): void
  onGenerateAlternatives?(): void
}

type AppHeaderProps = {
  store?: ProjectStore
  view: ViewMode
  stage: WorkflowStage
  overlay: WorkspaceOverlay
  canCompare: boolean
  showAutoLayout: boolean
  onViewChange(view: ViewMode): void
  onStageChange(stage: WorkflowStage): void
  onOpenCompare(): void
  onOpenAutoLayout(): void
  aiToolsOpen: boolean
  onOpenAiTools(): void
  onCloseOverlay(): void
  onNewProject(): void
  onOpenSettings(): void
  onTourFocus?(step: number): void
  minimal?: boolean
}

const HOTElOS_SYMBOL_PATH = 'M190.1,0l-27.9,45.9c-3.5,5.7-9.8,9.4-16.6,9.4h-76.8c-6.8,0-13.3-3.7-16.8-9.4L24.4,0H0v214.2h24.4l27.7-45.6c3.5-5.9,10-9.4,16.8-9.4h76.8c6.8,0,13.1,3.5,16.6,9.4l27.9,45.6h24.2V0h-24.2ZM133,133.2h-51.9v-51.8h51.9v51.8Z'

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null
}

function useWorkflowIssues(store: ProjectStore) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const scenario = project.scenarios.find((entry) => entry.id === project.activeScenarioId) ?? project.scenarios[0]

  return useMemo(() => {
    const geometryCount = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints }).length
    const operationalCount = scenario ? evaluateOperationalRequirements({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
      layoutConstraints: variant.layoutConstraints,
    }).filter((result) => result.severity !== 'professional-review').length : 0
    const simulationCount = scenario ? validateSimulationInput({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
      layoutConstraints: variant.layoutConstraints,
    }).length : 0

    return {
      space: geometryCount,
      equipment: geometryCount + operationalCount,
      simulate: simulationCount,
    }
  }, [project, scenario, variant])
}

export function StageToolbar({
  store,
  stage,
  catalogOpen,
  inspectorOpen,
  essentialsCount,
  showReference,
  canUndo,
  canRedo,
  dragResizeEnabled,
  hasSelection,
  onToggleCatalog,
  onToggleInspector,
  onOpenEssentials,
  onUndo,
  onRedo,
  onToggleReference,
  onRotateLeft,
  onRotateRight,
  onToggleResize,
  onAddLayout,
  onClosedLayout,
  onOpenRevisions,
  onCompare,
  onGenerateAlternatives,
}: StageToolbarProps) {
  const project = useStore(store, (state) => state.project)
  const revision = useStore(store, (state) => state.revision)
  const showCatalog = stage !== 'simulate'

  return (
    <div className="app-header-row app-header-row-2">
      <div className="header-layout-tabs">
        {stage === 'space' ? (
          <div className="base-space-tab" aria-label="Shared base space">
            {formatBaseSpaceLabel(revision, project.variants.length)}
          </div>
        ) : (
          <LayoutVariants
            store={store}
            formatTabLabel={(variant, isActive) => formatLayoutTabLabel(variant, isActive ? revision : 1)}
            onAdd={onAddLayout}
            onClosed={onClosedLayout}
            onOpenRevisions={onOpenRevisions}
            onCompare={onCompare}
            onGenerateAlternatives={onGenerateAlternatives}
          />
        )}
      </div>
      <div className="header-contextual-tools">
        {showCatalog && (
          <button type="button" aria-label="Toggle equipment catalog" aria-pressed={catalogOpen} onClick={onToggleCatalog}>Catalog</button>
        )}
        <button type="button" aria-label="Toggle inspector" aria-pressed={inspectorOpen} onClick={onToggleInspector}>Inspector</button>
        <button type="button" onClick={onOpenEssentials}>
          Check essentials{essentialsCount > 0 ? ` · ${essentialsCount}` : ''}
        </button>
        <button type="button" aria-label="Undo" title="Undo (⌘Z)" disabled={!canUndo} onClick={onUndo}>↺</button>
        <button type="button" aria-label="Redo" title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={onRedo}>↻</button>
        {stage !== 'simulate' && (
          <button type="button" aria-pressed={showReference} onClick={onToggleReference}>Source reference</button>
        )}
        {onOpenRevisions && stage !== 'space' && (
          <button type="button" onClick={onOpenRevisions}>Revision history</button>
        )}
        {hasSelection && stage !== 'simulate' && (
          <span className="transform-actions" role="group" aria-label="Selected item transforms">
            <button type="button" className="icon-action" aria-label="Rotate selected left 90 degrees" title="Rotate left 90°" onClick={onRotateLeft}>↶</button>
            <button type="button" className="icon-action" aria-label="Rotate selected right 90 degrees" title="Rotate right 90°" onClick={onRotateRight}>↷</button>
            <button
              type="button"
              className="icon-action resize-action"
              aria-label={dragResizeEnabled ? 'Disable drag resize' : 'Enable drag resize'}
              title="Edit dimensions"
              aria-pressed={dragResizeEnabled}
              onClick={onToggleResize}
            >
              ↔
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

export function AppHeader({
  store = projectStore,
  view,
  stage,
  overlay,
  canCompare,
  showAutoLayout,
  onViewChange,
  onStageChange,
  onOpenCompare,
  onOpenAutoLayout,
  aiToolsOpen,
  onOpenAiTools,
  onCloseOverlay,
  onNewProject,
  onOpenSettings,
  onTourFocus,
  minimal = false,
}: AppHeaderProps) {
  const issues = useWorkflowIssues(store)
  const activeEntry = WORKFLOW_STAGES.find((entry) => entry.id === stage)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      const next = workflowStageFromDigit(event.key)
      if (!next) return
      event.preventDefault()
      onCloseOverlay()
      onStageChange(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCloseOverlay, onStageChange])

  return (
    <header className="app-header">
      <a className="brand-lockup" href="https://kitchen.hotelos.ai" target="_blank" rel="noreferrer" title="CalmKitchen home — kitchen.hotelos.ai">
        <svg className="brand-mark" viewBox="0 0 214.2 214.2" aria-hidden="true" focusable="false">
          <path fill="#b1d15b" d={HOTElOS_SYMBOL_PATH} />
        </svg>
        <h1>CalmKitchen <em>Designer</em></h1>
      </a>
      {!minimal && <ProjectMenu store={store} onNewProject={onNewProject} onOpenSettings={onOpenSettings} />}
      <nav className="topbar-nav" aria-label="HotelOS">
        <a href="https://hotelos.ai/kitchen" target="_blank" rel="noreferrer" className="topbar-nav-brand" title="HotelOS">
          <svg viewBox="0 0 214.2 214.2" aria-hidden="true"><path fill="#b1d15b" d={HOTElOS_SYMBOL_PATH} /></svg>
          HotelOS
        </a>
        <a href="https://hotelos.ai/#platform" target="_blank" rel="noreferrer">Platform</a>
        <a href="https://hotelos.ai/roadmap" target="_blank" rel="noreferrer">Roadmap</a>
        <a href="https://hotelos.ai/integrations" target="_blank" rel="noreferrer">Integrations</a>
        <a href="https://hotelos.ai/pricing" target="_blank" rel="noreferrer">Pricing</a>
        <a href="https://hotelos.ai/trust" target="_blank" rel="noreferrer">Trust</a>
        <a href="https://hotelos.ai/contact" target="_blank" rel="noreferrer">Contact</a>
      </nav>
      {!
minimal && <nav aria-label="Workflow stages" className="workflow-navigator">
        {WORKFLOW_STAGES.map((entry) => {
          const active = stage === entry.id && overlay === null
          const issueCount = issues[entry.id]
          const done = !active && activeEntry !== undefined && entry.step < activeEntry.step && overlay === null
          return (
            <button
              key={entry.id}
              type="button"
              className={`workflow-step${active ? ' active' : ''}${done ? ' done' : ''}${issueCount > 0 && !active ? ' has-issues' : ''}`}
              aria-current={active ? 'step' : undefined}
              aria-label={`${entry.step} ${entry.label}`}
              title={`${entry.step} ${entry.label}${issueCount > 0 ? ` · ${issueCount} issue${issueCount === 1 ? '' : 's'}` : ''}`}
              onClick={() => { onCloseOverlay(); onStageChange(entry.id) }}
            >
              <span className="workflow-step-number" aria-hidden="true">{done ? '✓' : entry.step}</span>
              {entry.label}
            </button>
          )
        })}
      </nav>}
      {stage !== 'simulate' && overlay === null && (
        <nav aria-label="View mode" className="seg view-switcher">
          {VIEW_MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={view === entry.id}
              onClick={() => onViewChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      )}
      {!minimal && (
      <div className="global-actions">
        <button type="button" aria-pressed={aiToolsOpen} title="Drive the workspace with your own AI agent over WebMCP" onClick={onOpenAiTools}>Use your AI agent</button>
        {canCompare && (
          <button type="button" aria-pressed={overlay === 'compare'} onClick={onOpenCompare}>Compare</button>
        )}
        {showAutoLayout && (
          <button type="button" aria-pressed={overlay === 'auto-layout'} onClick={onOpenAutoLayout}>Auto-layout</button>
        )}
        <ProjectExchange store={store} onTourFocus={onTourFocus} />
      </div>
      )}
    </header>
  )
}
