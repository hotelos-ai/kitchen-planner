import { useMemo, useState } from 'react'
import { DEFAULT_GENERATED_MENU, parseMenuText } from '../../domain/menu-templates'
import type { SimulationMenuItem, SimulationScenario, StationCapability } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'

type SetupPath = 'quick' | 'menu' | 'detailed' | null

type Props = {
  scenario: SimulationScenario
  store: ProjectStore
  onRun(): void
  onChange(patch: Partial<SimulationScenario>): void
}

const CAPABILITIES: readonly StationCapability[] = [
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
]

export function SimulationSetup({ scenario, onRun, onChange }: Props) {
  const [path, setPath] = useState<SetupPath>(null)
  const [menuText, setMenuText] = useState('')
  const [reviewItemId, setReviewItemId] = useState<string | null>(null)
  const menu = scenario.menuItems ?? []
  const reviewItem = menu.find((item) => item.id === reviewItemId) ?? null
  const staffCount = scenario.staff.reduce((sum, entry) => sum + entry.count, 0)
  const estimatedCount = menu.filter((item) => item.source !== 'user-provided').length

  const applyQuickEstimate = () => {
    onChange({
      name: scenario.name || 'Dinner peak',
      covers: scenario.covers || 45,
      durationMinutes: scenario.durationMinutes || 60,
      variability: scenario.variability ?? 'typical',
      serviceStyle: scenario.serviceStyle ?? 'À la carte',
      menuItems: structuredClone(DEFAULT_GENERATED_MENU),
    })
    setPath('quick')
  }

  const importMenu = () => {
    const parsed = parseMenuText(menuText)
    if (parsed.length) onChange({ menuItems: parsed })
    setPath('menu')
  }

  const changeMenuItem = (updated: SimulationMenuItem) => onChange({
    menuItems: menu.map((item) => item.id === updated.id ? updated : item),
  })

  const addMenuItem = () => {
    const id = `menu-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
    const item: SimulationMenuItem = {
      id,
      name: 'New menu item',
      sharePct: 0,
      source: 'user-provided',
      steps: [{ label: 'Prepare', capability: 'food-prep', activeSeconds: 60 }],
    }
    onChange({ menuItems: [...menu, item] })
    setReviewItemId(id)
  }

  const summary = useMemo(() => (
    <p>
      {menu.length} representative menu items · {staffCount} staff · {scenario.covers} covers in {scenario.durationMinutes} minutes.
      {estimatedCount} values estimated by CalmKitchen Designer.
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
            <button type="button" onClick={() => setReviewItemId(menu[0]?.id ?? null)}>Review assumptions</button>
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
      {path === 'detailed' && <><p>Use the scenario fields below to refine demand, staffing, timings and capacity.</p><button type="button" onClick={addMenuItem}>Add menu item</button></>}
      {menu.length ? <MenuTable menu={menu} onSelect={(item) => setReviewItemId(item.id)} onChange={changeMenuItem} /> : <p>No modeled menu items yet. Add or import a menu to replace the compatibility demand model.</p>}
      {reviewItem && <MenuItemDetail item={reviewItem} onChange={changeMenuItem} onClose={() => setReviewItemId(null)} />}
      <button type="button" className="link-button" onClick={() => setPath(null)}>Change setup method</button>
    </section>
  )
}

function MenuTable({ menu, onSelect, onChange }: { menu: SimulationMenuItem[]; onSelect(item: SimulationMenuItem): void; onChange(item: SimulationMenuItem): void }) {
  return (
    <table className="menu-table" aria-label={`Menu · ${menu.length} items`}>
      <thead><tr><th>Item</th><th>Share</th><th>Route</th><th>Time</th><th>Source</th></tr></thead>
      <tbody>
        {menu.map((item) => (
          <tr key={item.id}>
            <td><button type="button" className="link-button" onClick={() => onSelect(item)}>{item.name}</button></td>
            <td><input aria-label={`${item.name} share percent`} type="number" min="0" max="100" value={item.sharePct} onChange={(event) => onChange({ ...item, sharePct: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></td>
            <td>{item.steps.map((step) => step.capability.replaceAll('-', ' ')).join(' → ')}</td>
            <td>{menuItemTimeRange(item)}</td>
            <td>{item.source === 'template-estimate' ? 'Estimated' : item.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function menuItemTimeRange(item: SimulationMenuItem) {
  const active = item.steps.reduce((total, step) => total + step.activeSeconds, 0)
  const minimum = active + item.steps.reduce((total, step) => total + (step.passiveSeconds?.minSeconds ?? 0), 0)
  const maximum = active + item.steps.reduce((total, step) => total + (step.passiveSeconds?.maxSeconds ?? 0), 0)
  return `${Math.max(1, Math.round(minimum / 60))}–${Math.max(1, Math.round(maximum / 60))}m`
}

function MenuItemDetail({ item, onChange, onClose }: { item: SimulationMenuItem; onChange(item: SimulationMenuItem): void; onClose(): void }) {
  const updateStep = (index: number, patch: Partial<SimulationMenuItem['steps'][number]>) => onChange({
    ...item,
    steps: item.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step),
  })
  return (
    <article className="menu-item-detail" aria-label={item.name}>
      <header><h3>{item.name}</h3><button type="button" aria-label="Close menu item" onClick={onClose}>×</button></header>
      <ol>
        {item.steps.map((step, index) => (
          <li key={`${index}-${step.label}`}>
            <strong>{step.label}</strong>
            <label>Station capability<select aria-label={`${item.name} ${step.label} capability`} value={step.capability} onChange={(event) => updateStep(index, { capability: event.target.value as StationCapability })}>{CAPABILITIES.map((capability) => <option key={capability} value={capability}>{capability.replaceAll('-', ' ')}</option>)}</select></label>
            <label>Active seconds<input aria-label={`${item.name} ${step.label} active seconds`} type="number" min="1" max="86400" value={step.activeSeconds} onChange={(event) => updateStep(index, { activeSeconds: Math.min(86_400, Math.max(1, Number(event.target.value) || 1)) })} /></label>
            {step.passiveSeconds ? <>
              <label>Passive minimum<input aria-label={`${item.name} ${step.label} passive minimum seconds`} type="number" min="1" max="86400" value={step.passiveSeconds.minSeconds} onChange={(event) => { const minSeconds = Math.min(86_400, Math.max(1, Number(event.target.value) || 1)); updateStep(index, { passiveSeconds: { minSeconds, maxSeconds: Math.max(minSeconds, step.passiveSeconds!.maxSeconds) } }) }} /></label>
              <label>Passive maximum<input aria-label={`${item.name} ${step.label} passive maximum seconds`} type="number" min="1" max="86400" value={step.passiveSeconds.maxSeconds} onChange={(event) => { const maxSeconds = Math.min(86_400, Math.max(step.passiveSeconds!.minSeconds, Number(event.target.value) || 1)); updateStep(index, { passiveSeconds: { minSeconds: step.passiveSeconds!.minSeconds, maxSeconds } }) }} /></label>
              <button type="button" onClick={() => updateStep(index, { passiveSeconds: undefined })}>Remove passive time</button>
            </> : <button type="button" onClick={() => updateStep(index, { passiveSeconds: { minSeconds: 60, maxSeconds: 120 } })}>Add passive time</button>}
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
