import { useId, useState } from 'react'
import { useStore } from 'zustand'
import type { EquipmentCategory, EquipmentItem, StationCapability } from '../../domain/project'
import { formatLengthInput, parseLength } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveItem } from '../../state/project-store'
import { EquipmentConfigurationField } from './EquipmentConfigurationField'
import { equipmentAccessFlow } from '../../domain/equipment-access'
import { defaultShelfElevationsMm, shelfElevationsMmForItem, shelfTierCount, updateShelfElevationMm } from '../../domain/shelf-elevations'
import { elevatedShelfOffsetMm, resolvedShelfBaseElevationMm } from '../scene/equipment-elevation'

type Props = { store: ProjectStore }

type LengthFieldProps = {
  label: string
  valueMm: number
  unit: 'mm' | 'cm' | 'in' | 'ft'
  disabled?: boolean
  allowZero?: boolean
  onCommit(valueMm: number): void
}

function LengthField({ label, valueMm, unit, disabled, allowZero = false, onCommit }: LengthFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const errorId = useId()
  const commit = (rawValue = draft ?? formatLengthInput(valueMm, unit)) => {
    try {
      const parsed = parseLength(rawValue, unit)
      if (!Number.isFinite(parsed) || parsed < (allowZero ? 0 : Number.EPSILON) || parsed > 20000) throw new Error('range')
      if (parsed !== valueMm) onCommit(parsed)
      setDraft(null)
      setError('')
    } catch {
      setDraft(null)
      setError(`Enter a length ${allowZero ? 'of 0 or more' : 'greater than 0'} and no more than 20,000 mm.`)
    }
  }
  return (
    <label>{label} ({unit})
      <input
        aria-label={`${label} (${unit})`}
        value={draft ?? formatLengthInput(valueMm, unit)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          commit(event.currentTarget.value)
        }}
      />
      {error && <span id={errorId} className="field-error">{error}</span>}
    </label>
  )
}

const CATEGORIES: EquipmentCategory[] = ['cooking', 'cold', 'prep', 'washing', 'landing', 'storage', 'hood', 'custom']
const CAPABILITIES: StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep', 'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash', 'mix']

