import { useState } from 'react'
import type { ProjectStore } from '../../state/project-store'
import {
  applyAutomaticPlanFixes,
  type AutomaticPlanFixResult,
  type AutomaticPlanFixStrategy,
} from './auto-fix-orchestrator'

type Props = {
  store: ProjectStore
  onClose(): void
  onResult(result: AutomaticPlanFixResult): void
}

export function AutoFixStrategyDialog({ store, onClose, onResult }: Props) {
  const [runningStrategy, setRunningStrategy] = useState<AutomaticPlanFixStrategy | null>(null)
  const run = (strategy: Exclude<AutomaticPlanFixStrategy, 'automatic'>) => {
    setRunningStrategy(strategy)
    window.setTimeout(() => {
      onResult(applyAutomaticPlanFixes(store, { strategy }))
      onClose()
    }, 0)
  }

  return (
    <div className="workspace-modal-backdrop auto-fix-strategy-backdrop" onMouseDown={(event) => { if (!runningStrategy && event.target === event.currentTarget) onClose() }}>
      <section
        className="auto-fix-strategy-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose an auto-fix strategy"
        onKeyDown={(event) => { if (!runningStrategy && event.key === 'Escape') onClose() }}
      >
        <button type="button" className="workspace-modal-close" aria-label="Close auto-fix options" disabled={Boolean(runningStrategy)} onClick={onClose}>×</button>
        <h2>How should Auto-fix work?</h2>
        <div className="auto-fix-strategy-options">
          <button type="button" aria-label="Adjust the layout" disabled={Boolean(runningStrategy)} onClick={() => run('layout')}>
            <strong>{runningStrategy === 'layout' ? 'Adjusting the layout…' : 'Adjust the layout'}</strong>
            <span>Keep equipment where possible; change the room or openings.</span>
          </button>
          <button type="button" aria-label="Move equipment" disabled={Boolean(runningStrategy)} onClick={() => run('equipment')}>
            <strong>{runningStrategy === 'equipment' ? 'Moving equipment…' : 'Move equipment'}</strong>
            <span>Keep the room fixed; reposition movable equipment.</span>
          </button>
        </div>
        <button type="button" className="link-button auto-fix-strategy-cancel" disabled={Boolean(runningStrategy)} onClick={onClose}>Cancel</button>
      </section>
    </div>
  )
}
