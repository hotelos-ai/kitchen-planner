import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import type { LayoutVariant, RectMm, SimulationScenario, StaffAssignment, StaffRole } from '../../domain/project'
import { canonicalLayoutHash } from '../../optimizer/canonical-layout'
import type { AnytimeSearchResult, AutoLayoutPermissionTier, EvaluatedCandidate, OptimizerManifest } from '../../optimizer/types'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'

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
const permissionFlags = (tier: AutoLayoutPermissionTier) => ({
  placement: true,
  equipmentRedesign: tier === 'B' || tier === 'C',
  architecture: tier === 'C',
})
const objectiveId = (name: string) => name.toLowerCase().replaceAll(' ', '-')

const bestBy = (candidates: readonly AutoLayoutCandidate[], score: (candidate: AutoLayoutCandidate) => number) =>
  [...candidates].sort((left, right) => score(left) - score(right) || left.id.localeCompare(right.id))[0]

function FinalistCard({
  name,
  candidate,
  baseline,
  manifest,
  onInspect,
  onCompare,
  onSave,
}: {
  name: string
  candidate: AutoLayoutCandidate
  baseline?: AutoLayoutCandidate
  manifest: OptimizerManifest
  onInspect(): void
  onCompare(): void
  onSave(): void
}) {
  const baselineScore = baseline?.score
  const completion = candidate.serviceMetrics?.completionPct
  const throughput = candidate.serviceMetrics?.throughputPerHour
  const delta = (key: keyof EvaluatedCandidate['score']) => candidate.score[key] - (baselineScore?.[key] ?? candidate.score[key])
  const diff = candidate.diff
  return (
    <article className="auto-layout-finalist" data-testid={`finalist-${objectiveId(name)}`}>
      <header><h3>{name}</h3><strong>Hard feasible</strong></header>
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
      <details><summary>Exact experiment manifest</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details>
      <div>
        <button type="button" onClick={onInspect}>Inspect {name}</button>
        <button type="button" onClick={onCompare}>Compare {name}</button>
        <button type="button" onClick={onSave}>Save {name} as new layout</button>
      </div>
    </article>
  )
}

