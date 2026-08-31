import { useMemo, useState, type CSSProperties } from 'react'
import { useStore } from 'zustand'
import type { Architecture, LayoutVariant } from '../../domain/project'
import { runSimulation } from '../../simulation/engine'
import { buildFindings, compareResults, type LayoutFinding, type MetricDelta } from '../../simulation/recommendations'
import { projectStore, type ProjectStore } from '../../state/project-store'
import { ReportView } from './ReportView'

type PreviewMode = 'plan' | 'massing' | 'score'

const formatMetric = (delta: MetricDelta, value: number) => delta.key === 'totalTravelMm' ? `${(value / 1000).toFixed(1)} m` : delta.key === 'orderCompletionP90Seconds' ? `${(value / 60).toFixed(1)} min` : Math.round(value).toString()

function PlanPreview({ variant, architecture, affectedIds }: { variant: LayoutVariant; architecture: Architecture; affectedIds: string[] }) {
  return <svg className="compare-plan" viewBox={`-80 -80 ${architecture.widthMm + 160} ${architecture.depthMm + 160}`} role="img" aria-label={`${variant.name} plan preview`}><polygon points={architecture.roomPolygon.map((point) => `${point.x},${point.y}`).join(' ')} fill="#fbfaf6" stroke="#2d3834" strokeWidth="35" />{variant.equipment.filter((item) => item.category !== 'hood').map((item) => <g key={item.id} transform={`translate(${item.xMm} ${item.yMm}) rotate(${item.rotationDeg})`}><rect width={item.widthMm} height={item.depthMm} fill={item.category === 'cooking' ? '#ebbaab' : item.category === 'cold' ? '#c4dadd' : item.category === 'washing' || item.category === 'landing' ? '#e1d1a7' : '#d6decc'} stroke={affectedIds.includes(item.id) ? '#dd6545' : '#56635e'} strokeWidth={affectedIds.includes(item.id) ? 35 : 12} /><text x={item.widthMm / 2} y={item.depthMm / 2} textAnchor="middle" dominantBaseline="middle" fontSize="70" fontWeight="800">{item.label.slice(0, 14)}</text></g>)}{architecture.pillars.map((pillar) => <rect key={pillar.id} x={pillar.xMm} y={pillar.yMm} width={pillar.widthMm} height={pillar.depthMm} fill="#4c5551" />)}</svg>
}

function MassingPreview({ variant, architecture, affectedIds }: { variant: LayoutVariant; architecture: Architecture; affectedIds: string[] }) {
  return <div className="compare-massing" aria-label={`${variant.name} 3D massing preview`}><div className="massing-floor">{variant.equipment.filter((item) => item.category !== 'hood').map((item) => <span key={item.id} className={affectedIds.includes(item.id) ? 'affected' : ''} title={item.label} style={{ left: `${item.xMm / architecture.widthMm * 100}%`, top: `${item.yMm / architecture.depthMm * 100}%`, width: `${item.widthMm / architecture.widthMm * 100}%`, height: `${item.depthMm / architecture.depthMm * 100}%`, '--item-height': `${Math.max(5, item.heightMm / 40)}px` } as CSSProperties}>{item.label}</span>)}</div></div>
}

function ScorePreview({ deltas, side }: { deltas: MetricDelta[]; side: 'baseline' | 'candidate' }) {
  return <div className="compare-score">{deltas.map((delta) => { const value = side === 'baseline' ? delta.baseline : delta.candidate; const improved = side === 'candidate' && delta.delta !== 0 && (delta.lowerIsBetter ? delta.delta < 0 : delta.delta > 0); return <article className={improved ? 'improved' : ''} key={delta.key}><strong>{formatMetric(delta, value)}</strong><span>{delta.label}</span>{side === 'candidate' && delta.delta !== 0 && <small>{delta.delta > 0 ? '+' : ''}{Math.round(delta.delta)} vs baseline</small>}</article> })}</div>
}

function VariantPreview({ variant, architecture, mode, deltas, side, affectedIds }: { variant: LayoutVariant; architecture: Architecture; mode: PreviewMode; deltas: MetricDelta[]; side: 'baseline' | 'candidate'; affectedIds: string[] }) {
  return <article className="variant-preview"><header><span className="eyebrow">{side}</span><h2>{variant.name}</h2></header>{mode === 'plan' ? <PlanPreview variant={variant} architecture={architecture} affectedIds={affectedIds} /> : mode === 'massing' ? <MassingPreview variant={variant} architecture={architecture} affectedIds={affectedIds} /> : <ScorePreview deltas={deltas} side={side} />}</article>
}

