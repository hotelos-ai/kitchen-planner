import type { LayoutVariant } from '../domain/project'
import { canonicalLayoutHash } from './canonical-layout'
import { optimizerManifestSchema } from './experiment-schema'
import { checkCandidateFeasibility, layoutChangeCost, layoutDiff } from './feasibility'
import { lexicographicCompare, paretoFinalists } from './ranking'
import type {
  AnytimeSearchResult,
  EvaluatedCandidate,
  OptimizerManifest,
  OptimizerMetrics,
  SearchEvaluationInput,
} from './types'

type SearchOptions = {
  baseline: LayoutVariant
  manifest: OptimizerManifest
  evaluate(input: SearchEvaluationInput): OptimizerMetrics
  isCancelled?(): boolean
  now?(): number
  onProgress?(progress: { phase: 'feasibility' | 'simulation' | 'confirmation'; candidates: number; evaluations: number; bestHash?: string }): void
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360

export function generateCandidates(baseline: LayoutVariant, manifest: OptimizerManifest): LayoutVariant[] {
  const candidates = [structuredClone(baseline)]
  const locked = new Set(manifest.lockedComponentIds)
  const deltas = [{ x: 200, y: 0 }, { x: -200, y: 0 }, { x: 0, y: 200 }, { x: 0, y: -200 }]
  baseline.equipment
    .filter((item) => item.movable && !locked.has(item.id))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .forEach((item) => {
      deltas.forEach((delta) => {
        const candidate = structuredClone(baseline)
        const changed = candidate.equipment.find((value) => value.id === item.id)!
        changed.xMm += delta.x
        changed.yMm += delta.y
        candidates.push(candidate)
      })
      for (const deltaDeg of [-90, 90]) {
        const candidate = structuredClone(baseline)
        const changed = candidate.equipment.find((value) => value.id === item.id)!
        changed.rotationDeg = normalizeRotation(changed.rotationDeg + deltaDeg)
        candidates.push(candidate)
      }
    })
  if (manifest.permissionTier !== 'A') {
    baseline.equipment
      .filter((item) => !locked.has(item.id))
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      .forEach((item) => {
        if (!item.dimensionsLocked) {
          for (const scale of [.9, 1.1]) {
            const candidate = structuredClone(baseline)
            const changed = candidate.equipment.find((value) => value.id === item.id)!
            changed.widthMm = Math.max(100, Math.round(changed.widthMm * scale))
            changed.depthMm = Math.max(100, Math.round(changed.depthMm * scale))
            candidates.push(candidate)
          }
        }
        if (item.removable) {
          const candidate = structuredClone(baseline)
          candidate.equipment = candidate.equipment.filter((value) => value.id !== item.id)
          candidates.push(candidate)
        }
      })
  }
  if (manifest.permissionTier === 'C' && !baseline.architecture.locked) {
    const architectureLocks = new Set(manifest.lockedArchitectureElementIds)
    if (!architectureLocks.has('room')) {
      const candidate = structuredClone(baseline)
      const previousWidth = candidate.architecture.widthMm
      candidate.architecture.widthMm += 200
      candidate.architecture.roomPolygon = candidate.architecture.roomPolygon.map((point) => point.x === previousWidth
        ? { ...point, x: point.x + 200 }
        : point)
      candidates.push(candidate)
    }
    baseline.architecture.openings
      .filter((opening) => !architectureLocks.has(opening.id))
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      .forEach((opening) => {
        for (const delta of [-200, 200]) {
          const limit = opening.wall === 'top' || opening.wall === 'bottom' ? baseline.architecture.widthMm : baseline.architecture.depthMm
          if (opening.offsetMm + delta < 0 || opening.offsetMm + delta + opening.widthMm > limit) continue
          const candidate = structuredClone(baseline)
          candidate.architecture.openings.find((value) => value.id === opening.id)!.offsetMm += delta
          candidates.push(candidate)
        }
      })
  }
  return candidates
}

const center = (item: LayoutVariant['equipment'][number]) => ({ x: item.xMm + item.widthMm / 2, y: item.yMm + item.depthMm / 2 })
const flowGroups: readonly [readonly string[], readonly string[], number][] = [
  [['cold-retrieval'], ['food-prep'], 3],
  [['food-prep'], ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook'], 4],
  [['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook'], ['finish-plate', 'clean-window'], 4],
  [['dirty-window', 'dirty-landing'], ['dish-pre-rinse'], 3],
  [['dish-pre-rinse'], ['dish-wash'], 4],
  [['dish-wash'], ['clean-landing'], 4],
]

export function geometricFlowCost(variant: LayoutVariant): number {
  return flowGroups.reduce((total, [fromCapabilities, toCapabilities, weight]) => {
    const from = variant.equipment.filter((item) => item.capabilities.some((capability) => fromCapabilities.includes(capability)))
    const to = variant.equipment.filter((item) => item.capabilities.some((capability) => toCapabilities.includes(capability)))
    if (!from.length || !to.length) return total
    const shortest = Math.min(...from.flatMap((left) => to.map((right) => {
      const a = center(left); const b = center(right)
      return Math.hypot(a.x - b.x, a.y - b.y)
    })))
    return total + shortest * weight
  }, 0)
}

const meanMetrics = (values: readonly OptimizerMetrics[]): OptimizerMetrics => {
  const mean = (key: keyof OptimizerMetrics) => values.reduce((sum, value) => sum + value[key], 0) / values.length
  return {
    unfinishedOrders: mean('unfinishedOrders'),
    p90WaitSeconds: mean('p90WaitSeconds'),
    peakBacklog: mean('peakBacklog'),
    totalTravelMm: mean('totalTravelMm'),
    congestionEvents: mean('congestionEvents'),
  }
}

export function runAnytimeSearch(options: SearchOptions): AnytimeSearchResult {
  const parsedManifest = optimizerManifestSchema.parse(structuredClone(options.manifest))
  const baseline = structuredClone(options.baseline)
  if (parsedManifest.baselineVariantId !== baseline.id) throw new Error(`Optimizer manifest baseline ${parsedManifest.baselineVariantId} does not match supplied baseline ${baseline.id}.`)
  const manifest: OptimizerManifest = parsedManifest
  const now = options.now ?? Date.now
  const startedAt = now()
  let evaluationCount = 0
  let termination: AnytimeSearchResult['termination'] = 'exhausted'
  const seen = new Set<string>()
  const feasible: Array<{ variant: LayoutVariant; hash: string; heuristic: number }> = []
  const generated = generateCandidates(baseline, manifest)
  let infeasibleCandidates = 0

  for (const variant of generated) {
    if (options.isCancelled?.()) { termination = 'cancelled'; break }
    if (now() - startedAt >= manifest.budget.maxDurationMs) { termination = 'time-budget'; break }
    const hash = canonicalLayoutHash(variant)
    if (seen.has(hash)) continue
    seen.add(hash)
    if (checkCandidateFeasibility(baseline, variant, manifest).feasible) feasible.push({ variant, hash, heuristic: geometricFlowCost(variant) + layoutChangeCost(baseline, variant) * 100 })
    else infeasibleCandidates += 1
  }
  options.onProgress?.({ phase: 'feasibility', candidates: feasible.length, evaluations: evaluationCount })

  feasible.sort((left, right) => left.heuristic - right.heuristic || (left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0))
  const evaluationSlots = Math.max(0, Math.floor((manifest.budget.maxEvaluations - manifest.confirmationSeeds.length) / manifest.seeds.length))
  const shortlist = feasible.slice(0, evaluationSlots)
  const prunedCandidates = Math.max(0, feasible.length - shortlist.length)
  if (termination === 'exhausted' && prunedCandidates > 0) termination = 'evaluation-budget'
  const evaluationCache = new Map<string, OptimizerMetrics>()
  let evaluationCacheHits = 0
  const evaluate = (candidate: LayoutVariant, candidateHash: string, seed: number, confirmation: boolean) => {
    const key = `${candidateHash}:${seed}:${confirmation ? 'confirmation' : 'common'}`
    const cached = evaluationCache.get(key)
    if (cached) { evaluationCacheHits += 1; return cached }
    evaluationCount += 1
    const value = options.evaluate({ candidate: structuredClone(candidate), candidateHash, seed, confirmation })
    evaluationCache.set(key, value)
    return value
  }
  const commonMetrics = new Map<string, OptimizerMetrics[]>()

  const candidates: EvaluatedCandidate[] = []
  if (termination !== 'cancelled' && termination !== 'time-budget') {
    for (const candidate of shortlist) {
      if (options.isCancelled?.()) { termination = 'cancelled'; break }
      if (now() - startedAt >= manifest.budget.maxDurationMs) { termination = 'time-budget'; break }
      const confirmationReserve = manifest.confirmationSeeds.length
      if (evaluationCount + manifest.seeds.length + confirmationReserve > manifest.budget.maxEvaluations) { termination = 'evaluation-budget'; break }
      const metrics = manifest.seeds.map((seed) => evaluate(candidate.variant, candidate.hash, seed, false))
      commonMetrics.set(candidate.hash, metrics)
      candidates.push({
        id: `candidate-${candidate.hash}`,
        hash: candidate.hash,
        variant: candidate.variant,
        score: { ...meanMetrics(metrics), changeCost: layoutChangeCost(baseline, candidate.variant) },
        evaluatedSeeds: [...manifest.seeds],
        confirmationSeeds: [],
        diff: layoutDiff(baseline, candidate.variant),
      })
      options.onProgress?.({ phase: 'simulation', candidates: candidates.length, evaluations: evaluationCount, bestHash: [...candidates].sort(lexicographicCompare)[0]?.hash })
    }
  }

  const pareto = paretoFinalists(candidates)
  const confirmationPool = pareto.slice(0, 3)
  for (const candidate of confirmationPool) {
    if (termination === 'cancelled' || termination === 'time-budget') break
    if (options.isCancelled?.()) { termination = 'cancelled'; break }
    if (now() - startedAt >= manifest.budget.maxDurationMs) { termination = 'time-budget'; break }
    if (evaluationCount + manifest.confirmationSeeds.length > manifest.budget.maxEvaluations) { termination = 'evaluation-budget'; break }
    const confirmationMetrics = manifest.confirmationSeeds.map((seed) => {
      const value = evaluate(candidate.variant, candidate.hash, seed, true)
      candidate.confirmationSeeds.push(seed)
      return value
    })
    candidate.score = { ...meanMetrics([...(commonMetrics.get(candidate.hash) ?? []), ...confirmationMetrics]), changeCost: candidate.score.changeCost }
    options.onProgress?.({ phase: 'confirmation', candidates: candidates.length, evaluations: evaluationCount, bestHash: candidate.hash })
  }

  return {
    manifest: structuredClone(manifest),
    candidates: [...candidates].sort(lexicographicCompare),
    finalists: paretoFinalists(pareto.filter((candidate) => candidate.confirmationSeeds.length === manifest.confirmationSeeds.length)),
    evaluationCount,
    searchStats: {
      generatedCandidates: generated.length,
      uniqueCandidates: seen.size,
      infeasibleCandidates,
      prunedCandidates,
      evaluatedCandidates: candidates.length,
      evaluationCacheEntries: evaluationCache.size,
      evaluationCacheHits,
    },
    termination,
    bestObservedDisclaimer: 'These are the best observed layouts under the frozen experiment manifest and search budget; they are not guaranteed global optima.',
  }
}
