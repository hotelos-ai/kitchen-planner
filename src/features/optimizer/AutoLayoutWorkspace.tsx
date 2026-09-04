import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import type { AutoLayoutPermissions, LayoutVariant, RectMm, SimulationScenario, StaffAssignment, StaffRole } from '../../domain/project'
import { canonicalLayoutHash } from '../../optimizer/canonical-layout'
import { layoutDiff } from '../../optimizer/feasibility'
import { quantifyLayoutImprovement, spatialFromDiff } from '../../optimizer/layout-improvement'
import type { AnytimeSearchResult, EvaluatedCandidate, OptimizerManifest } from '../../optimizer/types'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { LayoutInspectViewer } from './LayoutInspectViewer'

export type AutoLayoutProgress = {
  phase: 'feasibility' | 'pruning' | 'simulation' | 'confirmation' | 'complete'
  feasibleCandidates: number
  prunedCandidates: number
  simulatedCandidates: number
  candidateCount: number
  elapsedMs: number
  bestObserved?: string
}

export type AutoLayoutCandidate = EvaluatedCandidate & {
  serviceMetrics?: { completionPct: number; throughputPerHour: number }
}

export type AutoLayoutRunResult = Omit<AnytimeSearchResult, 'candidates' | 'finalists'> & {
  candidates: AutoLayoutCandidate[]
  finalists: AutoLayoutCandidate[]
}

export type AutoLayoutRunRequest = {
  baseline: LayoutVariant
  scenario: SimulationScenario
  manifest: OptimizerManifest
}

export type AutoLayoutRunner = {
  run(request: AutoLayoutRunRequest, onProgress: (progress: AutoLayoutProgress) => void): Promise<AutoLayoutRunResult>
  cancel?(): void
}

type Props = {
  store?: ProjectStore
  runner?: AutoLayoutRunner
  now?: () => string
  baselineVariantId?: string
  scenarioId?: string
  onCompareLayouts?(baselineVariantId: string, candidateVariantId: string): void
}

