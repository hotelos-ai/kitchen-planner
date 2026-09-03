type Props = { onClose(): void }

const MANUAL_STEPS = [
  { title: 'Space — shape the room', body: 'Drag the outline vertices to reshape the kitchen, slide walls, or click a wall midpoint (+) to add a vertex. Drag the magenta dots to slide doors and service windows along their wall, and drag pillars to reposition them. The Floor plan panel on the right gives exact millimetre control.' },
  { title: 'Fit-out — place equipment', body: 'Add equipment from the library (or drop in a station template), then drag it on the plan. Select an item to rotate, resize, configure, and set its clearances. Layout tabs keep alternatives side by side; ＋ starts a blank layout and ⧉ clones the current one.' },
  { title: 'Simulate — pressure-test service', body: 'Pick a scenario (covers, staff, arrival pattern) and run the service. Playback shows queues, staff movement, and bottlenecks; findings link back to the plan. Identical seeds give identical results.' },
  { title: 'Compare and export', body: 'With two layouts or scenarios, Compare shows metric deltas and evidence-backed findings. Save project downloads a resumable file; Export covers PDFs, equipment schedules, and reports.' },
]

const AGENT_STEPS = [
  { title: 'What it is', body: 'CalmKitchen Designer exposes its workspace over WebMCP, so an AI agent you trust can read and edit the plan alongside you — the same atomic operations the UI uses, nothing more.' },
  { title: 'Connect an agent', body: 'Open the AI tools panel from the top bar, or point an MCP-capable client at this page. The agent discovers tools like reading the layout, moving equipment, running simulations, and exporting the project.' },
  { title: 'Work together', body: 'Every agent edit goes through the same history as yours — undo (⌘Z) reverts agent changes too. Review findings in Compare before adopting anything. You stay the chef de cuisine; the agent is the commis.' },
]

export function HelpDialog({ onClose }: Props) {
  return (
    <div className="layout-wizard-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog help-dialog" role="dialog" aria-modal="true" aria-label="How to use CalmKitchen Designer" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <span className="eyebrow">How to</span>
          <h2>Designing a kitchen with CalmKitchen</h2>
          <p>Four stages, one shared floor plan, deterministic answers.</p>
        </div>
        <div className="dialog-body help-dialog-body">
          <section aria-label="Using the app manually">
            <h3>By hand</h3>
            <ol className="help-steps">
              {MANUAL_STEPS.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="help-hint">Shortcuts: 1 / 2 / 3 switch stages · ⌘Z undo · ⌘D duplicate · [ ] rotate · Esc closes.</p>
          </section>
          <section aria-label="Using an AI agent via WebMCP">
            <h3>With an AI agent (WebMCP)</h3>
            <ol className="help-steps">
              {AGENT_STEPS.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="help-hint">Learn more at <a href="https://hotelos.ai/kitchen" target="_blank" rel="noreferrer">hotelos.ai/kitchen</a>.</p>
          </section>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