export function AutoLayoutWorkspace({ store = projectStore, runner, now = () => new Date().toISOString() }: Props) {
  const state = useStore(store, (current) => current)
  const baseline = getActiveVariant(state)
  const activeScenario = state.project.scenarios.find((scenario) => scenario.id === state.project.activeScenarioId) ?? state.project.scenarios[0]
  const [covers, setCovers] = useState(activeScenario.covers)
  const [durationMinutes, setDurationMinutes] = useState(activeScenario.durationMinutes)
  const [arrivalPattern, setArrivalPattern] = useState(activeScenario.arrivalPattern)
  const [staff, setStaff] = useState<StaffAssignment[]>(() => structuredClone(activeScenario.staff))
  const [permissionTier, setPermissionTier] = useState<AutoLayoutPermissionTier>('A')
  const [lockedComponentIds, setLockedComponentIds] = useState<string[]>(() => [...(baseline.layoutConstraints?.lockedComponentIds ?? [])])
  const [lockedArchitectureElementIds, setLockedArchitectureElementIds] = useState<string[]>(() => [...(baseline.layoutConstraints?.lockedArchitectureElementIds ?? [])])
  const [minimumAisleMm, setMinimumAisleMm] = useState(baseline.layoutConstraints?.minimumAisleMm ?? 900)
  const [noGoZones, setNoGoZones] = useState<RectMm[]>(() => structuredClone(baseline.layoutConstraints?.noGoZones ?? []))
  const [priority, setPriority] = useState<NonNullable<OptimizerManifest['priority']>>('balanced')
  const [targetP90Minutes, setTargetP90Minutes] = useState(15)
  const [maxEvaluations, setMaxEvaluations] = useState(60)
  const [timeBudgetSeconds, setTimeBudgetSeconds] = useState(30)
  const [progress, setProgress] = useState<AutoLayoutProgress | null>(null)
  const [result, setResult] = useState<AutoLayoutRunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [inspected, setInspected] = useState<AutoLayoutCandidate | null>(null)
  const [compared, setCompared] = useState<AutoLayoutCandidate | null>(null)

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
    permissionTier,
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

  const adopt = (name: string, candidate: AutoLayoutCandidate) => {
    if (!result) return
    const manifest = result.manifest
    const adopted: LayoutVariant = {
      ...structuredClone(candidate.variant),
      adoptedExperimentManifest: {
        id: manifest.id,
        baselineVariantId: manifest.baselineVariantId,
        finalistId: candidate.id,
        createdAt: now(),
        scenarioIds: [...manifest.scenarioIds],
        seeds: [...candidate.evaluatedSeeds],
        confirmationSeeds: [...candidate.confirmationSeeds],
        permissions: permissionFlags(manifest.permissionTier),
        budget: { maxDurationMs: manifest.budget.maxDurationMs, maxEvaluations: manifest.budget.maxEvaluations },
        objective: objectiveId(name),
        resultHash: candidate.hash,
        resultMetrics: { ...candidate.score, ...(candidate.serviceMetrics ?? {}) },
      },
    }
    const applied = store.getState().adoptAutoLayoutCandidate({
      runId: manifest.id,
      resultId: candidate.id,
      baselineVariantId: manifest.baselineVariantId,
      newVariantId: makeId('layout'),
      name,
      candidate: adopted,
    })
    setMessage(applied.ok ? `${name} saved as a new layout.` : applied.message)
  }

  return (
    <section className="auto-layout-workspace" aria-label="Auto-layout experiment">
      <header><span className="eyebrow">Constraint-first experiment</span><h2>Auto-layout</h2><p>Searches for the best observed feasible layouts under the frozen inputs, rules, scenarios, seeds, and budget. It does not claim a universal optimum or regulatory approval.</p></header>
      <div className="auto-layout-body">
        <form className="auto-layout-controls" onSubmit={(event) => { event.preventDefault(); void run() }}>
          <fieldset><legend>Demand and staffing</legend>
            <label>Covers<input type="number" min="1" value={covers} onChange={(event) => setCovers(Number(event.target.value))} /></label>
            <label>Peak duration (minutes)<input type="number" min="1" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /></label>
            <label>Arrival pattern<select value={arrivalPattern} onChange={(event) => setArrivalPattern(event.target.value as SimulationScenario['arrivalPattern'])}><option value="steady">Steady</option><option value="seating-wave">Seating wave</option><option value="two-waves">Two waves</option></select></label>
            {roles.map(({ role, label }) => <label key={role}>{label} count<input type="number" min="0" value={staff.find((assignment) => assignment.role === role)?.count ?? 0} onChange={(event) => setStaffCount(role, Number(event.target.value))} /></label>)}
          </fieldset>
          <fieldset><legend>Permissions</legend>
            <label><input type="radio" name="permission" checked={permissionTier === 'A'} onChange={() => setPermissionTier('A')} />A — Move and rotate only</label>
            <label><input type="radio" name="permission" checked={permissionTier === 'B'} onChange={() => setPermissionTier('B')} />B — Equipment redesign and substitutions</label>
            <label><input type="radio" name="permission" checked={permissionTier === 'C'} onChange={() => setPermissionTier('C')} />C — Authorized architecture changes</label>
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
            <div className="auto-layout-finalists">
              {namedFinalists.map(({ name, candidate }) => <FinalistCard key={name} name={name} candidate={candidate} baseline={baselineResult} manifest={result.manifest} onInspect={() => setInspected(candidate)} onCompare={() => setCompared(candidate)} onSave={() => adopt(name, candidate)} />)}
            </div>
          </>}
          {inspected && <section role="region" aria-label="Inspected finalist"><h3>Inspected finalist</h3><p>{inspected.id} · {inspected.variant.equipment.length} components · read-only preview</p></section>}
          {compared && <section role="region" aria-label="Finalist comparison"><h3>Finalist comparison</h3><p>{compared.id} against {baseline.id} · read-only comparison</p></section>}
        </div>
      </div>
    </section>
  )
}
