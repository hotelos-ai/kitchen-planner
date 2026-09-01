export type SimulationView = 'operations-2d' | 'overview-3d' | 'walk'

const VIEWS: readonly { id: SimulationView; label: string }[] = [
  { id: 'operations-2d', label: '2D Operations' },
  { id: 'overview-3d', label: '3D Overview' },
  { id: 'walk', label: 'Walk Kitchen' },
]

export function SimulationViewSwitcher({ value, onChange }: { value: SimulationView; onChange(value: SimulationView): void }) {
  return <div className="simulation-view-switcher" role="group" aria-label="Simulation view">
    {VIEWS.map((view) => <button type="button" key={view.id} aria-pressed={value === view.id} onClick={() => onChange(view.id)}>{view.label}</button>)}
  </div>
}
