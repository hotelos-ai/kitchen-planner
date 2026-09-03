import { useMemo, useRef } from 'react'
import type { KitchenProject, LayoutVariant, SimulationScenario } from '../../domain/project'
import type { LayoutFinding, MetricDelta } from '../../simulation/recommendations'
import type { SimulationResult } from '../../simulation/types'
import { buildReportHtml, downloadArtifact, projectSlug } from '../../webmcp/project-artifacts'

export function ReportView({ project, baseline, candidate, baselineLabel = baseline.name, candidateLabel = candidate.name, scenario, candidateResult, deltas, findings, onClose }: { project: KitchenProject; baseline: LayoutVariant; candidate: LayoutVariant; baselineLabel?: string; candidateLabel?: string; scenario: SimulationScenario; candidateResult: SimulationResult; deltas: MetricDelta[]; findings: LayoutFinding[]; onClose(): void }) {
  const printFrame = useRef<HTMLIFrameElement>(null)
  const reportHtml = useMemo(() => buildReportHtml({
    project,
    variant: candidate,
    scenario,
    simulation: candidateResult,
    findings,
    comparison: { baselineLabel, candidateLabel, deltas },
  }), [baselineLabel, candidate, candidateLabel, candidateResult, deltas, findings, project, scenario])
  const exportHtml = () => downloadArtifact({
    filename: `${projectSlug(project)}-report.html`,
    mimeType: 'text/html;charset=utf-8',
    contents: reportHtml,
  })
  return (
    <section className="report-view">
      <iframe ref={printFrame} title="Generated planning report for print" aria-hidden="true" tabIndex={-1} srcDoc={reportHtml} style={{ position: 'fixed', width: 0, height: 0, border: 0, opacity: 0 }} />
      <div className="report-actions"><button type="button" onClick={onClose}>Back to comparison</button><button type="button" onClick={() => printFrame.current?.contentWindow?.print()}>Print / save PDF</button><button type="button" onClick={exportHtml}>Export HTML</button></div>
      <header><span className="eyebrow">Kitchen planning report</span><h1>{project.name}</h1><p>{baselineLabel} compared with {candidateLabel} · {new Date().toLocaleDateString()}</p></header>
      <section><h2>Scenario assumptions</h2><p>{scenario.covers} covers over {scenario.durationMinutes} minutes · {scenario.staff.reduce((sum, entry) => sum + entry.count, 0)} staff · {Math.round(scenario.cookToOrderRatio * 100)}% cooked to order · deterministic seed {scenario.seed}</p></section>
      <section><h2>Metric comparison</h2><table><thead><tr><th>Measure</th><th>{baselineLabel}</th><th>{candidateLabel}</th><th>Delta</th></tr></thead><tbody>{deltas.map((delta) => <tr key={delta.key}><th>{delta.label}</th><td>{Math.round(delta.baseline)}</td><td>{Math.round(delta.candidate)}</td><td>{delta.delta > 0 ? '+' : ''}{Math.round(delta.delta)}</td></tr>)}</tbody></table></section>
      <section><h2>Priority findings</h2>{findings.map((finding) => <article key={finding.ruleId}><h3>{finding.title}</h3><p>{finding.explanation}</p><ul>{finding.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></article>)}</section>
      <p className="disclaimer">Comparative planning aid only — verify fire, ventilation, hygiene, accessibility, structural constraints, and worker safety with qualified local professionals before procurement or construction.</p>
    </section>
  )
}
