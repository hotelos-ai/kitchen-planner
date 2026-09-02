import { useStore } from 'zustand'
import type { WorkflowStage } from '../../app/workflow'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

type Props = {
  store: ProjectStore
  stage: WorkflowStage
  selectedCount: number
  onEditSpace?(): void
}

export function CanvasFooter({ store, stage, selectedCount, onEditSpace }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const unitLabel = project.displayUnit === 'mm' ? 'mm' : project.displayUnit

  return (
    <footer className="canvas-footer" aria-label="Canvas controls">
      <div className="canvas-footer-left">
        <span>Units: {unitLabel}</span>
        <span>Grid: {project.snapMm} {unitLabel}</span>
        <span>Snap: On</span>
      </div>
      <div className="canvas-footer-center">
        {selectedCount > 0 && <span>{selectedCount} selected</span>}
      </div>
      <div className="canvas-footer-right">
        <span className="zoom-controls" aria-label="Zoom controls">
          <button type="button" aria-label="Zoom out">−</button>
          <span>100%</span>
          <button type="button" aria-label="Zoom in">+</button>
          <button type="button" aria-label="Fit to screen">Fit to screen</button>
        </span>
        <span className="scale-hint">1 metre = {Math.round(1000 / project.snapMm)} squares</span>
        {stage !== 'space' && (
          <span className="space-lock-indicator">
            🔒 Space locked
            {onEditSpace && (
              <button type="button" className="link-button" onClick={onEditSpace}>Edit in Space</button>
            )}
          </span>
        )}
        {stage === 'space' && variant.architecture.locked && (
          <span className="space-lock-indicator">Space editable</span>
        )}
      </div>
    </footer>
  )
}
