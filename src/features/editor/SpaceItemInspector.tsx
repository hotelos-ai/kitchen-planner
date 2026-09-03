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
  const commit = () => {
    const next = draft.trim()
    if (next) onCommit(next)
    else setDraft(value)
  }
  return <label>{label}<input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
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
    return (
      <aside className="inspector space-item-inspector" aria-label="Selected opening">
        <div className="panel-heading"><span className="eyebrow">{opening.kind === 'service-window' ? 'Service window' : 'Door'}</span><h2>{opening.label}</h2></div>
        <TextField key={`${opening.id}-${opening.label}`} label="Label" value={opening.label} onCommit={(label) => patch({ label })} />
        <div className="field-pair">
          <NumberField label="Offset (mm)" value={opening.offsetMm} onChange={(offsetMm) => patch({ offsetMm })} />
          <NumberField label="Width (mm)" value={opening.widthMm} onChange={(widthMm) => patch({ widthMm })} />
          {opening.kind === 'door' && <NumberField label="Swing depth (mm)" value={opening.swingDepthMm ?? opening.widthMm} onChange={(swingDepthMm) => patch({ swingDepthMm })} />}
        </div>
        <label>Flow
          <select value={opening.flow ?? 'closed'} onChange={(event) => patch({ flow: event.target.value as typeof opening.flow })}>
            <option value="entry">Entry</option>
            <option value="clean-out">Clean out</option>
            <option value="dirty-in">Dirty in</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <div className="inspector-actions">
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