export function CompareWorkspace({ store = projectStore }: { store?: ProjectStore }) {
  const project = useStore(store, (state) => state.project)
  const [baselineId, setBaselineId] = useState(project.variants[0].id)
  const [candidateId, setCandidateId] = useState(project.variants[1]?.id ?? project.variants[0].id)
  const [mode, setMode] = useState<PreviewMode>('plan')
  const [selectedFinding, setSelectedFinding] = useState<LayoutFinding | null>(null)
  const [showReport, setShowReport] = useState(false)
  const baseline = project.variants.find((variant) => variant.id === baselineId) ?? project.variants[0]
  const candidate = project.variants.find((variant) => variant.id === candidateId) ?? project.variants[0]
  const scenario = project.scenarios.find((value) => value.id === project.activeScenarioId) ?? project.scenarios[0]
  const baselineResult = useMemo(() => runSimulation({ architecture: project.architecture, equipment: baseline.equipment, scenario }), [baseline, project.architecture, scenario])
  const candidateResult = useMemo(() => runSimulation({ architecture: project.architecture, equipment: candidate.equipment, scenario }), [candidate, project.architecture, scenario])
  const deltas = useMemo(() => compareResults(baselineResult, candidateResult), [baselineResult, candidateResult])
  const findings = useMemo(() => buildFindings({ baseline: baselineResult, candidate: candidateResult, candidateEquipment: candidate.equipment }), [baselineResult, candidateResult, candidate.equipment])
  const affectedIds = selectedFinding?.affectedItemIds ?? []
  if (showReport) return <ReportView project={project} baseline={baseline} candidate={candidate} scenario={scenario} deltas={deltas} findings={findings} onClose={() => setShowReport(false)} />
  return (
    <section className="compare-workspace">
      <div className="compare-toolbar">
        <label>Baseline layout<select value={baseline.id} onChange={(event) => setBaselineId(event.target.value)}>{project.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>
        <span aria-hidden="true">versus</span>
        <label>Candidate layout<select value={candidate.id} onChange={(event) => setCandidateId(event.target.value)}>{project.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>
        {project.variants.length < 2 && <button type="button" onClick={() => { const id = store.getState().createVariant('Test candidate'); setCandidateId(id) }}>Create test candidate</button>}
        <div className="compare-tabs">{(['plan', 'massing', 'score'] as const).map((tab) => <button key={tab} type="button" aria-pressed={mode === tab} onClick={() => setMode(tab)}>{tab === 'massing' ? '3D' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
        <button type="button" onClick={() => setShowReport(true)}>Report</button>
      </div>
      <div className="compare-body">
        <div><p className="compare-assumptions">{scenario.covers} covers over {scenario.durationMinutes} minutes · same staff, timings, and seed for both layouts</p><section className="compare-grid"><VariantPreview variant={baseline} architecture={project.architecture} mode={mode} deltas={deltas} side="baseline" affectedIds={affectedIds} /><VariantPreview variant={candidate} architecture={project.architecture} mode={mode} deltas={deltas} side="candidate" affectedIds={affectedIds} /></section></div>
        <aside className="priority-findings"><span className="eyebrow">Evidence, not guesswork</span><h2>Priority findings</h2><p>Select a finding to highlight the affected equipment in both layouts.</p>{findings.map((finding) => <button type="button" key={finding.ruleId} className={`${finding.severity}${selectedFinding?.ruleId === finding.ruleId ? ' selected' : ''}`} onClick={() => setSelectedFinding(finding)}><span>{finding.severity === 'positive' ? 'Preserve' : finding.severity}</span><strong>{finding.title}</strong><small>{finding.explanation}</small>{finding.evidence.map((evidence) => <em key={evidence}>{evidence}</em>)}</button>)}</aside>
      </div>
      <p className="compare-disclaimer">Comparative planning aid — “better” means better under this exact scenario, not universal approval. Verify the final design with qualified local professionals.</p>
    </section>
  )
}
