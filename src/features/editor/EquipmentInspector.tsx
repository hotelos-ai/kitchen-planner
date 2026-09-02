import { useId, useState } from 'react'
import { useStore } from 'zustand'
import type { EquipmentCategory, EquipmentItem, StationCapability } from '../../domain/project'
import { formatLengthInput, parseLength } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveItem } from '../../state/project-store'
import { EquipmentConfigurationField } from './EquipmentConfigurationField'

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
  const [error, setError] = useState('')
  const errorId = useId()
  return (
    <label>{label} ({unit})
      <input
        aria-label={`${label} (${unit})`}
        value={draft}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          try {
            const parsed = parseLength(draft, unit)
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20000) throw new Error('range')
            onCommit(parsed); setError('')
          } catch { setDraft(formatLengthInput(valueMm, unit)); setError('Enter a length greater than 0 and no more than 20,000 mm.') }
        }}
      />
      {error && <span id={errorId} className="field-error">{error}</span>}
    </label>
  )
}

const CATEGORIES: EquipmentCategory[] = ['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom']
const CAPABILITIES: StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep', 'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash', 'mix']

export function EquipmentInspector({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const item = selectedIds[0] ? getActiveItem(store.getState(), selectedIds[0]) : null
  const [, forceRender] = useState(0)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  if (!item) {
    return <aside className="inspector empty-inspector"><div><span className="eyebrow">Inspector</span><h2>No item selected</h2><p>Select an equipment footprint to edit its size, position, and metadata.</p></div></aside>
  }
  const confirmRemove = confirmRemoveId === item.id

  const update = (patch: Partial<EquipmentItem>) => {
    store.getState().updateItem(item.id, patch)
    forceRender((value) => value + 1)
  }

  return (
    <aside className="inspector" aria-label="Equipment inspector">
      <div className="panel-heading"><span className="eyebrow">{item.category}</span><h2>Selected equipment</h2></div>
      <label>Equipment label<input aria-label="Equipment label" value={item.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <EquipmentConfigurationField item={item} store={store} />
      <label>Category<select aria-label="Equipment category" value={item.category} onChange={(event) => update({ category: event.target.value as EquipmentCategory })}>{CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
      <div className="field-pair">
        <LengthField key={`width-${item.id}-${item.widthMm}-${project.displayUnit}`} label="Width" valueMm={item.widthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(widthMm) => store.getState().resizeItem(item.id, { widthMm, depthMm: item.depthMm })} />
        <LengthField key={`depth-${item.id}-${item.depthMm}-${project.displayUnit}`} label="Depth" valueMm={item.depthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(depthMm) => store.getState().resizeItem(item.id, { widthMm: item.widthMm, depthMm })} />
      </div>
      <LengthField key={`height-${item.id}-${item.heightMm}-${project.displayUnit}`} label="Height" valueMm={item.heightMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(heightMm) => update({ heightMm })} />
      <label className="checkbox-row"><input aria-label="Lock dimensions" type="checkbox" checked={item.dimensionsLocked} onChange={(event) => store.getState().setDimensionsLocked(item.id, event.target.checked)} />Lock dimensions</label>
      <div className="field-pair">
        <LengthField key={`x-${item.id}-${item.xMm}-${project.displayUnit}`} label="X position" valueMm={item.xMm} unit={project.displayUnit} onCommit={(xMm) => store.getState().moveItems([item.id], { x: xMm, y: item.yMm })} />
        <LengthField key={`y-${item.id}-${item.yMm}-${project.displayUnit}`} label="Y position" valueMm={item.yMm} unit={project.displayUnit} onCommit={(yMm) => store.getState().moveItems([item.id], { x: item.xMm, y: yMm })} />
      </div>
      <LengthField key={`clearance-${item.id}-${item.clearance?.frontMm ?? 1}-${project.displayUnit}`} label="Front clearance" valueMm={item.clearance?.frontMm ?? 1} unit={project.displayUnit} onCommit={(frontMm) => update({ clearance: { kind: item.clearance?.kind ?? (item.category === 'cooking' ? 'heat' : 'work'), frontMm } })} />
      <details className="capability-editor"><summary>Simulation capabilities ({item.capabilities.length})</summary><div>{CAPABILITIES.map((capability) => <label className="checkbox-row" key={capability}><input type="checkbox" checked={item.capabilities.includes(capability)} onChange={(event) => update({ capabilities: event.target.checked ? [...item.capabilities, capability] : item.capabilities.filter((value) => value !== capability) })} />{capability.replaceAll('-', ' ')}</label>)}</div></details>
      {item.notes && <p className="item-note">{item.notes}</p>}
      <div className="inspector-actions">
        <button type="button" aria-label="Duplicate selected item" onClick={() => store.getState().duplicateItem(item.id)}>Duplicate</button>
        <button type="button" className="danger-button" aria-label={confirmRemove ? 'Confirm remove selected item' : 'Remove selected item'} disabled={!item.removable} onClick={() => confirmRemove ? store.getState().removeItems([item.id]) : setConfirmRemoveId(item.id)}>{confirmRemove ? 'Confirm remove' : 'Remove'}</button>
      </div>
    </aside>
  )
}
