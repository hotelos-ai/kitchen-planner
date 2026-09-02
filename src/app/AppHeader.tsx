import { useMemo } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../domain/layout-diagnostics'
import { evaluateOperationalRequirements } from '../domain/requirements/operational-requirements'
import { validateSimulationInput } from '../simulation/validation'
import { getActiveVariant, projectStore, type ProjectStore } from '../state/project-store'
import { formatBaseSpaceLabel, formatLayoutTabLabel } from './layout-labels'
import type { ViewMode, WorkflowStage, WorkspaceOverlay } from './workflow'
import { VIEW_MODES, WORKFLOW_STAGES } from './workflow'
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

type AppHeaderProps = StageToolbarProps & {
  projectName: string
  saveLabel: string
  view: ViewMode
  stage: WorkflowStage
  overlay: WorkspaceOverlay
  canCompare: boolean
  showAutoLayout: boolean
  onViewChange(view: ViewMode): void
  onStageChange(stage: WorkflowStage): void
  onOpenCompare(): void
  onOpenAutoLayout(): void
  onCloseOverlay(): void
  onNewProject(): void
  onOpenSettings(): void
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
          Check essentials{essentialsCount > 0 ? ` ${essentialsCount}` : ''}
        </button>
        <button type="button" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>Undo</button>
        <button type="button" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>Redo</button>
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
  projectName: _projectName,
  saveLabel: _saveLabel,
  view,
  stage,
  overlay,
  canCompare,
  showAutoLayout,
  onViewChange,
  onStageChange,
  onOpenCompare,
  onOpenAutoLayout,
  onCloseOverlay,
  onNewProject,
  onOpenSettings,
  ...toolbarProps
}: AppHeaderProps) {
  const issues = useWorkflowIssues(store)

  return (
    <header className="app-header">
      <div className="app-header-row app-header-row-1">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">KP</span>
          <div>
            <h1>Kitchen Planner</h1>
            <p className="brand-subtitle">Commercial kitchen planning and service simulation</p>
          </div>
        </div>
        <ProjectMenu store={store} onNewProject={onNewProject} onOpenSettings={onOpenSettings} />
        <nav aria-label="Workflow stages" className="workflow-navigator">
          {WORKFLOW_STAGES.map((entry) => {
            const active = stage === entry.id && overlay === null
            const issueCount = issues[entry.id]
            const label = issueCount > 0 && entry.id !== 'space'
              ? `${entry.label} · ${issueCount} issue${issueCount === 1 ? '' : 's'}`
              : issueCount === 0 && entry.id === 'space'
                ? `✓ ${entry.label}`
                : entry.label
            return (
              <button
                key={entry.id}
                type="button"
                className={`workflow-step${active ? ' active' : ''}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => { onCloseOverlay(); onStageChange(entry.id) }}
              >
                <span className="workflow-step-number">{entry.step}</span>
                {label}
              </button>
            )
          })}
        </nav>
        {stage !== 'simulate' && overlay === null && (
          <nav aria-label="View mode" className="view-switcher compact-view-switcher">
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
        <div className="global-actions">
          {canCompare && (
            <button type="button" aria-pressed={overlay === 'compare'} onClick={onOpenCompare}>Compare</button>
          )}
          {showAutoLayout && (
            <button type="button" aria-pressed={overlay === 'auto-layout'} onClick={onOpenAutoLayout}>Auto-layout</button>
          )}
          <ProjectExchange store={store} />
        </div>
      </div>
      {overlay === null && stage !== 'simulate' && (
        <StageToolbar
          store={store}
          stage={stage}
          onCompare={onOpenCompare}
          onGenerateAlternatives={onOpenAutoLayout}
          {...toolbarProps}
        />
      )}
    </header>
  )
}
