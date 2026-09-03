import { useState } from 'react'
import type { LayoutVariant } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'
import { PlanCanvas } from '../editor/PlanCanvas'
import { SceneWorkspace } from '../scene/SceneWorkspace'

type PreviewView = 'plan' | 'scene' | 'walk'

type Props = {
  store: ProjectStore
  variant: LayoutVariant
}

export function LayoutInspectViewer({ store, variant }: Props) {
  const [view, setView] = useState<PreviewView>('plan')
  const showPlanCanvas = typeof ResizeObserver !== 'undefined'

  return (
    <section className="layout-inspect-viewer" aria-label="Layout preview viewer">
      <nav className="seg" aria-label="Preview view">
        <button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Plan</button>
        <button type="button" aria-pressed={view === 'scene'} onClick={() => setView('scene')}>3D</button>
        <button type="button" aria-pressed={view === 'walk'} onClick={() => setView('walk')}>Walk</button>
      </nav>
      <div className="layout-inspect-stage">
        {view === 'plan' ? (
          showPlanCanvas
            ? <PlanCanvas store={store} showReference={false} variantOverride={variant} readOnly />
            : <div className="plan-canvas test-canvas-placeholder" data-testid="plan-canvas" />
        ) : (
          <SceneWorkspace store={store} compact variantOverride={variant} readOnly walkMode={view === 'walk'} />
        )}
      </div>
    </section>
  )
}
