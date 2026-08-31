import type { ArrivalPattern, SimulationScenario, StaffRole } from '../../domain/project'

const ROLE_LABELS: Record<StaffRole, string> = {
  'head-chef': 'Head chef', 'sous-chef': 'Sous chef', cdp: 'CDP', 'busser-washer': 'Busser / washer',
}

export function ScenarioEditor({ scenario, onChange }: { scenario: SimulationScenario; onChange(patch: Partial<SimulationScenario>): void }) {
  const updateStaff = (role: StaffRole, count: number) => onChange({ staff: scenario.staff.map((entry) => entry.role === role ? { ...entry, count: Math.max(0, count) } : entry) })
  return (
    <aside className="scenario-editor" aria-label="Service scenario settings">
      <div className="panel-heading"><span className="eyebrow">Dinner pressure test</span><h2>Service setup</h2></div>
      <div className="scenario-fields">
        <label>Covers<input type="number" min="1" max="500" value={scenario.covers} onChange={(event) => onChange({ covers: Math.max(1, Number(event.target.value)) })} /></label>
        <label>Duration (minutes)<input type="number" min="10" max="360" value={scenario.durationMinutes} onChange={(event) => onChange({ durationMinutes: Math.max(10, Number(event.target.value)) })} /></label>
        <label>Arrival pattern<select value={scenario.arrivalPattern} onChange={(event) => onChange({ arrivalPattern: event.target.value as ArrivalPattern })}><option value="seating-wave">Seating wave</option><option value="steady">Steady</option><option value="two-waves">Two waves</option></select></label>
        <label>Cooked to order <span>{Math.round(scenario.cookToOrderRatio * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={scenario.cookToOrderRatio} onChange={(event) => onChange({ cookToOrderRatio: Number(event.target.value) })} /></label>
        <label>Deterministic seed<input type="number" value={scenario.seed} onChange={(event) => onChange({ seed: Number(event.target.value) || 1 })} /></label>
      </div>
      <div className="staff-settings"><span className="eyebrow">Staff on shift</span>{scenario.staff.map((entry) => <label key={entry.role}><span>{ROLE_LABELS[entry.role]}</span><input aria-label={`${ROLE_LABELS[entry.role]} count`} type="number" min="0" max="20" value={entry.count} onChange={(event) => updateStaff(entry.role, Number(event.target.value))} /></label>)}</div>
      <fieldset className="scenario-checks"><legend>Pressure checks</legend>{([
        ['collisions', 'Staff congestion'], ['doorSwings', 'Door conflicts'], ['dirtyCleanCrossings', 'Dirty / clean crossings'],
      ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={scenario.checks[key]} onChange={(event) => onChange({ checks: { ...scenario.checks, [key]: event.target.checked } })} />{label}</label>)}</fieldset>
    </aside>
  )
}
