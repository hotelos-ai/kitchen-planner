import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { importProject } from '../state/persistence'
import { RoomStartForm } from './RoomStartForm'
import type { Architecture, KitchenProject } from '../domain/project'

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
    <section className="start-screen landing" aria-label="Create your kitchen space">
      <svg className="landing-backdrop" viewBox="0 0 1600 900" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <polygon points="500,190 1180,190 1180,430 1060,430 1060,750 500,750 500,685 425,685 425,265 500,265" fill="none" stroke="rgba(27,58,54,0.09)" strokeWidth="3" />
        <rect x="530" y="225" width="150" height="80" fill="none" stroke="rgba(202,78,142,0.12)" strokeWidth="2.5" />
        <rect x="700" y="225" width="120" height="80" fill="none" stroke="rgba(27,58,54,0.08)" strokeWidth="2.5" />
        <rect x="530" y="560" width="140" height="80" fill="none" stroke="rgba(194,147,79,0.13)" strokeWidth="2.5" />
        <rect x="690" y="560" width="200" height="80" fill="none" stroke="rgba(45,124,111,0.12)" strokeWidth="2.5" />
        <line x1="500" y1="785" x2="1180" y2="785" stroke="rgba(27,58,54,0.07)" strokeWidth="1.5" />
        <text x="840" y="812" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="20" fill="rgba(94,107,90,0.35)">6 650 mm</text>
        <circle cx="1370" cy="200" r="70" fill="none" stroke="rgba(177,209,91,0.30)" strokeWidth="2.5" />
        <circle cx="1370" cy="200" r="22" fill="rgba(177,209,91,0.22)" />
        <circle cx="240" cy="710" r="9" fill="rgba(202,78,142,0.25)" />
        <circle cx="285" cy="710" r="9" fill="rgba(202,78,142,0.14)" />
        <line x1="130" y1="130" x2="290" y2="130" stroke="rgba(177,209,91,0.30)" strokeWidth="2" />
        <line x1="130" y1="140" x2="220" y2="140" stroke="rgba(177,209,91,0.16)" strokeWidth="2" />
      </svg>
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
          <button type="button" className="landing-ghost" onClick={() => { onScratch?.(); setChoice('scratch') }}>
            Design from scratch
          </button>
          <button type="button" className="landing-quiet" onClick={() => fileRef.current?.click()}>
            Upload a file
          </button>
        </div>
        <h2 className="landing-kicker">Create your kitchen space</h2>
        <div className="landing-features" aria-label="What you get">
          <span className="chip"><i style={{ background: 'var(--cat-cooking)' }} />2D drafting</span>
          <span className="chip"><i style={{ background: 'var(--cat-cold)' }} />3D walkthrough</span>
          <span className="chip"><i style={{ background: 'var(--cat-wash)' }} />Deterministic simulation</span>
          <span className="chip"><i style={{ background: 'var(--cat-prep)' }} />Layout comparison</span>
        </div>
        <p className="landing-explore">
          Curious what CalmKitchen does for running a kitchen? <a href="https://kitchen.hotelos.ai" target="_blank" rel="noreferrer">Learn about CalmKitchen ↗</a>
          <span className="footer-sep" aria-hidden="true"></span>
          <a href="https://hotelos.ai/kitchen" target="_blank" rel="noreferrer">Explore HotelOS ↗</a>
        </p>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Open saved project" hidden onChange={onOpenFile} />
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
