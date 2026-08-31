import type { KitchenProject, LayoutVariant, SimulationScenario } from '../../domain/project'
import type { LayoutFinding, MetricDelta } from '../../simulation/recommendations'

export function ReportView({ project, baseline, candidate, scenario, deltas, findings, onClose }: { project: KitchenProject; baseline: LayoutVariant; candidate: LayoutVariant; scenario: SimulationScenario; deltas: MetricDelta[]; findings: LayoutFinding[]; onClose(): void }) {
  return (
    <section className="report-view">
      <div className="report-actions"><button type="button" onClick={onClose}>Back to comparison</button><button type="button" onClick={() => window.print()}>Print / save PDF</button></div>
      <header><span className="eyebrow">Kitchen planning report</span><h1>{project.name}</h1><p>{baseline.name} compared with {candidate.name} · {new Date().toLocaleDateString()}</p></header>
      <section><h2>Scenario assumptions</h2><p>{scenario.covers} covers over {scenario.durationMinutes} minutes · {scenario.staff.reduce((sum, entry) => sum + entry.count, 0)} staff · {Math.round(scenario.cookToOrderRatio * 100)}% cooked to order · deterministic seed {scenario.seed}</p></section>
      <section><h2>Metric comparison</h2><table><thead><tr><th>Measure</th><th>{baseline.name}</th><th>{candidate.name}</th><th>Delta</th></tr></thead><tbody>{deltas.map((delta) => <tr key={delta.key}><th>{delta.label}</th><td>{Math.round(delta.baseline)}</td><td>{Math.round(delta.candidate)}</td><td>{delta.delta > 0 ? '+' : ''}{Math.round(delta.delta)}</td></tr>)}</tbody></table></section>
      <section><h2>Priority findings</h2>{findings.map((finding) => <article key={finding.ruleId}><h3>{finding.title}</h3><p>{finding.explanation}</p><ul>{finding.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></article>)}</section>
      <p className="disclaimer">Comparative planning aid only — verify fire, ventilation, hygiene, accessibility, structural constraints, and worker safety with qualified local professionals before procurement or construction.</p>
    </section>
  )
}
