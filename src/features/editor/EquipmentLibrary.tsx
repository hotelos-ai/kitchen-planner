import { useState } from 'react'
import { useStore } from 'zustand'
import { formatDimensions } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'

type Props = { store: ProjectStore }

export function EquipmentLibrary({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const [showCustom, setShowCustom] = useState(false)
  const [label, setLabel] = useState('Custom equipment')
  const [widthMm, setWidthMm] = useState(600)
  const [depthMm, setDepthMm] = useState(600)

  const addCustom = () => {
    store.getState().addCustomItem({ label, widthMm, depthMm })
    setShowCustom(false)
  }

  return (
    <aside className="equipment-library" aria-label="Equipment library">
      <div className="panel-heading"><span className="eyebrow">Current layout</span><h2>Equipment</h2></div>
      <div className="equipment-list">
        {variant.equipment.map((item) => (
          <button
            key={item.id}
            type="button"
            className={selectedIds.includes(item.id) ? 'equipment-row selected' : 'equipment-row'}
            aria-label={`Select ${item.label}, ${item.widthMm} mm by ${item.depthMm} mm`}
            onClick={(event) => event.shiftKey ? store.getState().toggleItemSelection(item.id) : store.getState().selectItems([item.id])}
          >
            <span className={`category-dot ${item.category}`} />
            <span><strong>{item.label}</strong><small>{formatDimensions(item, project.displayUnit)}{item.approximate ? ' · approximate' : ''}</small></span>
          </button>
        ))}
      </div>
      <button type="button" className="add-custom-button" onClick={() => setShowCustom((value) => !value)}>＋ Add custom item</button>
      {showCustom && (
        <form className="custom-item-form" onSubmit={(event) => { event.preventDefault(); addCustom() }}>
          <label>New item label<input aria-label="New item label" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <div className="field-pair">
            <label>Width (mm)<input type="number" min="100" step="50" value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} /></label>
            <label>Depth (mm)<input type="number" min="100" step="50" value={depthMm} onChange={(event) => setDepthMm(Number(event.target.value))} /></label>
          </div>
          <button type="submit" className="primary-button">Add to plan</button>
        </form>
      )}
    </aside>
  )
}
