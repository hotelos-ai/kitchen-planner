import type { LayoutVariant } from '../domain/project'
import { createCatalogEquipmentItem, KITCHEN_CATALOG } from '../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../domain/catalog/suggest-placement'
import { rotateInPlace } from '../domain/geometry'
import { physicalStationCapacity } from '../simulation/validation'
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

const seededRandom = (seed: number) => {
  let state = (seed | 0) ^ 0x9e3779b9
  return () => {
    state = Math.imul(state ^ state >>> 16, 0x21f0aaad)
    state = Math.imul(state ^ state >>> 15, 0x735a2d97)
    return ((state ^= state >>> 15) >>> 0) / 0x1_0000_0000
  }
}

export function generateCandidates(baseline: LayoutVariant, manifest: OptimizerManifest): LayoutVariant[] {
  const candidates = [structuredClone(baseline)]
  const locked = new Set(manifest.lockedComponentIds)
  const deltas = [{ x: 200, y: 0 }, { x: -200, y: 0 }, { x: 0, y: 200 }, { x: 0, y: -200 }]
  if (manifest.permissions.placement) baseline.equipment
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
        Object.assign(changed, rotateInPlace(changed, deltaDeg))
        candidates.push(candidate)
      }
    })
  if (manifest.permissions.placement) {
    const movable = baseline.equipment.filter((item) => item.movable && !locked.has(item.id)).sort((left, right) => left.id.localeCompare(right.id))
    movable.slice(0, -1).forEach((item, index) => {
      const other = movable[index + 1]
      for (const delta of deltas) {
        const candidate = structuredClone(baseline)
        for (const id of [item.id, other.id]) {
          const changed = candidate.equipment.find((value) => value.id === id)!
          changed.xMm += delta.x
          changed.yMm += delta.y
        }
        candidates.push(candidate)
      }
    })
    manifest.seeds.forEach((seed) => {
      const random = seededRandom(seed)
      const shuffled = [...movable]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1))
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
      }
      const maximumNeighborhood = Math.min(6, shuffled.length)
      for (let size = 2; size <= maximumNeighborhood; size += 1) {
        const candidate = structuredClone(baseline)
        shuffled.slice(0, size).forEach((item) => {
          const changed = candidate.equipment.find((value) => value.id === item.id)!
          const axis = random() < .5 ? 'xMm' : 'yMm'
          const distance = (random() < .5 ? -1 : 1) * (random() < .5 ? 200 : 400)
          changed[axis] += distance
          if (random() < .35) Object.assign(changed, rotateInPlace(changed, random() < .5 ? -90 : 90))
        })
        candidates.push(candidate)
      }
    })
  }
  if (manifest.permissions.equipmentRedesign) {
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
        const sourceEntry = KITCHEN_CATALOG.find((entry) => entry.catalogId === item.catalogId)
        const substitute = sourceEntry && KITCHEN_CATALOG.find((entry) => entry.familyId === sourceEntry.familyId && entry.catalogId !== sourceEntry.catalogId)
        if (substitute) {
          const candidate = structuredClone(baseline)
          const replacement = createCatalogEquipmentItem({
            catalogId: substitute.catalogId,
            componentId: item.id,
            position: { xMm: item.xMm, yMm: item.yMm },
            rotationDeg: item.rotationDeg,
          })
          candidate.equipment = candidate.equipment.map((value) => value.id === item.id ? {
            ...replacement,
            movable: item.movable,
            removable: item.removable,
            dimensionsLocked: item.dimensionsLocked,
          } : value)
          candidates.push(candidate)
        }
      })
    Object.entries(manifest.hardRules.requiredCapacityByCapability ?? {}).sort(([left], [right]) => left.localeCompare(right)).forEach(([capability, required]) => {
      const actual = baseline.equipment
        .filter((item) => item.capabilities.includes(capability as never))
        .reduce((total, item) => total + physicalStationCapacity(item), 0)
      if (required === undefined || actual >= required) return
      const entry = KITCHEN_CATALOG.find((candidate) => candidate.capabilities.includes(capability))
      if (!entry) return
      const candidate = structuredClone(baseline)
      let capacity = actual
      let additionIndex = 1
      while (capacity < required) {
        const placement = suggestCatalogPlacement({ architecture: candidate.architecture, equipment: candidate.equipment, entry, snapMm: 100, layoutConstraints: { noGoZones: manifest.hardRules.noGoZones } })
        if (!placement) return
        const componentId = `optimizer-add-${capability}-${additionIndex}`
        const added = createCatalogEquipmentItem({ catalogId: entry.catalogId, componentId, position: placement })
        candidate.equipment.push(added)
        capacity += physicalStationCapacity(added)
        additionIndex += 1
      }
      candidates.push(candidate)
    })
  }
  if (manifest.permissions.architecture && !baseline.architecture.locked) {
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
          const segmentStart = opening.segmentIndex === undefined ? undefined : baseline.architecture.roomPolygon[opening.segmentIndex]
          const segmentEnd = opening.segmentIndex === undefined ? undefined : baseline.architecture.roomPolygon[(opening.segmentIndex + 1) % baseline.architecture.roomPolygon.length]
          const limit = segmentStart && segmentEnd
            ? Math.hypot(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y)
            : opening.wall === 'top' || opening.wall === 'bottom' ? baseline.architecture.widthMm : baseline.architecture.depthMm
          if (opening.offsetMm + delta < 0 || opening.offsetMm + delta + opening.widthMm > limit) continue
          const candidate = structuredClone(baseline)
          candidate.architecture.openings.find((value) => value.id === opening.id)!.offsetMm += delta
          candidates.push(candidate)
        }
      })
    baseline.architecture.storageZones
      .filter((zone) => !architectureLocks.has(zone.id))
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((zone) => {
        for (const delta of [-200, 200]) {
          const nextX = zone.xMm + delta
          if (nextX < 0 || nextX + zone.widthMm > baseline.architecture.widthMm) continue
          const candidate = structuredClone(baseline)
          candidate.architecture.storageZones.find((value) => value.id === zone.id)!.xMm = nextX
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
  const mean = (key: 'unfinishedOrders' | 'p90WaitSeconds' | 'peakBacklog' | 'totalTravelMm' | 'congestionEvents') =>
    values.reduce((sum, value) => sum + value[key], 0) / values.length
  const optionalMean = (key: 'completionPct' | 'throughputPerHour') => {
    const present = values.map((value) => value[key]).filter((value): value is number => value !== undefined)
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : undefined
  }
  const completionPct = optionalMean('completionPct')
  const throughputPerHour = optionalMean('throughputPerHour')
  return {
    unfinishedOrders: mean('unfinishedOrders'),
    p90WaitSeconds: mean('p90WaitSeconds'),
    peakBacklog: mean('peakBacklog'),
    totalTravelMm: mean('totalTravelMm'),
    congestionEvents: mean('congestionEvents'),
    ...(completionPct === undefined ? {} : { completionPct }),
    ...(throughputPerHour === undefined ? {} : { throughputPerHour }),
  }
}

export function runAnytimeSearch(options: SearchOptions): AnytimeSearchResult {
  const parsedManifest = optimizerManifestSchema.parse(structuredClone(options.manifest))
  const baseline = structuredClone(options.baseline)
  if (parsedManifest.baselineVariantId !== baseline.id) throw new Error(`Optimizer manifest baseline ${parsedManifest.baselineVariantId} does not match supplied baseline ${baseline.id}.`)
  const manifest: OptimizerManifest = parsedManifest
  const baselineHash = canonicalLayoutHash(baseline)
  const now = options.now ?? Date.now
  const startedAt = now()
  let evaluationCount = 0
  let termination: AnytimeSearchResult['termination'] = 'exhausted'
  const seen = new Set<string>()
  const feasible: Array<{ variant: LayoutVariant; hash: string; heuristic: number }> = []
  const generated = generateCandidates(baseline, manifest)
  let infeasibleCandidates = 0
  const feasibilityReasonCounts: Record<string, number> = {}
  let simulationRejectionCount = 0
  const simulationRejectionMessages: string[] = []
  const countFeasibilityReasons = (codes: readonly string[]) => codes.forEach((code) => {
    feasibilityReasonCounts[code] = (feasibilityReasonCounts[code] ?? 0) + 1
  })
  const recordSimulationRejection = (reason: unknown) => {
    simulationRejectionCount += 1
    const message = reason instanceof Error ? reason.message : String(reason)
    if (message && !simulationRejectionMessages.includes(message) && simulationRejectionMessages.length < 10) simulationRejectionMessages.push(message)
  }

  for (const variant of generated) {
    if (options.isCancelled?.()) { termination = 'cancelled'; break }
    if (now() - startedAt >= manifest.budget.maxDurationMs) { termination = 'time-budget'; break }
    const hash = canonicalLayoutHash(variant)
    if (seen.has(hash)) continue
    seen.add(hash)
    const feasibility = checkCandidateFeasibility(baseline, variant, manifest)
    if (feasibility.feasible) feasible.push({ variant, hash, heuristic: geometricFlowCost(variant) + layoutChangeCost(baseline, variant) * 100 })
    else {
      infeasibleCandidates += 1
      countFeasibilityReasons(feasibility.codes)
    }
  }
  options.onProgress?.({ phase: 'feasibility', candidates: feasible.length, evaluations: evaluationCount })

  feasible.sort((left, right) => left.heuristic - right.heuristic || (left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0))
  const evaluationSlots = Math.max(0, Math.floor((manifest.budget.maxEvaluations - manifest.confirmationSeeds.length) / manifest.seeds.length))
  const feasibleBaseline = feasible.find((candidate) => candidate.hash === baselineHash)
  const orderedFeasible = feasibleBaseline
    ? [feasibleBaseline, ...feasible.filter((candidate) => candidate.hash !== baselineHash)]
    : feasible
  const shortlist = orderedFeasible.slice(0, evaluationSlots)
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
      const metrics: OptimizerMetrics[] = []
      let rejectedBySimulation = false
      for (const seed of manifest.seeds) {
        try {
          metrics.push(evaluate(candidate.variant, candidate.hash, seed, false))
        } catch (reason) {
          rejectedBySimulation = true
          recordSimulationRejection(reason)
          break
        }
      }
      if (rejectedBySimulation) {
        infeasibleCandidates += 1
        continue
      }
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
      options.onProgress?.({ phase: 'simulation', candidates: candidates.length, evaluations: evaluationCount, bestHash: [...candidates].sort((left, right) => lexicographicCompare(left, right, manifest.priority))[0]?.hash })
    }
  }

  const pareto = paretoFinalists(candidates, manifest.priority)
  const confirmationPool = pareto.slice(0, 3)
  for (const candidate of confirmationPool) {
    if (termination === 'cancelled' || termination === 'time-budget') break
    if (options.isCancelled?.()) { termination = 'cancelled'; break }
    if (now() - startedAt >= manifest.budget.maxDurationMs) { termination = 'time-budget'; break }
    if (evaluationCount + manifest.confirmationSeeds.length > manifest.budget.maxEvaluations) { termination = 'evaluation-budget'; break }
    const confirmationMetrics: OptimizerMetrics[] = []
    for (const seed of manifest.confirmationSeeds) {
      try {
        confirmationMetrics.push(evaluate(candidate.variant, candidate.hash, seed, true))
        candidate.confirmationSeeds.push(seed)
      } catch (reason) {
        recordSimulationRejection(reason)
        break
      }
    }
    if (confirmationMetrics.length !== manifest.confirmationSeeds.length) continue
    candidate.score = { ...meanMetrics([...(commonMetrics.get(candidate.hash) ?? []), ...confirmationMetrics]), changeCost: candidate.score.changeCost }
    options.onProgress?.({ phase: 'confirmation', candidates: candidates.length, evaluations: evaluationCount, bestHash: candidate.hash })
  }

  return {
    manifest: structuredClone(manifest),
    candidates: [...candidates].sort((left, right) => lexicographicCompare(left, right, manifest.priority)),
    finalists: paretoFinalists(pareto.filter((candidate) => candidate.confirmationSeeds.length === manifest.confirmationSeeds.length), manifest.priority),
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
    diagnostics: { feasibilityReasonCounts, simulationRejectionCount, simulationRejectionMessages },
    termination,
    bestObservedDisclaimer: 'These are the best observed layouts under the frozen experiment manifest and search budget; they are not guaranteed global optima.',
  }
}
