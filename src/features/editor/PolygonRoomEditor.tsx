import type { Architecture, Opening, RectMm, StorageZone } from '../../domain/project'

type Props = {
  value: Architecture
  onChange(value: Architecture): void
}

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
const numberValue = (value: string) => Number(value)

export function PolygonRoomEditor({ value, onChange }: Props) {
  const updateOpening = (index: number, patch: Partial<Opening>) => onChange({
    ...value,
    openings: value.openings.map((opening, candidate) => candidate === index ? { ...opening, ...patch } : opening),
  })
  const updatePillar = (index: number, patch: Partial<RectMm>) => onChange({
    ...value,
    pillars: value.pillars.map((pillar, candidate) => candidate === index ? { ...pillar, ...patch } : pillar),
  })
  const updateZone = (index: number, patch: Partial<StorageZone>) => onChange({
    ...value,
    storageZones: value.storageZones.map((zone, candidate) => candidate === index ? { ...zone, ...patch } : zone),
  })
  const addOpening = (kind: 'door' | 'window' | 'service-window') => {
    const opening: Opening = kind === 'door'
      ? { id: makeId('door'), label: 'Door', kind, wall: 'top', offsetMm: 500, widthMm: 900, flow: 'entry', swingDepthMm: 900, swingHinge: 'start', swingDirection: 'inward' }
      : kind === 'window'
        ? { id: makeId('window'), label: 'Window', kind, wall: 'top', offsetMm: 1500, widthMm: 1200, sillHeightMm: 1_000, heightMm: 1_200, flow: 'closed' }
        : { id: makeId('service-window'), label: 'Service window', kind, wall: 'top', offsetMm: 1500, widthMm: 900, sillHeightMm: 900, heightMm: 1000, flow: 'clean-out' }
    onChange({ ...value, openings: [...value.openings, opening] })
  }

  return (
    <fieldset>
      <legend>Advanced room geometry</legend>
      <label>
        Wall height (mm)
        <input type="number" min="1000" step="100" value={value.wallHeightMm} onChange={(event) => onChange({ ...value, wallHeightMm: numberValue(event.target.value) })} />
      </label>

      <fieldset>
        <legend>Wall vertices</legend>
        {value.roomPolygon.map((point, index) => (
          <div key={index} className="field-pair">
            <label>
              {`Vertex ${index + 1} X (mm)`}
              <input type="number" step="100" value={point.x} onChange={(event) => onChange({
                ...value,
                roomPolygon: value.roomPolygon.map((candidate, pointIndex) => pointIndex === index ? { ...candidate, x: numberValue(event.target.value) } : candidate),
              })} />
            </label>
            <label>
              {`Vertex ${index + 1} Y (mm)`}
              <input type="number" step="100" value={point.y} onChange={(event) => onChange({
                ...value,
                roomPolygon: value.roomPolygon.map((candidate, pointIndex) => pointIndex === index ? { ...candidate, y: numberValue(event.target.value) } : candidate),
              })} />
            </label>
            <button
              type="button"
              aria-label={`Remove vertex ${index + 1}`}
              disabled={value.roomPolygon.length <= 3}
              onClick={() => onChange({ ...value, roomPolygon: value.roomPolygon.filter((_, pointIndex) => pointIndex !== index) })}
            >Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => {
          const last = value.roomPolygon.at(-1) ?? { x: 0, y: 0 }
          onChange({ ...value, roomPolygon: [...value.roomPolygon, { x: last.x + 500, y: last.y }] })
        }}>Add wall vertex</button>
      </fieldset>

      <fieldset>
        <legend>Openings and service windows</legend>
        {value.openings.map((opening, index) => (
          <div key={opening.id}>
            <label>
              {`Opening ${index + 1} label`}
              <input value={opening.label} onChange={(event) => updateOpening(index, { label: event.target.value })} />
            </label>
            <label>
              {`Opening ${index + 1} wall`}
              <select value={opening.wall} onChange={(event) => updateOpening(index, { wall: event.target.value as Opening['wall'] })}>
                <option value="top">Top</option><option value="right">Right</option><option value="bottom">Bottom</option><option value="left">Left</option>
              </select>
            </label>
            <label>
              {`Opening ${index + 1} wall segment`}
              <select
                value={opening.segmentIndex === undefined ? '' : String(opening.segmentIndex + 1)}
                onChange={(event) => updateOpening(index, { segmentIndex: event.target.value ? Number(event.target.value) - 1 : undefined })}
              >
                <option value="">Use named wall fallback</option>
                {value.roomPolygon.map((_, segmentIndex) => (
                  <option key={segmentIndex} value={segmentIndex + 1}>Wall segment {segmentIndex + 1}</option>
                ))}
              </select>
            </label>
            <label>
              {`Opening ${index + 1} offset (mm)`}
              <input type="number" min="0" step="100" value={opening.offsetMm} onChange={(event) => updateOpening(index, { offsetMm: numberValue(event.target.value) })} />
            </label>
            <label>
              {`Opening ${index + 1} width (mm)`}
              <input type="number" min="100" step="100" value={opening.widthMm} onChange={(event) => updateOpening(index, { widthMm: numberValue(event.target.value) })} />
            </label>
            {opening.kind === 'door' && <>
              <label>{`Opening ${index + 1} hinge side`}<select value={opening.swingHinge ?? 'start'} onChange={(event) => updateOpening(index, { swingHinge: event.target.value as NonNullable<Opening['swingHinge']> })}><option value="start">Start of opening</option><option value="end">End of opening</option></select></label>
              <label>{`Opening ${index + 1} direction`}<select value={opening.swingDirection ?? 'inward'} onChange={(event) => updateOpening(index, { swingDirection: event.target.value as NonNullable<Opening['swingDirection']> })}><option value="inward">Into room</option><option value="outward">Out of room</option></select></label>
            </>}
            {(opening.kind === 'window' || opening.kind === 'service-window') && <>
              <label>{`Opening ${index + 1} sill height (mm)`}<input type="number" min="0" step="100" value={opening.sillHeightMm ?? 900} onChange={(event) => updateOpening(index, { sillHeightMm: numberValue(event.target.value) })} /></label>
              <label>{`Opening ${index + 1} opening height (mm)`}<input type="number" min="100" step="100" value={opening.heightMm ?? 900} onChange={(event) => updateOpening(index, { heightMm: numberValue(event.target.value) })} /></label>
            </>}
            {opening.kind !== 'window' && <label>
              {`Opening ${index + 1} flow`}
              <select value={opening.flow ?? 'closed'} onChange={(event) => updateOpening(index, { flow: event.target.value as Opening['flow'] })}>
                <option value="entry">Entry</option><option value="clean-out">Clean out</option><option value="dirty-in">Dirty in</option><option value="closed">Closed</option>
              </select>
            </label>}
            <button type="button" aria-label={`Remove opening ${index + 1}`} onClick={() => onChange({ ...value, openings: value.openings.filter((_, candidate) => candidate !== index) })}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => addOpening('door')}>Add door opening</button>
        <button type="button" onClick={() => addOpening('window')}>Add regular window</button>
        <button type="button" onClick={() => addOpening('service-window')}>Add service window</button>
      </fieldset>

      <fieldset>
        <legend>Pillars</legend>
        {value.pillars.map((pillar, index) => (
          <div key={pillar.id}>
            {(['xMm', 'yMm', 'widthMm', 'depthMm'] as const).map((field) => (
              <label key={field}>
                {`Pillar ${index + 1} ${field === 'xMm' ? 'X' : field === 'yMm' ? 'Y' : field === 'widthMm' ? 'width' : 'depth'} (mm)`}
                <input type="number" min={field === 'widthMm' || field === 'depthMm' ? 100 : undefined} step="100" value={pillar[field]} onChange={(event) => updatePillar(index, { [field]: numberValue(event.target.value) })} />
              </label>
            ))}
            <button type="button" aria-label={`Remove pillar ${index + 1}`} onClick={() => onChange({ ...value, pillars: value.pillars.filter((_, candidate) => candidate !== index) })}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...value, pillars: [...value.pillars, { id: makeId('pillar'), xMm: 1000, yMm: 1000, widthMm: 400, depthMm: 400 }] })}>Add pillar</button>
      </fieldset>

      <fieldset>
        <legend>Storage zones</legend>
        {value.storageZones.map((zone, index) => (
          <div key={zone.id}>
            <label>{`Storage zone ${index + 1} label`}<input value={zone.label} onChange={(event) => updateZone(index, { label: event.target.value })} /></label>
            {(['xMm', 'yMm', 'widthMm', 'depthMm'] as const).map((field) => (
              <label key={field}>
                {`Storage zone ${index + 1} ${field === 'xMm' ? 'X' : field === 'yMm' ? 'Y' : field === 'widthMm' ? 'width' : 'depth'} (mm)`}
                <input type="number" min={field === 'widthMm' || field === 'depthMm' ? 100 : undefined} step="100" value={zone[field]} onChange={(event) => updateZone(index, { [field]: numberValue(event.target.value) })} />
              </label>
            ))}
            <label><input type="checkbox" checked={zone.adjacent} onChange={(event) => updateZone(index, { adjacent: event.target.checked })} />Adjacent storage</label>
            <button type="button" aria-label={`Remove storage zone ${index + 1}`} onClick={() => onChange({ ...value, storageZones: value.storageZones.filter((_, candidate) => candidate !== index) })}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...value, storageZones: [...value.storageZones, { id: makeId('storage-zone'), label: 'Storage zone', xMm: 500, yMm: 500, widthMm: 1200, depthMm: 800, adjacent: true }] })}>Add storage zone</button>
      </fieldset>
    </fieldset>
  )
}
