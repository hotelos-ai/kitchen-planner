import { useRef, useState, type ChangeEvent } from 'react'
import { importProject } from '../state/persistence'
import { RoomStartForm } from './RoomStartForm'
import type { Architecture, KitchenProject } from '../domain/project'

type StartChoice = 'home' | 'scratch' | 'dimensions' | 'trace' | 'draw'

type Props = {
  onScratch?(): void
  onStarterKitchen?(): void
  onCreateRoom(architecture: Architecture): void
  onDrawManually(): void
  onOpenProject(project: KitchenProject): void
  onTraceImage?(dataUrl: string): void
}

export function ProjectStartScreen({ onCreateRoom, onDrawManually, onOpenProject, onTraceImage, onScratch, onStarterKitchen }: Props) {
  const [choice, setChoice] = useState<StartChoice>('home')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const onOpenFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      onOpenProject(importProject(await file.text()))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open that project file.')
    }
    event.target.value = ''
  }

  if (choice === 'dimensions') return <RoomStartForm onCreated={onCreateRoom} onBack={() => setChoice('home')} onCustomPolygon={onDrawManually} />

  if (choice === 'trace') {
    return (
      <section className="start-screen" aria-label="Trace a floor plan">
        <header>
          <p className="eyebrow">Create your kitchen space</p>
          <h2>Trace a floor plan</h2>
          <p>Upload a PDF or image, then draw over it in the Space stage. Use Source reference to control opacity and scale.</p>
        </header>
        <ol className="start-steps">
          <li>Upload a PDF or image</li>
          <li>Draw one known measurement and enter its real length</li>
          <li>Lock the reference and trace walls and fixed objects</li>
        </ol>
        <label>Upload floor plan
          <input
            type="file"
            accept="image/*,application/pdf"
            aria-label="Upload floor plan"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              onTraceImage?.(URL.createObjectURL(file))
            }}
          />
        </label>
        <footer>
          <button type="button" onClick={() => setChoice('home')}>Back</button>
          <button type="button" className="primary-button" onClick={onDrawManually}>Continue to drawing</button>
        </footer>
      </section>
    )
  }

  if (choice === 'scratch') {
    return (
      <section className="start-screen" aria-label="Design from scratch">
        <header>
          <p className="eyebrow">CalmKitchen Designer</p>
          <h2>Design from scratch</h2>
          <p>Start with a blank Kitchen 1 — how do you want to draw the room?</p>
        </header>
        <div className="start-choices">
          <button type="button" onClick={() => setChoice('dimensions')}>
            <strong>Enter room dimensions</strong>
            <span>Fastest option for a simple room</span>
          </button>
          <button type="button" onClick={() => setChoice('trace')}>
            <strong>Trace a floor plan</strong>
            <span>Upload a PDF or image and draw over it</span>
          </button>
          <button type="button" onClick={onDrawManually}>
            <strong>Draw manually</strong>
            <span>For irregular rooms and multiple areas</span>
          </button>
        </div>
        <footer>
          <button type="button" onClick={() => setChoice('home')}>‹ Back</button>
        </footer>
      </section>
    )
  }

  return (
    <section className="start-screen" aria-label="Create your kitchen space">
      <header>
        <p className="eyebrow">CalmKitchen Designer</p>
        <h2>Create your kitchen space</h2>
        <p>How would you like to start?</p>
      </header>
      <div className="start-choices">
        <button type="button" onClick={() => { onScratch?.(); setChoice('scratch') }}>
          <strong>Design from scratch</strong>
          <span>A blank kitchen you shape yourself</span>
        </button>
        <button type="button" onClick={() => onStarterKitchen?.()}>
          <strong>Simple starter kitchen</strong>
          <span>A fully equipped example to explore and edit</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          <strong>Upload a file</strong>
          <span>Open a saved CalmKitchen Designer project</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Open saved project" hidden onChange={onOpenFile} />
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
