import { useStore } from 'zustand'
import type { Architecture } from '../../domain/project'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { PolygonRoomEditor } from './PolygonRoomEditor'
import { SpaceItemInspector, type SpaceSelection } from './SpaceItemInspector'

type Props = {
  store: ProjectStore
  selection: SpaceSelection
  onClearSelection(): void
  onContinueToEquipment?(): void
}

export function RoomEditorPanel({ store, selection, onClearSelection, onContinueToEquipment }: Props) {
  const variant = useStore(store, getActiveVariant)
  const architecture = variant.architecture

  const apply = (next: Architecture) => store.getState().applySharedArchitecture(next)

  if (selection) {
    return <SpaceItemInspector store={store} selection={selection} onClearSelection={onClearSelection} />
  }

  return (
    <aside className="inspector room-editor" aria-label="Floor plan editor">
      <div className="panel-heading"><span className="eyebrow">Space</span><h2>Floor plan</h2></div>
      <details className="space-stack-section" open>
        <summary>Room<span className="space-stack-count">{architecture.roomPolygon.length} points</span></summary>
        <div className="space-stack-body">
          <p className="stage-summary room-editor-summary">
            {(architecture.widthMm / 1000).toFixed(2)} × {(architecture.depthMm / 1000).toFixed(2)} m
          </p>
          <p className="stage-summary room-editor-live-hint">Click any opening, pillar, or zone on the plan to edit it.</p>
          <PolygonRoomEditor value={architecture} onChange={apply} />
        </div>
      </details>
      <details className="space-stack-section">
        <summary>Openings<span className="space-stack-count">{architecture.openings.length}</span></summary>
        <div className="space-stack-body">
          {architecture.openings.length === 0 && <p className="stage-summary">None yet — add one from the catalog.</p>}
          {architecture.openings.map((opening) => (
            <button key={opening.id} type="button" className="equipment-row" onClick={() => onClearSelection()}>
              <span className="category-dot" style={{ background: opening.kind === 'service-window' ? 'var(--cat-cold)' : 'var(--cat-prep)' }} />
              <span><strong>{opening.label}</strong><small>{opening.widthMm} mm · {opening.flow ?? 'closed'}</small></span>
            </button>
          ))}
        </div>
      </details>
      <details className="space-stack-section">
        <summary>Structure<span className="space-stack-count">{architecture.pillars.length}</span></summary>
        <div className="space-stack-body">
          {architecture.pillars.length === 0 && <p className="stage-summary">None yet.</p>}
          {architecture.pillars.map((pillar) => (
            <div key={pillar.id} className="equipment-row"><span className="category-dot" style={{ background: 'var(--ink-3)' }} /><span><strong>{pillar.shape === 'round' ? 'Round column' : 'Pillar'}</strong><small>{pillar.widthMm} × {pillar.depthMm} mm</small></span></div>
          ))}
        </div>
      </details>
      <details className="space-stack-section">
        <summary>Zones<span className="space-stack-count">{architecture.storageZones.length}</span></summary>
        <div className="space-stack-body">
          {architecture.storageZones.length === 0 && <p className="stage-summary">None yet.</p>}
          {architecture.storageZones.map((zone) => (
            <div key={zone.id} className="equipment-row"><span className="category-dot" style={{ background: 'var(--cat-wash)' }} /><span><strong>{zone.label}</strong><small>{zone.widthMm} × {zone.depthMm} mm</small></span></div>
          ))}
        </div>
      </details>
      {onContinueToEquipment && (
        <button type="button" className="primary-button room-editor-continue" onClick={onContinueToEquipment}>
          Continue to fit-out
        </button>
      )}
    </aside>
  )
}
