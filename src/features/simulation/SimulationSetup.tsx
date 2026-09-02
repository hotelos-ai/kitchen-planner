import { useMemo, useState } from 'react'
import { DEFAULT_GENERATED_MENU, parseMenuText, type EstimatedMenuItem } from '../../domain/menu-templates'
import type { SimulationScenario } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'

type SetupPath = 'quick' | 'menu' | 'detailed' | null

type Props = {
  scenario: SimulationScenario
  store: ProjectStore
  onRun(): void
  onChange(patch: Partial<SimulationScenario>): void
}

export function SimulationSetup({ scenario, store: _store, onRun, onChange }: Props) {
  const [path, setPath] = useState<SetupPath>(null)
  const [menu, setMenu] = useState<EstimatedMenuItem[]>(DEFAULT_GENERATED_MENU)
  const [menuText, setMenuText] = useState('')
  const [reviewItem, setReviewItem] = useState<EstimatedMenuItem | null>(null)
  const staffCount = scenario.staff.reduce((sum, entry) => sum + entry.count, 0)
  const estimatedCount = menu.filter((item) => item.source !== 'user-provided').length

  const applyQuickEstimate = () => {
    onChange({
      name: scenario.name || 'Dinner peak',
      covers: scenario.covers || 45,
      durationMinutes: scenario.durationMinutes || 60,
      variability: scenario.variability ?? 'typical',
      serviceStyle: scenario.serviceStyle ?? 'À la carte',
    })
    setMenu(DEFAULT_GENERATED_MENU)
    setPath('quick')
  }

  const importMenu = () => {
    const parsed = parseMenuText(menuText)
    if (parsed.length) setMenu(parsed)
    setPath('menu')
  }

  const summary = useMemo(() => (
    <p>
      {menu.length} representative menu items · {staffCount} staff · {scenario.covers} covers in {scenario.durationMinutes} minutes.
      {estimatedCount} values estimated by Kitchen Planner.
    </p>
  ), [estimatedCount, menu.length, scenario.covers, scenario.durationMinutes, staffCount])

  if (!path) {
    return (
      <section className="simulation-setup" aria-label="Set up a service simulation">
        <h2>Set up a service simulation</h2>
        <p>How would you like to start?</p>
        <div className="start-choices">
          <button type="button" onClick={applyQuickEstimate}>
            <strong>Quick estimate — Recommended</strong>
            <span>Generate a realistic menu, station routes and timings from your restaurant profile. You can review every assumption.</span>
          </button>
          <button type="button" onClick={() => setPath('menu')}>
            <strong>Use my menu</strong>
            <span>Paste, upload or enter your own menu. Station routes and timings will be suggested.</span>
          </button>
          <button type="button" onClick={() => setPath('detailed')}>
            <strong>Build a detailed model</strong>
            <span>Define menu steps, staff roles, timings, batching and demand manually.</span>
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="simulation-setup" aria-label="Simulation setup">
      {path === 'quick' && (
        <>
          <h2>Quick estimate</h2>
          <label>Scenario name<input aria-label="Scenario name" value={scenario.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
          <label>Service style
            <select aria-label="Quick service style" value={scenario.serviceStyle ?? 'À la carte'} onChange={(event) => onChange({ serviceStyle: event.target.value })}>
              <option>À la carte</option>
              <option>Buffet</option>
              <option>Counter service</option>
              <option>Room service</option>
            </select>
          </label>
          <label>Guests<input aria-label="Guests" type="number" min="1" value={scenario.covers} onChange={(event) => onChange({ covers: Math.max(1, Number(event.target.value)) })} /></label>
          <label>Time period (minutes)<input aria-label="Time period" type="number" min="10" value={scenario.durationMinutes} onChange={(event) => onChange({ durationMinutes: Math.max(10, Number(event.target.value)) })} /></label>
          <label>Service variability
            <select aria-label="Quick service variability" value={scenario.variability ?? 'typical'} onChange={(event) => onChange({ variability: event.target.value as SimulationScenario['variability'] })}>
              <option value="low">Low</option>
              <option value="typical">Typical</option>
              <option value="high">High</option>
            </select>
          </label>
          {summary}
          <p>We will generate representative menu items, order popularity, station routes, and a realistic peak-hour arrival pattern.</p>
          <div className="stage-actions">
            <button type="button" onClick={() => setReviewItem(menu[0])}>Review assumptions</button>
            <button type="button" className="primary-button" onClick={onRun}>Run quick simulation</button>
          </div>
        </>
      )}
      {path === 'menu' && (
        <>
          <h2>Use my menu</h2>
          <label>Paste menu text
            <textarea aria-label="Paste menu text" value={menuText} onChange={(event) => setMenuText(event.target.value)} rows={6} />
          </label>
          <label>Upload menu file
            <input
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv,application/pdf"
              aria-label="Upload menu file"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setMenuText(await file.text())
              }}
            />
          </label>
          <button type="button" onClick={importMenu}>Extract menu items</button>
          {menu.length > 0 && <p>{menu.length} menu items found. Station routes are suggested and editable.</p>}
        </>
      )}
      {path === 'detailed' && <p>Use the scenario fields below to refine demand, staffing, timings and capacity.</p>}
      <MenuTable menu={menu} onSelect={setReviewItem} />
      {reviewItem && <MenuItemDetail item={reviewItem} onClose={() => setReviewItem(null)} />}
      <button type="button" className="link-button" onClick={() => setPath(null)}>Change setup method</button>
    </section>
  )
}

