import { useEffect, useMemo, useState } from 'react'
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
  const [baseline, setBaseline] = useState(() => variant.architecture)
  const [draft, setDraft] = useState<Architecture>(() => structuredClone(variant.architecture))

  useEffect(() => {
    if (baseline === variant.architecture) return
    setBaseline(variant.architecture)
    setDraft(structuredClone(variant.architecture))
  }, [variant.architecture, baseline])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline])
  const areaM2 = polygonAreaM2(draft.roomPolygon)
  const openingCount = draft.openings.length
  const pillarCount = draft.pillars.length

  return (
    <aside className="inspector room-editor" aria-label="Floor plan editor">
      <div className="panel-heading"><span className="eyebrow">Space</span><h2>Floor plan</h2></div>
      <p className="stage-summary room-editor-summary">
        {(draft.widthMm / 1000).toFixed(2)} × {(draft.depthMm / 1000).toFixed(2)} m · {areaM2.toFixed(1)} m² · {openingCount} {openingCount === 1 ? 'opening' : 'openings'} · {pillarCount} {pillarCount === 1 ? 'pillar' : 'pillars'}
      </p>
      <PolygonRoomEditor value={draft} onChange={setDraft} />
      <div className="room-editor-actions">
        <button type="button" className="primary-button" disabled={!dirty} onClick={() => store.getState().applySharedArchitecture(draft)}>
          Apply floor plan
        </button>
        {dirty && (
          <button type="button" className="link-button" onClick={() => setDraft(structuredClone(baseline))}>Revert</button>
        )}
      </div>
      {dirty && <p className="stage-summary">Unsaved floor-plan changes — apply to update every layout that shares this space.</p>}
      {onContinueToEquipment && (
        <button type="button" className="primary-button room-editor-continue" onClick={onContinueToEquipment}>
          Continue to fit-out
        </button>
      )}
    </aside>
  )
}