const roles: Array<{ role: StaffRole; label: string }> = [
  { role: 'head-chef', label: 'Head chef' },
  { role: 'sous-chef', label: 'Sous chef' },
  { role: 'cdp', label: 'Chef de partie' },
  { role: 'busser-washer', label: 'Busser / washer' },
]

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
const minutes = (seconds: number) => `${Number((seconds / 60).toFixed(1))} min`
const signed = (value: number, unit = '') => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${unit}`
const objectiveId = (name: string) => name.toLowerCase().replaceAll(' ', '-')

const bestBy = (candidates: readonly AutoLayoutCandidate[], score: (candidate: AutoLayoutCandidate) => number) =>
  [...candidates].sort((left, right) => score(left) - score(right) || left.id.localeCompare(right.id))[0]

function LayoutThumbnail({ variant, baseline, label }: { variant: LayoutVariant; baseline?: LayoutVariant; label: string }) {
  const diff = baseline ? layoutDiff(baseline, variant) : undefined
  const changedIds = new Set(diff ? [...diff.moved, ...diff.rotated, ...diff.resized, ...diff.substituted, ...diff.added] : [])
  return <svg
    role="img"
    aria-label={label}
    className="auto-layout-thumbnail"
    viewBox={`0 0 ${variant.architecture.widthMm} ${variant.architecture.depthMm}`}
    preserveAspectRatio="xMidYMid meet"
  >
    <polygon points={variant.architecture.roomPolygon.map((point) => `${point.x},${point.y}`).join(' ')} className="auto-layout-room" />
    {variant.equipment.map((item) => <rect
      key={item.id}
      x={item.xMm}
      y={item.yMm}
      width={item.widthMm}
      height={item.depthMm}
      className={changedIds.has(item.id) ? 'changed' : undefined}
      transform={`rotate(${item.rotationDeg} ${item.xMm + item.widthMm / 2} ${item.yMm + item.depthMm / 2})`}
    ><title>{item.label}</title></rect>)}
  </svg>
}

function FinalistCard({
  name,
  candidate,
  baseline,
  currentName,
  selected,
  manifest,
  onInspect,
  onCompare,
  onSave,
}: {
  name: string
  candidate: AutoLayoutCandidate
  baseline?: AutoLayoutCandidate
  currentName: string
  selected: boolean
  manifest: OptimizerManifest
  onInspect(): void
  onCompare(): void
  onSave(): void
}) {
  const baselineScore = baseline?.score
  const completion = candidate.serviceMetrics?.completionPct ?? candidate.score.completionPct
  const throughput = candidate.serviceMetrics?.throughputPerHour ?? candidate.score.throughputPerHour
  const delta = (key: 'unfinishedOrders' | 'p90WaitSeconds' | 'peakBacklog' | 'totalTravelMm' | 'congestionEvents' | 'changeCost') =>
    candidate.score[key] - (baselineScore?.[key] ?? candidate.score[key])
  const diff = candidate.diff
  const improvement = quantifyLayoutImprovement({
    currentName,
    currentScore: baselineScore,
    candidateScore: { ...candidate.score, ...(candidate.serviceMetrics ?? {}) },
    spatial: spatialFromDiff(diff, candidate.score.changeCost),
  })
  return (
    <article
      className={`auto-layout-finalist${selected ? ' selected' : ''}`}
      data-testid={`finalist-${objectiveId(name)}`}
      aria-pressed={selected}
      onClick={onInspect}
    >
      <header><h3>{name}</h3><strong>Hard feasible</strong></header>
      {improvement.hasBaselineScore && <p className={`auto-layout-gain${improvement.metrics.some((entry) => entry.improved) ? ' improved' : ''}`}>{improvement.headline}</p>}
      <dl>
        <dt>Completion / SLA</dt><dd>{completion === undefined ? `${candidate.score.unfinishedOrders} unfinished` : `${completion}%`} · {candidate.score.p90WaitSeconds <= (manifest.targetP90WaitSeconds ?? Infinity) ? 'met' : 'missed'}</dd>
        <dt>P90 wait</dt><dd>{minutes(candidate.score.p90WaitSeconds)} ({signed(delta('p90WaitSeconds'), ' s')})</dd>
        <dt>Peak backlog</dt><dd>{candidate.score.peakBacklog} ({signed(delta('peakBacklog'))})</dd>
        <dt>Throughput</dt><dd>{throughput === undefined ? 'Not reported' : `${throughput}/h`}</dd>
        <dt>Travel</dt><dd>{Math.round(candidate.score.totalTravelMm / 1000)} m ({signed(delta('totalTravelMm') / 1000, ' m')})</dd>
        <dt>Congestion</dt><dd>{candidate.score.congestionEvents} ({signed(delta('congestionEvents'))})</dd>
      </dl>
      <p>Seeds: {candidate.evaluatedSeeds.join(', ')} · confirmation {candidate.confirmationSeeds.join(', ')}</p>
      <p>Diff: {diff.moved.length} moved · {diff.rotated.length} rotated · {diff.resized.length} resized · {diff.added.length} added · {diff.removed.length} removed · change cost {candidate.score.changeCost}</p>
      <details onClick={(event) => event.stopPropagation()}><summary>Exact experiment manifest</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details>
      <div onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onInspect}>Inspect {name}</button>
        <button type="button" onClick={onCompare}>Compare {name}</button>
        <button type="button" onClick={onSave}>Save {name} as new layout</button>
      </div>
    </article>
  )
}

export function AutoLayoutWorkspace({ store = projectStore, runner, now = () => new Date().toISOString(), baselineVariantId, scenarioId, onCompareLayouts }: Props) {
  const state = useStore(store, (current) => current)
  const baseline = state.project.variants.find((variant) => variant.id === baselineVariantId) ?? getActiveVariant(state)
  const activeScenario = state.project.scenarios.find((scenario) => scenario.id === scenarioId)
    ?? state.project.scenarios.find((scenario) => scenario.id === state.project.activeScenarioId)
    ?? state.project.scenarios[0]
  const [covers, setCovers] = useState(activeScenario.covers)
  const [durationMinutes, setDurationMinutes] = useState(activeScenario.durationMinutes)
  const [arrivalPattern, setArrivalPattern] = useState(activeScenario.arrivalPattern)
  const [staff, setStaff] = useState<StaffAssignment[]>(() => structuredClone(activeScenario.staff))
  const [permissions, setPermissions] = useState<AutoLayoutPermissions>(() => structuredClone(baseline.layoutConstraints?.permissions ?? { placement: true, equipmentRedesign: false, architecture: false }))
  const [lockedComponentIds, setLockedComponentIds] = useState<string[]>(() => [...(baseline.layoutConstraints?.lockedComponentIds ?? [])])
  const [lockedArchitectureElementIds, setLockedArchitectureElementIds] = useState<string[]>(() => [...(baseline.layoutConstraints?.lockedArchitectureElementIds ?? [])])
  const [minimumAisleMm, setMinimumAisleMm] = useState(baseline.layoutConstraints?.minimumAisleMm ?? 0)
  const [noGoZones, setNoGoZones] = useState<RectMm[]>(() => structuredClone(baseline.layoutConstraints?.noGoZones ?? []))
  const [priority, setPriority] = useState<NonNullable<OptimizerManifest['priority']>>('balanced')
  const [alternativeCount, setAlternativeCount] = useState<1 | 3>(3)
  const [keepWalls, setKeepWalls] = useState(true)
  const [targetP90Minutes, setTargetP90Minutes] = useState(15)
  const [maxEvaluations, setMaxEvaluations] = useState(60)
  const [timeBudgetSeconds, setTimeBudgetSeconds] = useState(30)
  const [progress, setProgress] = useState<AutoLayoutProgress | null>(null)
  const [result, setResult] = useState<AutoLayoutRunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [inspected, setInspected] = useState<{ name: string; candidate: AutoLayoutCandidate } | null>(null)
  const [compared, setCompared] = useState<AutoLayoutCandidate | null>(null)
  const [savedVariantIds, setSavedVariantIds] = useState<Record<string, string>>({})

  const architectureElements = useMemo(() => [
    ...baseline.architecture.openings.map((opening) => ({ id: opening.id, label: opening.label })),
    ...baseline.architecture.pillars.map((pillar) => ({ id: pillar.id, label: `Pillar ${pillar.id}` })),
    ...baseline.architecture.storageZones.map((zone) => ({ id: zone.id, label: zone.label })),
  ], [baseline])

  const setStaffCount = (role: StaffRole, count: number) => setStaff((current) => roles.map(({ role: candidate }) => ({
    role: candidate,
    count: candidate === role ? count : current.find((assignment) => assignment.role === candidate)?.count ?? 0,
  })))
  const toggle = (values: string[], setValues: (values: string[]) => void, id: string, checked: boolean) =>
    setValues(checked ? [...new Set([...values, id])] : values.filter((value) => value !== id))

  const buildManifest = (): OptimizerManifest => ({
    id: makeId('experiment'),
    documentId: state.documentId,
    revision: state.revision,
    baselineVariantId: baseline.id,
    scenarioIds: [activeScenario.id],
    seeds: [3, 5],
    confirmationSeeds: [101],
    permissions,
    lockedComponentIds,
    lockedArchitectureElementIds,
    hardRules: { minimumAisleMm, noGoZones },
    budget: { maxEvaluations, maxDurationMs: timeBudgetSeconds * 1000 },
    priority,
    targetP90WaitSeconds: targetP90Minutes * 60,
  })

  const run = async () => {
    if (!runner) { setMessage('Auto-layout Worker runner is not configured.'); return }
    setRunning(true)
    setResult(null)
    setMessage('')
    setInspected(null)
    setCompared(null)
    const scenario: SimulationScenario = { ...structuredClone(activeScenario), covers, durationMinutes, arrivalPattern, staff }
    try {
      const next = await runner.run({ baseline: structuredClone(baseline), scenario, manifest: buildManifest() }, setProgress)
      setResult(next)
      const first = next.finalists.length
        ? bestBy(next.finalists, (value) => value.score.p90WaitSeconds)
        : undefined
      setInspected(first ? { name: 'Fastest service', candidate: first } : null)
      setProgress((current) => {
        const stats = next.searchStats
        return {
          phase: 'complete',
          feasibleCandidates: stats ? stats.uniqueCandidates - stats.infeasibleCandidates : current?.feasibleCandidates ?? next.finalists.length,
          prunedCandidates: stats?.prunedCandidates ?? current?.prunedCandidates ?? 0,
          simulatedCandidates: stats?.evaluatedCandidates ?? current?.simulatedCandidates ?? next.candidates.length,
          candidateCount: stats?.uniqueCandidates ?? current?.candidateCount ?? next.candidates.length,
          elapsedMs: current?.elapsedMs ?? 0,
          bestObserved: current?.bestObserved ?? next.finalists[0]?.id,
        }
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Auto-layout failed.')
    } finally {
      setRunning(false)
    }
  }

  const namedFinalists = useMemo(() => {
    const candidates = result?.finalists ?? []
    if (!candidates.length) return []
    return [
      { name: 'Fastest service', candidate: bestBy(candidates, (value) => value.score.p90WaitSeconds)! },
      { name: 'Least travel', candidate: bestBy(candidates, (value) => value.score.totalTravelMm)! },
      { name: 'Minimal change', candidate: bestBy(candidates, (value) => value.score.changeCost)! },
    ]
  }, [result])
  const baselineResult = result?.candidates.find((candidate) => candidate.hash === canonicalLayoutHash(baseline))
  const inspectedImprovement = inspected ? quantifyLayoutImprovement({
    currentName: baseline.name,
    currentScore: baselineResult?.score,
    candidateScore: { ...inspected.candidate.score, ...(inspected.candidate.serviceMetrics ?? {}) },
    spatial: spatialFromDiff(inspected.candidate.diff, inspected.candidate.score.changeCost),
  }) : null

  const adopt = (name: string, candidate: AutoLayoutCandidate): string | null => {
    const existingId = savedVariantIds[candidate.id]
    if (existingId) return existingId
    if (!result) return null
    const manifest = result.manifest
    const adopted: LayoutVariant = {
      ...structuredClone(candidate.variant),
      adoptedExperimentManifest: {
        id: manifest.id,
        documentId: manifest.documentId,
        revision: manifest.revision,
        baselineVariantId: manifest.baselineVariantId,
        finalistId: candidate.id,
        createdAt: now(),
        scenarioIds: [...manifest.scenarioIds],
        seeds: [...candidate.evaluatedSeeds],
        confirmationSeeds: [...candidate.confirmationSeeds],
        permissions: structuredClone(manifest.permissions),
        lockedComponentIds: [...manifest.lockedComponentIds],
        lockedArchitectureElementIds: [...manifest.lockedArchitectureElementIds],
        hardRules: structuredClone(manifest.hardRules),
        budget: { maxDurationMs: manifest.budget.maxDurationMs, maxEvaluations: manifest.budget.maxEvaluations },
        ...(manifest.priority ? { priority: manifest.priority } : {}),
        ...(manifest.targetP90WaitSeconds ? { targetP90WaitSeconds: manifest.targetP90WaitSeconds } : {}),
        objective: objectiveId(name),
        resultHash: candidate.hash,
        resultMetrics: { ...candidate.score, ...(candidate.serviceMetrics ?? {}) },
      },
    }
    const newVariantId = makeId('layout')
    const applied = store.getState().adoptAutoLayoutCandidate({
      expectedDocumentId: manifest.documentId,
      expectedRevision: manifest.revision,
      runId: manifest.id,
      resultId: candidate.id,
      baselineVariantId: manifest.baselineVariantId,
      newVariantId,
      name,
      candidate: adopted,
    })
    setMessage(applied.ok ? `${name} saved as a new layout.` : applied.message)
    if (!applied.ok) return null
    setSavedVariantIds((current) => ({ ...current, [candidate.id]: newVariantId }))
    return newVariantId
  }

  const saveAndCompare = (name: string, candidate: AutoLayoutCandidate) => {
    const candidateVariantId = adopt(name, candidate)
    if (candidateVariantId) onCompareLayouts?.(baseline.id, candidateVariantId)
  }

  return (
    <section className="auto-layout-workspace auto-layout-sheet" aria-label="Auto-layout experiment">
      <header><span className="eyebrow">Generate layout alternatives</span><h2>Auto-layout</h2><p>Creates new layout tabs. Nothing overwrites the current arrangement. Searches for the best observed feasible layouts under the frozen inputs, rules, scenarios, seeds, and budget.</p></header>
      <div className="auto-layout-body">
        <form className="auto-layout-controls" onSubmit={(event) => { event.preventDefault(); void run() }}>
          <fieldset><legend>What should be prioritized?</legend>
            <label><input type="radio" name="auto-layout-priority" checked={priority === 'travel'} onChange={() => setPriority('travel')} />Shorter staff walking</label>
            <label><input type="radio" name="auto-layout-priority" checked={priority === 'service'} onChange={() => setPriority('service')} />Higher throughput</label>
            <label><input type="radio" name="auto-layout-priority" checked={priority === 'balanced'} onChange={() => setPriority('balanced')} />Better clean/dirty separation</label>
            <label><input type="radio" name="auto-layout-priority" checked={priority === 'minimal-change'} onChange={() => setPriority('minimal-change')} />More open working space</label>
          </fieldset>
          <fieldset><legend>Keep fixed</legend>
            <label><input type="checkbox" checked={keepWalls} onChange={(event) => { setKeepWalls(event.target.checked); setPermissions((value) => ({ ...value, architecture: !event.target.checked })) }} />Walls and openings</label>
            {baseline.architecture.pillars.map((pillar) => <label key={pillar.id}><input type="checkbox" checked={lockedArchitectureElementIds.includes(pillar.id)} onChange={(event) => toggle(lockedArchitectureElementIds, setLockedArchitectureElementIds, pillar.id, event.target.checked)} />Pillar {pillar.id}</label>)}
            {baseline.architecture.openings.filter((opening) => opening.kind === 'service-window').map((opening) => <label key={opening.id}><input type="checkbox" checked={lockedArchitectureElementIds.includes(opening.id)} onChange={(event) => toggle(lockedArchitectureElementIds, setLockedArchitectureElementIds, opening.id, event.target.checked)} />{opening.label}</label>)}
            <label><input type="checkbox" checked={!permissions.placement} onChange={(event) => setPermissions((value) => ({ ...value, placement: !event.target.checked }))} />Current equipment positions</label>
          </fieldset>
          <fieldset><legend>Generate</legend>
            <label><input type="radio" name="alternative-count" checked={alternativeCount === 1} onChange={() => setAlternativeCount(1)} />1 alternative</label>
            <label><input type="radio" name="alternative-count" checked={alternativeCount === 3} onChange={() => setAlternativeCount(3)} />3 alternatives</label>
          </fieldset>
          <fieldset><legend>Demand and staffing</legend>
            <label>Covers<input type="number" min="1" value={covers} onChange={(event) => setCovers(Number(event.target.value))} /></label>
            <label>Peak duration (minutes)<input type="number" min="1" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /></label>
            <label>Arrival pattern<select value={arrivalPattern} onChange={(event) => setArrivalPattern(event.target.value as SimulationScenario['arrivalPattern'])}><option value="steady">Steady</option><option value="seating-wave">Seating wave</option><option value="two-waves">Two waves</option></select></label>
            {roles.map(({ role, label }) => <label key={role}>{label} count<input type="number" min="0" value={staff.find((assignment) => assignment.role === role)?.count ?? 0} onChange={(event) => setStaffCount(role, Number(event.target.value))} /></label>)}
          </fieldset>
          <fieldset><legend>Permissions</legend>
            <label><input type="checkbox" checked={permissions.placement} onChange={(event) => setPermissions((value) => ({ ...value, placement: event.target.checked }))} />A — Move and rotate existing equipment</label>
            <label><input type="checkbox" checked={permissions.equipmentRedesign} onChange={(event) => setPermissions((value) => ({ ...value, equipmentRedesign: event.target.checked }))} />B — Resize, substitute, add, or remove equipment</label>
            <label><input type="checkbox" checked={permissions.architecture} onChange={(event) => setPermissions((value) => ({ ...value, architecture: event.target.checked }))} />C — Authorized architecture changes</label>
          </fieldset>
          <fieldset><legend>Locks and critical inventory</legend>
            {baseline.equipment.map((item) => <label key={item.id}><input type="checkbox" checked={lockedComponentIds.includes(item.id)} onChange={(event) => toggle(lockedComponentIds, setLockedComponentIds, item.id, event.target.checked)} />Lock {item.label}</label>)}
            {architectureElements.map((item) => <label key={item.id}><input type="checkbox" checked={lockedArchitectureElementIds.includes(item.id)} onChange={(event) => toggle(lockedArchitectureElementIds, setLockedArchitectureElementIds, item.id, event.target.checked)} />Lock {item.label}</label>)}
          </fieldset>
          <fieldset><legend>Rules, SLA, and budget</legend>
            <label>Minimum aisle (mm)<input type="number" min="0" step="100" value={minimumAisleMm} onChange={(event) => setMinimumAisleMm(Number(event.target.value))} /></label>
            <button type="button" onClick={() => setNoGoZones((zones) => [...zones, { id: makeId('no-go'), xMm: 0, yMm: 0, widthMm: 1000, depthMm: 1000 }])}>Add no-go zone</button>
            {noGoZones.map((zone, index) => <p key={zone.id}>No-go {index + 1}: {zone.widthMm} × {zone.depthMm} mm</p>)}
            <label>Target P90 wait (minutes)<input type="number" min="1" value={targetP90Minutes} onChange={(event) => setTargetP90Minutes(Number(event.target.value))} /></label>
            <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="balanced">Balanced</option><option value="service">Service</option><option value="travel">Travel</option><option value="minimal-change">Minimal change</option></select></label>
            <label>Maximum evaluations<input type="number" min="1" value={maxEvaluations} onChange={(event) => setMaxEvaluations(Number(event.target.value))} /></label>
            <label>Time budget (seconds)<input type="number" min="1" value={timeBudgetSeconds} onChange={(event) => setTimeBudgetSeconds(Number(event.target.value))} /></label>
          </fieldset>
          <button type="submit" disabled={running}>{running ? 'Running…' : 'Run auto-layout'}</button>
          {running && <button type="button" onClick={() => runner?.cancel?.()}>Cancel auto-layout</button>}
        </form>

        <div className="auto-layout-results">
          {progress && <section className="optimizer-progress" aria-label="Auto-layout progress">
            <strong>{progress.phase}</strong><span>{progress.feasibleCandidates} feasible</span><span>{progress.prunedCandidates} pruned</span><span>{progress.simulatedCandidates} simulated</span><span>{progress.candidateCount} candidates</span><span>{Number((progress.elapsedMs / 1000).toFixed(2))} s elapsed</span><span>Current best observed: {progress.bestObserved ?? 'pending'}</span>
          </section>}
          {message && <p role="status">{message}</p>}
          {result && <>
            <p>{result.bestObservedDisclaimer}</p>
            <article className="auto-layout-baseline"><h3>Baseline</h3><p>{baseline.name} · {baseline.equipment.length} components · no project mutation during search</p></article>
            {!namedFinalists.length && <section role="alert" aria-label="No feasible auto-layout finalists" className="auto-layout-diagnosis">
              <h3>No confirmed feasible finalist</h3>
              <p>The search ended with {result.termination.replaceAll('-', ' ')} before it could confirm a layout. Review the modeled constraints below, then adjust the rules, permissions, or budget and run again.</p>
              {Object.keys(result.diagnostics?.feasibilityReasonCounts ?? {}).length > 0 && <ul>
                {Object.entries(result.diagnostics!.feasibilityReasonCounts).sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => <li key={code}>{code}: {count}</li>)}
              </ul>}
              {(result.diagnostics?.simulationRejectionCount ?? 0) > 0 && <>
                <p>{result.diagnostics!.simulationRejectionCount} candidates were rejected by simulation validation.</p>
                {result.diagnostics!.simulationRejectionMessages.length > 0 && <ul>{result.diagnostics!.simulationRejectionMessages.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
              </>}
            </section>}
            <div className="auto-layout-finalists">
              {namedFinalists.slice(0, alternativeCount === 1 ? 1 : namedFinalists.length).map(({ name, candidate }) => (
                <FinalistCard
                  key={name}
                  name={name}
                  candidate={candidate}
                  baseline={baselineResult}
                  currentName={baseline.name}
                  selected={inspected?.candidate.id === candidate.id}
                  manifest={result.manifest}
                  onInspect={() => setInspected({ name, candidate })}
                  onCompare={() => { setInspected({ name, candidate }); setCompared(candidate) }}
                  onSave={() => adopt(name, candidate)}
                />
              ))}
            </div>
            {onCompareLayouts && namedFinalists[0] && <button type="button" className="auto-layout-compare-best" onClick={() => saveAndCompare(namedFinalists[0].name, namedFinalists[0].candidate)}>Save best observed and compare side by side</button>}
            {namedFinalists.length > 0 && <button type="button" onClick={() => namedFinalists.slice(0, alternativeCount).forEach(({ name, candidate }) => adopt(name, candidate))}>Save alternatives as new layouts</button>}
          </>}
          {inspected && (
            <section className="auto-layout-inspect" role="region" aria-label="Inspected finalist">
              <header>
                <span className="eyebrow">Inspect before choosing</span>
                <h3>{inspected.name}</h3>
                <p>{inspected.candidate.id} · {inspected.candidate.variant.equipment.length} components · read-only spatial preview vs {baseline.name}</p>
              </header>
              {inspectedImprovement && (
                <div className={`auto-layout-improvement${inspectedImprovement.hasBaselineScore ? ' scored' : ''}`} aria-label="Improvement versus current layout">
                  <strong>{inspectedImprovement.headline}</strong>
                  {inspectedImprovement.hasBaselineScore && (
                    <dl>
                      {inspectedImprovement.metrics.map((entry) => (
                        <div key={entry.key} className={entry.improved ? 'improved' : entry.unchanged ? 'unchanged' : 'worse'}>
                          <dt>{entry.label}</dt>
                          <dd>{entry.candidate} <span>({entry.deltaLabel} from {entry.baseline})</span></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p>{inspectedImprovement.spatial.moved} moved · {inspectedImprovement.spatial.rotated} rotated · {inspectedImprovement.spatial.resized} resized · {inspectedImprovement.spatial.added} added · {inspectedImprovement.spatial.removed} removed · change cost {inspectedImprovement.spatial.changeCost}</p>
                </div>
              )}
              <LayoutInspectViewer store={store} variant={inspected.candidate.variant} />
            </section>
          )}
          {compared && <section role="region" aria-label="Finalist comparison"><h3>Finalist comparison</h3><p>{compared.id} against {baseline.id} · read-only spatial comparison</p><div className="auto-layout-comparison"><div><strong>Baseline</strong><LayoutThumbnail variant={baseline} label="Baseline comparison plan" /></div><div><strong>Finalist</strong><LayoutThumbnail variant={compared.variant} baseline={baseline} label="Finalist comparison plan" /></div></div></section>}
        </div>
      </div>
    </section>
  )
}
