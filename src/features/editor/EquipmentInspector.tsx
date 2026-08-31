import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { EquipmentItem } from '../../domain/project'
import { formatLengthInput, parseLength } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveItem } from '../../state/project-store'

type Props = { store: ProjectStore }

type LengthFieldProps = {
  label: string
  valueMm: number
  unit: 'mm' | 'cm' | 'in' | 'ft'
  disabled?: boolean
  onCommit(valueMm: number): void
}

function LengthField({ label, valueMm, unit, disabled, onCommit }: LengthFieldProps) {
  const [draft, setDraft] = useState(() => formatLengthInput(valueMm, unit))
  useEffect(() => setDraft(formatLengthInput(valueMm, unit)), [valueMm, unit])
  return (
    <label>{label} ({unit})
      <input
        aria-label={`${label} (${unit})`}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          try { onCommit(parseLength(draft, unit)) } catch { setDraft(formatLengthInput(valueMm, unit)) }
        }}
      />
    </label>
  )
}

export function EquipmentInspector({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const item = selectedIds[0] ? getActiveItem(store.getState(), selectedIds[0]) : null
  const [, forceRender] = useState(0)

  if (!item) {
    return <aside className="inspector empty-inspector"><div><span className="eyebrow">Inspector</span><h2>No item selected</h2><p>Select an equipment footprint to edit its size, position, rotation, and metadata.</p></div></aside>
  }

  const update = (patch: Partial<EquipmentItem>) => {
    store.getState().updateItem(item.id, patch)
    forceRender((value) => value + 1)
  }

  return (
    <aside className="inspector" aria-label="Equipment inspector">
      <div className="panel-heading"><span className="eyebrow">{item.category}</span><h2>Selected equipment</h2></div>
      <label>Equipment label<input aria-label="Equipment label" value={item.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <div className="field-pair">
        <LengthField label="Width" valueMm={item.widthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(widthMm) => store.getState().resizeItem(item.id, { widthMm, depthMm: item.depthMm })} />
        <LengthField label="Depth" valueMm={item.depthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(depthMm) => store.getState().resizeItem(item.id, { widthMm: item.widthMm, depthMm })} />
      </div>
      <label className="checkbox-row"><input aria-label="Lock dimensions" type="checkbox" checked={item.dimensionsLocked} onChange={(event) => store.getState().setDimensionsLocked(item.id, event.target.checked)} />Lock dimensions</label>
      <div className="field-pair">
        <LengthField label="X position" valueMm={item.xMm} unit={project.displayUnit} onCommit={(xMm) => store.getState().moveItems([item.id], { x: xMm, y: item.yMm })} />
        <LengthField label="Y position" valueMm={item.yMm} unit={project.displayUnit} onCommit={(yMm) => store.getState().moveItems([item.id], { x: item.xMm, y: yMm })} />
      </div>
      <label>Rotation
        <select aria-label="Rotation" value={item.rotationDeg} onChange={(event) => update({ rotationDeg: Number(event.target.value) })}>
          <option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option>
        </select>
      </label>
      {item.notes && <p className="item-note">{item.notes}</p>}
      <div className="inspector-actions">
        <button type="button" aria-label="Duplicate selected item" onClick={() => store.getState().duplicateItem(item.id)}>Duplicate</button>
        <button type="button" className="danger-button" aria-label="Remove selected item" disabled={!item.removable} onClick={() => store.getState().removeItems([item.id])}>Remove</button>
      </div>
    </aside>
  )
}