const shelfLetter = (index: number) => {
  let value = index + 1
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

export function EquipmentInspector({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const item = selectedIds[0] ? getActiveItem(store.getState(), selectedIds[0]) : null
  const [, forceRender] = useState(0)

  if (!item) {
    return <aside className="inspector empty-inspector"><div><span className="eyebrow">Inspector</span><h2>No item selected</h2><p>Select an equipment footprint to edit its size, position, and metadata.</p></div></aside>
  }
  const accessFlow = equipmentAccessFlow(item)
  const tierCount = shelfTierCount(item)
  const activeEquipment = project.variants.find((variant) => variant.id === project.activeVariantId)?.equipment ?? []
  const shelfOffsetMm = tierCount > 0 ? elevatedShelfOffsetMm(item, activeEquipment) : 0

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
        <LengthField key={`width-${item.id}-${project.displayUnit}`} label="Width" valueMm={item.widthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(widthMm) => store.getState().resizeItem(item.id, { widthMm, depthMm: getActiveItem(store.getState(), item.id).depthMm })} />
        <LengthField key={`depth-${item.id}-${project.displayUnit}`} label="Depth" valueMm={item.depthMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(depthMm) => store.getState().resizeItem(item.id, { widthMm: getActiveItem(store.getState(), item.id).widthMm, depthMm })} />
      </div>
      <LengthField key={`height-${item.id}`} label={item.catalogId === 'storage-wall-shelf' ? 'Thickness' : 'Height'} valueMm={item.heightMm} unit={project.displayUnit} disabled={item.dimensionsLocked} onCommit={(heightMm) => update({ heightMm })} />
      <label className="checkbox-row"><input aria-label="Lock dimensions" type="checkbox" checked={item.dimensionsLocked} onChange={(event) => store.getState().setDimensionsLocked(item.id, event.target.checked)} />Lock dimensions</label>
      {tierCount > 0 && <details className="capability-editor shelf-elevation-editor" open>
        <summary>Shelf elevations ({tierCount})</summary>
        <div>
          <p>Set the assembly's height from the floor, then fine-tune individual decks. Changing tiers preserves the item's dimensions.</p>
          <LengthField
            key={`base-elevation-${item.id}`}
            label="Height from floor"
            valueMm={resolvedShelfBaseElevationMm(item, activeEquipment)}
            unit={project.displayUnit}
            allowZero
            onCommit={(baseElevationMm) => update({ baseElevationMm })}
          />
          {shelfElevationsMmForItem(item).map((elevationMm, index) => <LengthField
            key={`shelf-${item.id}-${index}`}
            label={`Shelf ${shelfLetter(index)} elevation`}
            valueMm={elevationMm + shelfOffsetMm}
            unit={project.displayUnit}
            allowZero
            onCommit={(nextElevationMm) => {
              const current = getActiveItem(store.getState(), item.id)
              update({ shelfElevationsMm: updateShelfElevationMm(current, index, Math.max(0, nextElevationMm - shelfOffsetMm)) })
            }}
          />)}
          {item.shelfElevationsMm?.length ? <button type="button" onClick={() => update({ shelfElevationsMm: [] })}>Reset to evenly spaced</button> : null}
          <small>Deck heights from floor: {defaultShelfElevationsMm(item).map((value) => formatLengthInput(value + shelfOffsetMm, project.displayUnit)).join(', ')} {project.displayUnit}</small>
        </div>
      </details>}
      {item.capabilities.includes('dish-wash') && accessFlow && <details className="capability-editor" open>
        <summary>Dishwasher rack flow</summary>
        <div>
          <label>Racks enter from
            <select aria-label="Dishwasher input side" value={accessFlow.inputFace} onChange={(event) => update({ accessFlow: { ...accessFlow, inputFace: event.target.value as typeof accessFlow.inputFace } })}>
              <option value="front">Front</option><option value="back">Back</option><option value="left">Left side</option><option value="right">Right side</option>
            </select>
          </label>
          <label>Clean racks exit from
            <select aria-label="Dishwasher output side" value={accessFlow.outputFace} onChange={(event) => update({ accessFlow: { ...accessFlow, outputFace: event.target.value as typeof accessFlow.outputFace } })}>
              <option value="front">Front</option><option value="back">Back</option><option value="left">Left side</option><option value="right">Right side</option>
            </select>
          </label>
          <p className="field-error" style={{ color: 'var(--ink-4)' }}>Choose front-to-side flow for a corner pass-through setup.</p>
        </div>
      </details>}
      <div className="field-pair">
        <LengthField allowZero key={`x-${item.id}`} label="X position" valueMm={item.xMm} unit={project.displayUnit} onCommit={(xMm) => update({ xMm })} />
        <LengthField allowZero key={`y-${item.id}`} label="Y position" valueMm={item.yMm} unit={project.displayUnit} onCommit={(yMm) => update({ yMm })} />
      </div>
      <details className="capability-editor clearance-editor" open>
        <summary>Clearances{item.clearance ? '' : ' (none set)'}</summary>
        <div>
          <label>Clearance kind
            <select aria-label="Clearance kind" value={item.clearance?.kind ?? (item.category === 'cooking' ? 'heat' : 'work')} onChange={(event) => update({ clearance: { kind: event.target.value as NonNullable<EquipmentItem['clearance']>['kind'], frontMm: item.clearance?.frontMm ?? 900, leftMm: item.clearance?.leftMm, rightMm: item.clearance?.rightMm, backMm: item.clearance?.backMm } })}>
              <option value="work">Work space</option>
              <option value="heat">Heat / hot equipment</option>
              <option value="door-swing">Door swing</option>
              <option value="service">Service access</option>
            </select>
          </label>
          <div className="field-pair">
            <LengthField allowZero key={`cf-${item.id}`} label="Front" valueMm={item.clearance?.frontMm ?? 0} unit={project.displayUnit} onCommit={(frontMm) => update({ clearance: { ...getActiveItem(store.getState(), item.id).clearance, kind: getActiveItem(store.getState(), item.id).clearance?.kind ?? (item.category === 'cooking' ? 'heat' : 'work'), frontMm } })} />
            <LengthField allowZero key={`cb-${item.id}`} label="Back" valueMm={item.clearance?.backMm ?? 0} unit={project.displayUnit} onCommit={(backMm) => { const current = getActiveItem(store.getState(), item.id); update({ clearance: { ...current.clearance, kind: current.clearance?.kind ?? (current.category === 'cooking' ? 'heat' : 'work'), frontMm: current.clearance?.frontMm ?? 0, backMm } }) }} />
            <LengthField allowZero key={`cl-${item.id}`} label="Left" valueMm={item.clearance?.leftMm ?? 0} unit={project.displayUnit} onCommit={(leftMm) => { const current = getActiveItem(store.getState(), item.id); update({ clearance: { ...current.clearance, kind: current.clearance?.kind ?? (current.category === 'cooking' ? 'heat' : 'work'), frontMm: current.clearance?.frontMm ?? 0, leftMm } }) }} />
            <LengthField allowZero key={`cr-${item.id}`} label="Right" valueMm={item.clearance?.rightMm ?? 0} unit={project.displayUnit} onCommit={(rightMm) => { const current = getActiveItem(store.getState(), item.id); update({ clearance: { ...current.clearance, kind: current.clearance?.kind ?? (current.category === 'cooking' ? 'heat' : 'work'), frontMm: current.clearance?.frontMm ?? 0, rightMm } }) }} />
          </div>
          <p className="field-error" style={{ color: 'var(--ink-4)' }}>Clearances drive plan checks and 3D overlays.</p>
        </div>
      </details>
      <details className="capability-editor"><summary>Simulation capabilities ({item.capabilities.length})</summary><div>{CAPABILITIES.map((capability) => <label className="checkbox-row" key={capability}><input type="checkbox" checked={item.capabilities.includes(capability)} onChange={(event) => update({ capabilities: event.target.checked ? [...item.capabilities, capability] : item.capabilities.filter((value) => value !== capability) })} />{capability.replaceAll('-', ' ')}</label>)}</div></details>
      <details className="capability-editor plan-layer-editor">
        <summary>Plan layer</summary>
        <div>
          <p>Choose how overlapping footprints are stacked in the 2D plan.</p>
          <div className="plan-layer-actions">
            <button type="button" onClick={() => store.getState().reorderItem(item.id, 'front')}>Bring to front</button>
            <button type="button" onClick={() => store.getState().reorderItem(item.id, 'forward')}>Bring forward</button>
            <button type="button" onClick={() => store.getState().reorderItem(item.id, 'backward')}>Send backward</button>
            <button type="button" onClick={() => store.getState().reorderItem(item.id, 'back')}>Send to back</button>
          </div>
        </div>
      </details>
      {item.notes && <p className="item-note">{item.notes}</p>}
      <div className="inspector-actions">
        <button type="button" aria-label="Duplicate selected item" onClick={() => store.getState().duplicateItem(item.id)}>Duplicate</button>
        <button type="button" className="danger-button" aria-label="Remove selected item" disabled={!item.removable} onClick={() => store.getState().removeItems([item.id])}>Remove</button>
      </div>
    </aside>
  )
}