function MenuTable({ menu, onSelect }: { menu: EstimatedMenuItem[]; onSelect(item: EstimatedMenuItem): void }) {
  return (
    <table className="menu-table" aria-label={`Menu · ${menu.length} items`}>
      <thead><tr><th>Item</th><th>Share</th><th>Route</th><th>Time</th><th>Source</th></tr></thead>
      <tbody>
        {menu.map((item) => (
          <tr key={item.id}>
            <td><button type="button" className="link-button" onClick={() => onSelect(item)}>{item.name}</button></td>
            <td>{item.sharePct}%</td>
            <td>{item.route}</td>
            <td>{item.timeRangeMinutes[0]}–{item.timeRangeMinutes[1]}m</td>
            <td>{item.source === 'template-estimate' ? 'Estimated' : item.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MenuItemDetail({ item, onClose }: { item: EstimatedMenuItem; onClose(): void }) {
  return (
    <article className="menu-item-detail" aria-label={item.name}>
      <header><h3>{item.name}</h3><button type="button" aria-label="Close menu item" onClick={onClose}>×</button></header>
      <ol>
        {item.steps.map((step) => (
          <li key={step.label}>
            <strong>{step.label}</strong>
            <span>Station: {step.station}</span>
            <span>Active time: {step.activeSeconds} sec</span>
            {step.cookingSeconds && <span>Cooking time: {Math.round(step.cookingSeconds.min / 60)}–{Math.round(step.cookingSeconds.max / 60)} min</span>}
          </li>
        ))}
      </ol>
    </article>
  )
}

export function StressTestPresets({ scenario, store, onRun }: { scenario: SimulationScenario; store: ProjectStore; onRun(): void }) {
  const duplicate = (name: string, patch: Partial<SimulationScenario>) => {
    const id = `stress-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
    store.getState().patchProject((project) => {
      project.scenarios.push({ ...structuredClone(scenario), ...patch, id, name })
      project.activeScenarioId = id
    })
    onRun()
  }
  return (
    <section className="stress-tests" aria-label="Stress test this layout">
      <h3>Stress test this layout</h3>
      <button type="button" onClick={() => duplicate(`${scenario.name} +25% demand`, { covers: Math.round(scenario.covers * 1.25) })}>+25% demand</button>
      <button type="button" onClick={() => duplicate(`${scenario.name} · one cook absent`, { staff: scenario.staff.map((entry) => entry.role === 'cdp' ? { ...entry, count: Math.max(1, entry.count - 1) } : entry) })}>One cook absent</button>
      <button type="button" onClick={() => duplicate(`${scenario.name} · equipment outage`, { stationCapacities: Object.fromEntries(Object.entries(scenario.stationCapacities ?? {}).map(([id, count], index) => [id, index === 0 ? 1 : count])) })}>Equipment outage</button>
      <button type="button" onClick={() => duplicate(`${scenario.name} · menu mix shift`, { cookToOrderRatio: Math.min(1, scenario.cookToOrderRatio + 0.1) })}>Menu mix shift</button>
      <button type="button" onClick={() => duplicate(`${scenario.name} · large group`, { arrivalPattern: 'seating-wave', covers: scenario.covers })}>Large group arrives</button>
    </section>
  )
}

export function ConfidenceLedger({ userProvided, equipmentDerived, templateEstimates, unresolved = 0 }: { userProvided: number; equipmentDerived: number; templateEstimates: number; unresolved?: number }) {
  const confidence = unresolved > 0 || templateEstimates > userProvided ? 'Medium' : 'High'
  return (
    <aside className="simulation-assumptions" aria-label="Model confidence">
      <strong>Model confidence: {confidence}</strong>
      <p>Provided by you {userProvided} values · Equipment-derived {equipmentDerived} values · Template estimates {templateEstimates} values · Unresolved assumptions {unresolved}</p>
      <p className="disclaimer">Comparative planning aid — verify fire, ventilation, hygiene, accessibility, and worker safety with qualified local professionals.</p>
    </aside>
  )
}
