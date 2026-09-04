import { Suspense, lazy, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { importProject } from '../state/persistence'
import { RoomStartForm } from './RoomStartForm'
import type { Architecture, KitchenProject } from '../domain/project'

const SceneWorkspace = lazy(() => import('../features/scene/SceneWorkspace').then((module) => ({ default: module.SceneWorkspace })))
const LANDING_PREVIEW_MEDIA_QUERY = '(min-width: 901px)'

type StartChoice = 'home' | 'scratch' | 'dimensions' | 'trace' | 'draw'

const ROTATING_LINES = [
  'Simulate service traffic.',
  'Find the ideal layout.',
  'Walk the room in 3D.',
  'Pressure-test the dinner rush.',
  'Compare every option.',
]

function RotatingHeadline() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % ROTATING_LINES.length), 2600)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <span className="hero-rotating" aria-live="off">
      <span key={index} className="hero-rotating-line">{ROTATING_LINES[index]}</span>
    </span>
  )
}

function useLandingPreviewEnabled() {
  const [enabled, setEnabled] = useState(() => (
    typeof window === 'undefined'
    || typeof window.matchMedia !== 'function'
    || window.matchMedia(LANDING_PREVIEW_MEDIA_QUERY).matches
  ))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(LANDING_PREVIEW_MEDIA_QUERY)
    const onChange = (event: MediaQueryListEvent) => setEnabled(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return enabled
}

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
  const [walkPreview, setWalkPreview] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const previewEnabled = useLandingPreviewEnabled()

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
    <section className="start-screen landing" aria-label="Create your kitchen space">
      {previewEnabled && (
        <div className="landing-3d" aria-label="Example kitchen in 3D">
          <Suspense fallback={<div className="landing-3d-placeholder">Loading the example kitchen…</div>}>
            <SceneWorkspace readOnly walkMode={walkPreview} />
          </Suspense>
          <div className="landing-3d-toggle" role="group" aria-label="Preview mode">
            <button type="button" className={walkPreview ? '' : 'active'} onClick={() => setWalkPreview(false)}>3D view</button>
            <button type="button" className={walkPreview ? 'active' : ''} onClick={() => setWalkPreview(true)}>Walk mode</button>
          </div>
          <p className="landing-3d-hint">{walkPreview ? 'W A S D to move · drag to look · Esc to release' : 'Drag to orbit · scroll to zoom'}</p>
        </div>
      )}
      <div className="landing-hero">
        <p className="eyebrow">CalmKitchen Designer · by HotelOS</p>
        <h1>Design commercial kitchens.</h1>
        <p className="hero-rotating-wrap"><RotatingHeadline /></p>
        <p className="hero-sub">Draw the room, fit it out, then watch a full dinner service play out — queues, walking, bottlenecks — before anyone welds a steel bench.</p>
        <div className="landing-actions">
          <button type="button" className="landing-primary" aria-label="Start designing — simple starter kitchen" onClick={() => onStarterKitchen?.()}>
            Start designing
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="landing-upload" aria-label="Upload a file" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11V2m0 0L4.5 5.5M8 2l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.5 11v1.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Upload a file
          </button>
          <button type="button" className="landing-scratch" onClick={() => { onScratch?.(); setChoice('scratch') }}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13l.9-3.2L10.6 3.1a1.6 1.6 0 0 1 2.3 0 1.6 1.6 0 0 1 0 2.3L6.2 12.1 3 13Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            Design from scratch
          </button>
        </div>
        <div className="landing-features" aria-label="What you get">
          <span className="chip"><i style={{ background: 'var(--cat-cooking)' }} />2D drafting</span>
          <span className="chip"><i style={{ background: 'var(--cat-cold)' }} />3D walkthrough</span>
          <span className="chip"><i style={{ background: 'var(--cat-wash)' }} />Deterministic simulation</span>
          <span className="chip"><i style={{ background: 'var(--cat-prep)' }} />Layout comparison</span>
        </div>
        <section className="landing-seo-summary" aria-labelledby="landing-capabilities-title">
          <h2 id="landing-capabilities-title">Commercial kitchen planning, from floor plan to service</h2>
          <p>Build dimensioned layouts with doors, windows, stainless-steel equipment, storage, and waste stations. Review the kitchen in 3D, walk the room, and simulate a dinner rush before construction begins.</p>
        </section>
        <p className="landing-explore">
          Curious what CalmKitchen does for running a kitchen? <a href="https://kitchen.hotelos.ai" target="_blank" rel="noreferrer">Learn about CalmKitchen ↗</a>
          <span className="footer-sep" aria-hidden="true"></span>
          <a href="https://hotelos.ai/kitchen" target="_blank" rel="noreferrer">Explore HotelOS ↗</a>
        </p>
        <aside className="landing-agent" aria-label="Bring your own agent">
          <div className="landing-agent-head">
            <span className="landing-agent-pulse" aria-hidden="true"></span>
            <strong>Bring your own agent</strong>
            <span className="landing-agent-tag">WebMCP</span>
          </div>
          <pre><code><span className="agent-user">you ›</span> read the current layout
<span className="agent-user">you ›</span> move the fry line 300&nbsp;mm off the pass
<span className="agent-user">you ›</span> run the dinner-peak simulation
<span className="agent-model">designer ›</span> done — P90 wait 12:41, fry station clearing. want the diff?</code></pre>
          <p>Agents drive the same atomic workspace ops you do — every edit lands in your undo history. Start designing, then hit <em>Use your AI agent</em> in the top bar to connect.</p>
        </aside>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Open saved project" hidden onChange={onOpenFile} />
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
