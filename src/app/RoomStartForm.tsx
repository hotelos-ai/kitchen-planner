import { useState } from 'react'
import { lShapedArchitecture, rectangularArchitecture, uShapedArchitecture } from '../domain/blank-project'
import type { Architecture } from '../domain/project'

type RoomShape = 'rectangle' | 'l' | 'u' | 'polygon'

type Props = {
  onCreated(architecture: Architecture): void
  onBack(): void
  onCustomPolygon?(): void
}

export function RoomStartForm({ onCreated, onBack, onCustomPolygon }: Props) {
  const [shape, setShape] = useState<RoomShape>('rectangle')
  const [lengthMm, setLengthMm] = useState(6200)
  const [widthMm, setWidthMm] = useState(4800)
  const [ceilingMm, setCeilingMm] = useState(2800)

  const create = () => {
    if (shape === 'polygon') {
      onCustomPolygon?.()
      return
    }
    const factory = shape === 'l' ? lShapedArchitecture : shape === 'u' ? uShapedArchitecture : rectangularArchitecture
    onCreated(factory(Math.max(2000, lengthMm), Math.max(2000, widthMm), Math.max(2200, ceilingMm)))
  }

  return (
    <section className="start-screen" aria-label="Enter room dimensions">
      <header>
        <p className="eyebrow">Create your kitchen space</p>
        <h2>Enter room dimensions</h2>
        <p>Fastest option for a simple room. You can adjust walls after the room is created.</p>
      </header>
      <label>Room shape
        <select aria-label="Room shape" value={shape} onChange={(event) => setShape(event.target.value as RoomShape)}>
          <option value="rectangle">Rectangle</option>
          <option value="l">L shape</option>
          <option value="u">U shape</option>
          <option value="polygon">Custom polygon</option>
        </select>
      </label>
      <label>Length (mm)<input aria-label="Room length" type="number" min="2000" step="100" value={lengthMm} onChange={(event) => setLengthMm(Number(event.target.value))} /></label>
      <label>Width (mm)<input aria-label="Room width" type="number" min="2000" step="100" value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} /></label>
      <label>Ceiling height (mm, optional)<input aria-label="Ceiling height" type="number" min="2200" step="50" value={ceilingMm} onChange={(event) => setCeilingMm(Number(event.target.value))} /></label>
      <footer>
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" className="primary-button" onClick={create}>Create room</button>
      </footer>
    </section>
  )
}
