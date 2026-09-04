import { useState } from 'react'
import { useStore } from 'zustand'
import type { Architecture } from '../../domain/project'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export type SpaceSelection = { kind: 'opening' | 'pillar' | 'zone'; id: string } | null

type Props = {
  store: ProjectStore
  selection: SpaceSelection
  onClearSelection(): void
}

const NumberField = ({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) => (
  <label>
    {label}
    <input
      type="number"
      min={0}
      step={100}
      value={Math.round(value)}
      onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next) && next >= 0) onChange(next) }}
    />
  </label>
)

const TextField = ({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) => {
  const [draft, setDraft] = useState(value)
  const commit = (rawValue = draft) => {
    const next = rawValue.trim()
    if (next) onCommit(next)
    else setDraft(value)
  }
  return <label>{label}<input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.currentTarget.value)} onKeyDown={(event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(event.currentTarget.value)
  }} /></label>
}

export function SpaceItemInspector({ store, selection, onClearSelection }: Props) {
  const variant = useStore(store, getActiveVariant)
  const architecture = variant.architecture
  const apply = (next: Architecture) => store.getState().applySharedArchitecture(next)
  const remove = () => {
    if (!selection) return
    if (selection.kind === 'opening') apply({ ...architecture, openings: architecture.openings.filter((opening) => opening.id !== selection.id) })
    if (selection.kind === 'pillar') apply({ ...architecture, pillars: architecture.pillars.filter((pillar) => pillar.id !== selection.id) })
    if (selection.kind === 'zone') apply({ ...architecture, storageZones: architecture.storageZones.filter((zone) => zone.id !== selection.id) })
    onClearSelection()
  }

  if (!selection) return null

  if (selection.kind === 'opening') {
    const index = architecture.openings.findIndex((opening) => opening.id === selection.id)
    if (index < 0) return null
    const opening = architecture.openings[index]
    const patch = (partial: Partial<typeof opening>) => apply({ ...architecture, openings: architecture.openings.map((candidate, position) => position === index ? { ...candidate, ...partial } : candidate) })
    const doorType = opening.doorType ?? 'hinged'
    const isSingleDoor = doorType === 'hinged' || doorType === 'sliding'
    const isSwingingDoor = doorType === 'hinged' || doorType === 'double-hinged'
    const flipDoor = () => {
      if (doorType === 'double-hinged') patch({ swingDirection: opening.swingDirection === 'outward' ? 'inward' : 'outward' })
      else if (doorType === 'hinged' || doorType === 'sliding') patch({ swingHinge: opening.swingHinge === 'end' ? 'start' : 'end' })
    }
    return (
      <aside className="inspector space-item-inspector" aria-label="Selected opening">
        <div className="panel-heading"><span className="eyebrow">{opening.kind === 'service-window' ? 'Service window' : opening.kind === 'window' ? 'Window' : 'Door'}</span><h2>{opening.label}</h2></div>
        <TextField key={`${opening.id}-${opening.label}`} label="Label" value={opening.label} onCommit={(label) => patch({ label })} />
        <div className="field-pair">
          <NumberField label="Offset (mm)" value={opening.offsetMm} onChange={(offsetMm) => patch({ offsetMm })} />
          <NumberField label="Width (mm)" value={opening.widthMm} onChange={(widthMm) => patch({ widthMm })} />
          {opening.kind === 'door' && doorType === 'hinged' && <NumberField label="Swing depth (mm)" value={opening.swingDepthMm ?? opening.widthMm} onChange={(swingDepthMm) => patch({ swingDepthMm })} />}
          {(opening.kind === 'window' || opening.kind === 'service-window') && <NumberField label="Sill height (mm)" value={opening.sillHeightMm ?? 900} onChange={(sillHeightMm) => patch({ sillHeightMm })} />}
          {(opening.kind === 'window' || opening.kind === 'service-window') && <NumberField label="Opening height (mm)" value={opening.heightMm ?? 900} onChange={(heightMm) => patch({ heightMm })} />}
        </div>
        {opening.kind === 'door' && <>
          <label>Door type
            <select aria-label="Door type" value={doorType} onChange={(event) => patch({ doorType: event.target.value as NonNullable<typeof opening.doorType> })}>
              <option value="hinged">Single hinged</option>
              <option value="double-hinged">Double hinged</option>
              <option value="sliding">Single sliding</option>
              <option value="double-sliding">Double sliding</option>
            </select>
          </label>
          <div className="field-pair">
          {isSingleDoor && <label>{doorType === 'sliding' ? 'Slide direction' : 'Hinge side'}
            <select aria-label={doorType === 'sliding' ? 'Door slide direction' : 'Door hinge side'} value={opening.swingHinge ?? 'start'} onChange={(event) => patch({ swingHinge: event.target.value as NonNullable<typeof opening.swingHinge> })}>
              <option value="start">Toward first end</option>
              <option value="end">Toward second end</option>
            </select>
          </label>}
          {isSwingingDoor && <label>Opening direction
            <select aria-label="Door opening direction" value={opening.swingDirection ?? 'inward'} onChange={(event) => patch({ swingDirection: event.target.value as NonNullable<typeof opening.swingDirection> })}>
              <option value="inward">Into room</option>
              <option value="outward">Out of room</option>
            </select>
          </label>}
          </div>
          <p className="stage-summary">The plan shows the opening path. Use Flip door to reverse the hinge or slide direction.</p>
        </>}
        {opening.kind !== 'window' && <label>Flow
          <select value={opening.flow ?? 'closed'} onChange={(event) => patch({ flow: event.target.value as typeof opening.flow })}>
            <option value="entry">Entry</option>
            <option value="clean-out">Clean out</option>
            <option value="dirty-in">Dirty in</option>
            <option value="closed">Closed</option>
          </select>
        </label>}
        <div className="inspector-actions">
          {opening.kind === 'door' && doorType !== 'double-sliding' && <button type="button" aria-label="Flip door" onClick={flipDoor}>Flip door</button>}
          <button type="button" className="danger-button" onClick={remove}>Remove</button>
        </div>
      </aside>
    )
  }

  if (selection.kind === 'pillar') {
    const index = architecture.pillars.findIndex((pillar) => pillar.id === selection.id)
    if (index < 0) return null
    const pillar = architecture.pillars[index]
    const patch = (partial: Partial<typeof pillar>) => apply({ ...architecture, pillars: architecture.pillars.map((candidate, position) => position === index ? { ...candidate, ...partial } : candidate) })
    return (
      <aside className="inspector space-item-inspector" aria-label="Selected pillar">
        <div className="panel-heading"><span className="eyebrow">Structure</span><h2>{pillar.shape === 'round' ? 'Round column' : 'Pillar'}</h2></div>
        <div className="field-pair">
          <NumberField label="X (mm)" value={pillar.xMm} onChange={(xMm) => patch({ xMm })} />
          <NumberField label="Y (mm)" value={pillar.yMm} onChange={(yMm) => patch({ yMm })} />
          <NumberField label="Width (mm)" value={pillar.widthMm} onChange={(widthMm) => patch({ widthMm })} />
          <NumberField label="Depth (mm)" value={pillar.depthMm} onChange={(depthMm) => patch({ depthMm })} />
        </div>
        <div className="inspector-actions">
          <button type="button" className="danger-button" onClick={remove}>Remove</button>
        </div>
      </aside>
    )
  }

  const index = architecture.storageZones.findIndex((zone) => zone.id === selection.id)
  if (index < 0) return null
  const zone = architecture.storageZones[index]
  const patch = (partial: Partial<typeof zone>) => apply({ ...architecture, storageZones: architecture.storageZones.map((candidate, position) => position === index ? { ...candidate, ...partial } : candidate) })
  return (
    <aside className="inspector space-item-inspector" aria-label="Selected zone">
      <div className="panel-heading"><span className="eyebrow">Zone</span><h2>{zone.label}</h2></div>
      <TextField key={`${zone.id}-${zone.label}`} label="Label" value={zone.label} onCommit={(label) => patch({ label })} />
      <div className="field-pair">
        <NumberField label="X (mm)" value={zone.xMm} onChange={(xMm) => patch({ xMm })} />
        <NumberField label="Y (mm)" value={zone.yMm} onChange={(yMm) => patch({ yMm })} />
        <NumberField label="Width (mm)" value={zone.widthMm} onChange={(widthMm) => patch({ widthMm })} />
        <NumberField label="Depth (mm)" value={zone.depthMm} onChange={(depthMm) => patch({ depthMm })} />
      </div>
      <label className="checkbox-row"><input type="checkbox" checked={zone.adjacent} onChange={(event) => patch({ adjacent: event.target.checked })} />Adjacent storage</label>
      <div className="inspector-actions">
        <button type="button" className="danger-button" onClick={remove}>Remove</button>
      </div>
    </aside>
  )
}
