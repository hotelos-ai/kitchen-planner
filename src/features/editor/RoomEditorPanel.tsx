import { useMemo } from 'react'
import { useStore } from 'zustand'
import type { Architecture, PointMm } from '../../domain/project'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { PolygonRoomEditor } from './PolygonRoomEditor'

type Props = {
  store: ProjectStore
  onContinueToEquipment?(): void
}

const polygonAreaM2 = (polygon: PointMm[]) => {
  let doubled = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    doubled += current.x * next.y - next.x * current.y
  }
  return Math.abs(doubled) / 2 / 1_000_000
}

export function RoomEditorPanel({ store, onContinueToEquipment }: Props) {
  const variant = useStore(store, getActiveVariant)
  const architecture = variant.architecture

  const apply = useMemo(() => (next: Architecture) => {
    store.getState().applySharedArchitecture(next)
  }, [store])

  const areaM2 = polygonAreaM2(architecture.roomPolygon)
  const openingCount = architecture.openings.length
  const pillarCount = architecture.pillars.length

  return (
    <aside className="inspector room-editor" aria-label="Floor plan editor">
      <div className="panel-heading"><span className="eyebrow">Space</span><h2>Floor plan</h2></div>
      <p className="stage-summary room-editor-summary">
        {(architecture.widthMm / 1000).toFixed(2)} × {(architecture.depthMm / 1000).toFixed(2)} m · {areaM2.toFixed(1)} m² · {openingCount} {openingCount === 1 ? 'opening' : 'openings'} · {pillarCount} {pillarCount === 1 ? 'pillar' : 'pillars'}
      </p>
      <p className="stage-summary room-editor-live-hint">Edits apply immediately and update every layout sharing this space.</p>
      <PolygonRoomEditor value={architecture} onChange={apply} />
      {onContinueToEquipment && (
        <button type="button" className="primary-button room-editor-continue" onClick={onContinueToEquipment}>
          Continue to fit-out
        </button>
      )}
    </aside>
  )
}
