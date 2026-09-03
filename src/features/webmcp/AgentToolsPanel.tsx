import { useEffect, useRef, useState } from 'react'
import type { WebMcpActivityEntry, WebMcpController, WebMcpStatus } from '../../webmcp/webmcp-controller'
import { useWebMcpController } from './WebMcpProvider'

const STATUS_LABELS: Record<WebMcpStatus, string> = {
  idle: 'Registering agent tools…',
  unavailable: 'Agent tools unavailable in this browser',
  available: 'Agent tools active',
  partial: 'Agent tools partially registered',
  error: 'Agent tool registration failed',
}

const STATUS_CLASS_NAMES: Record<WebMcpStatus, string> = {
  idle: 'ai-tools-status idle',
  unavailable: 'ai-tools-status unavailable',
  available: 'ai-tools-status available',
  partial: 'ai-tools-status partial',
  error: 'ai-tools-status error',
}

const SETUP_GUIDANCE =
  'WebMCP is an experimental browser API. Use a compatible browser and agent (for example a Chromium build with WebMCP enabled) on a secure page. The planner stays fully usable without it — every tool has a human equivalent.'

const IMAGE_POLICY =
  'Reference images stay with your agent: attach them to your AI conversation, not here. This page never receives, uploads, or interprets images or instructions — your agent translates them into millimetre coordinates.'

const COORDINATE_SUMMARY = [
  'Origin (0, 0) at the room\u2019s top-left corner',
  '+x runs left to right along the room width',
  '+y runs top to bottom along the room depth',
  'All coordinates and dimensions are millimetres',
  'Rotation is clockwise around each component\u2019s centre',
  'A component position is its unrotated top-left corner',
]

const formatTime = (iso: string) => {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleTimeString(undefined, { hour12: false })
}

type AgentToolsPanelProps = {
  onClose(): void
  controller?: WebMcpController
}

export function AgentToolsPanel({ onClose, controller: controllerProp }: AgentToolsPanelProps) {
  const contextController = useWebMcpController()
  const controller = controllerProp ?? contextController
  const promptRef = useRef<HTMLPreElement>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'selected'>('idle')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!controller) return null

  const status = controller.getStatus()
  const statusMessage = controller.getStatusMessage()
  const tools = controller.getTools()
  const activity = controller.getActivity()
  const starterPrompt = controller.getStarterPrompt()

  const copyStarterPrompt = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(starterPrompt)
        setCopyState('copied')
        return
      }
    } catch {
      // fall through to selection fallback
    }
    const promptNode = promptRef.current
    if (promptNode) {
      const range = document.createRange()
      range.selectNodeContents(promptNode)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      setCopyState('selected')
    }
  }

  return (
    <section className="ai-tools-drawer" role="dialog" aria-label="AI agent tools" data-testid="ai-tools-panel">
      <header className="ai-tools-header">
        <div>
          <h2>AI tools</h2>
          <p className={STATUS_CLASS_NAMES[status]}>{STATUS_LABELS[status]}</p>
        </div>
        <button type="button" className="ai-tools-close" aria-label="Close AI tools" onClick={onClose}>✕</button>
      </header>

      {status !== 'available' && status !== 'partial' && (
        <p className="ai-tools-guidance" role="note">{status === 'idle' ? statusMessage : SETUP_GUIDANCE}</p>
      )}
      {status === 'partial' && <p className="ai-tools-guidance" role="note">{statusMessage}</p>}

      <div className="ai-tools-body">
        <section aria-label="Reference image policy">
          <h3>Who sees your images</h3>
          <p>{IMAGE_POLICY}</p>
        </section>

        <section aria-label="Starter prompt for your agent">
          <h3>Starter prompt</h3>
          <pre ref={promptRef} className="ai-tools-prompt">{starterPrompt}</pre>
          <div className="ai-tools-copy-row">
            <button type="button" onClick={() => void copyStarterPrompt()}>
              {copyState === 'copied' ? 'Copied ✓' : copyState === 'selected' ? 'Selected — press ⌘/Ctrl+C' : 'Copy prompt'}
            </button>
          </div>
        </section>

        <section aria-label="Coordinate system">
          <h3>Coordinate system</h3>
          <ul className="ai-tools-coordinates">
            {COORDINATE_SUMMARY.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>

        <section aria-label="Registered agent tools">
          <h3>Registered tools</h3>
          <ul className="ai-tools-list">
            {tools.map((tool) => (
              <li key={tool.name}>
                <span className={`ai-tools-tool-badge${tool.readOnly ? ' read' : ' write'}`}>{tool.readOnly ? 'read' : 'write'}</span>
                <code>{tool.name}</code>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Recent agent activity">
          <h3>Recent activity</h3>
          {activity.length === 0 ? (
            <p className="ai-tools-empty">No agent activity yet.</p>
          ) : (
            <ul className="ai-tools-activity">
              {activity.map((entry: WebMcpActivityEntry) => (
                <li key={entry.id} className={entry.ok ? 'ok' : 'failed'}>
                  <span className="ai-tools-activity-dot" aria-hidden="true">{entry.ok ? '●' : '▲'}</span>
                  <span className="ai-tools-activity-meta">
                    {formatTime(entry.at)} · <code>{entry.tool}</code>
                    {entry.revision === undefined ? '' : ` · rev ${entry.revision}`}
                  </span>
                  <span className="ai-tools-activity-summary">{entry.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
