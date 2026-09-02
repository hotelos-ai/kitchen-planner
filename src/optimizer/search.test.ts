import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { canonicalLayoutHash } from './canonical-layout'
import { physicalStationCapacity } from '../simulation/validation'
import { generateCandidates, geometricFlowCost, runAnytimeSearch } from './search'
import type { OptimizerManifest, OptimizerMetrics } from './types'

const manifest = (maxEvaluations = 12): OptimizerManifest => ({
  id: 'experiment', documentId: 'document', revision: 3, baselineVariantId: 'baseline-trace', scenarioIds: ['dinner-peak'],
  seeds: [3, 5], confirmationSeeds: [101], permissions: { placement: true, equipmentRedesign: false, architecture: false }, lockedComponentIds: [], lockedArchitectureElementIds: [],
  hardRules: { minimumAisleMm: 700, noGoZones: [] }, budget: { maxEvaluations, maxDurationMs: 30_000 },
})
const metrics = (travel: number): OptimizerMetrics => ({ unfinishedOrders: 0, p90WaitSeconds: travel / 20, peakBacklog: 4, totalTravelMm: travel, congestionEvents: 1 })

describe('deterministic anytime search', () => {
  it('finds a deterministic improvement on a toy layout without moving locked inventory', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    baseline.architecture = {
      ...baseline.architecture,
      widthMm: 5000,
      depthMm: 5000,
      roomPolygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }],
      openings: [], pillars: [], storageZones: [],
    }
    baseline.equipment = [{ ...baseline.equipment[0], id: 'movable', xMm: 1200, yMm: 1200, widthMm: 500, depthMm: 500 }]
    const result = runAnytimeSearch({
      baseline,
      manifest: { ...manifest(20), lockedComponentIds: [] },
      evaluate: ({ candidate }) => metrics(candidate.equipment[0].xMm),
    })

    expect(result.candidates[0].score.totalTravelMm).toBeLessThan(1200)
    expect(result.candidates[0].variant.equipment[0].xMm).toBe(1000)
  })

  it('uses common seeds, deduplicates, confirms finalists, and is deterministic', () => {
    const baseline = createSeedProject().variants[0]
    const seen: Array<{ hash: string; seed: number; confirmation: boolean }> = []
    const evaluate = vi.fn(({ candidateHash, seed, confirmation }: { candidateHash: string; seed: number; confirmation: boolean }) => {
      seen.push({ hash: candidateHash, seed, confirmation })
      return metrics(10_000 + candidateHash.charCodeAt(0) * 10 + seed)
    })
    const first = runAnytimeSearch({ baseline, manifest: manifest(), evaluate })
    const second = runAnytimeSearch({ baseline, manifest: manifest(), evaluate })

    expect(first.bestObservedDisclaimer).toMatch(/best observed/i)
    expect(first.candidates.map((item) => item.hash)).toEqual(second.candidates.map((item) => item.hash))
    expect(new Set(first.candidates.map((item) => item.hash)).size).toBe(first.candidates.length)
    expect(first.candidates.every((item) => item.evaluatedSeeds.join(',') === '3,5')).toBe(true)
    expect(first.finalists.every((item) => item.confirmationSeeds.join(',') === '101')).toBe(true)
    expect(seen.some((entry) => entry.confirmation)).toBe(true)
    const confirmed = first.finalists[0]
    if (confirmed) {
      const heldOutMean = [3, 5, 101].reduce((sum, seed) => sum + 10_000 + confirmed.hash.charCodeAt(0) * 10 + seed, 0) / 3
      expect(confirmed.score.totalTravelMm).toBeCloseTo(heldOutMean)
    }
    expect(first.searchStats).toEqual(second.searchStats)
    expect(first.searchStats!.evaluationCacheEntries).toBe(first.evaluationCount)
  })

  it('uses frozen seeds to generate deterministic large-neighborhood placement candidates', () => {
    const baseline = createSeedProject().variants[0]
    const forSeeds = (seeds: number[]) => generateCandidates(baseline, { ...manifest(200), seeds })
      .map(canonicalLayoutHash)

    expect(forSeeds([3, 5])).toEqual(forSeeds([3, 5]))
    expect(forSeeds([3])).not.toEqual(forSeeds([7]))
    expect(forSeeds([3]).length).toBeGreaterThan(1)
  })

  it('terminates at the evaluation budget and honors cancellation', () => {
    const baseline = createSeedProject().variants[0]
    const budgeted = runAnytimeSearch({ baseline, manifest: manifest(2), evaluate: () => metrics(10_000) })
    expect(budgeted.termination).toBe('evaluation-budget')
    expect(budgeted.evaluationCount).toBeLessThanOrEqual(2)
    const cancelled = runAnytimeSearch({ baseline, manifest: manifest(), evaluate: () => metrics(10_000), isCancelled: () => true })
    expect(cancelled.termination).toBe('cancelled')
    expect(cancelled.evaluationCount).toBe(0)
  })

  it('generates only changes authorized by A/B/C and always respects item locks', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    baseline.architecture.locked = false
    baseline.equipment = [{ ...baseline.equipment[0], id: 'editable', dimensionsLocked: false, removable: true }]
    const forTier = (permissionTier: 'A' | 'B' | 'C', lockedComponentIds: string[] = []) => generateCandidates(
      baseline,
      { ...manifest(100), baselineVariantId: baseline.id, permissions: { placement: true, equipmentRedesign: permissionTier !== 'A', architecture: permissionTier === 'C' }, lockedComponentIds },
    )

    expect(forTier('A').every((candidate) => candidate.equipment.length === 1
      && candidate.equipment[0].widthMm === baseline.equipment[0].widthMm
      && candidate.architecture.widthMm === baseline.architecture.widthMm)).toBe(true)
    expect(forTier('B').some((candidate) => candidate.equipment.length === 0 || candidate.equipment[0].widthMm !== baseline.equipment[0].widthMm)).toBe(true)
    expect(forTier('B').every((candidate) => candidate.architecture.widthMm === baseline.architecture.widthMm)).toBe(true)
    expect(forTier('C').some((candidate) => JSON.stringify(candidate.architecture) !== JSON.stringify(baseline.architecture))).toBe(true)
    expect(forTier('C', ['editable']).every((candidate) => candidate.equipment[0]?.xMm === baseline.equipment[0].xMm)).toBe(true)
  })

  it('uses polygon segment lengths for openings and searches unlocked storage zones in C scope', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    baseline.architecture = {
      ...baseline.architecture,
      widthMm: 3000,
      depthMm: 3000,
      roomPolygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 1500, y: 1500 }, { x: 0, y: 3000 }],
      locked: false,
      openings: [{ id: 'diagonal', label: 'Diagonal', kind: 'service-window', wall: 'right', segmentIndex: 1, offsetMm: 500, widthMm: 600 }],
      storageZones: [{ id: 'dry-zone', label: 'Dry', xMm: 300, yMm: 1800, widthMm: 500, depthMm: 500, adjacent: false }],
    }
    baseline.equipment = []
    const candidates = generateCandidates(baseline, {
      ...manifest(100),
      permissions: { placement: false, equipmentRedesign: false, architecture: true },
      lockedArchitectureElementIds: [],
    })

    expect(candidates.some((candidate) => candidate.architecture.storageZones[0]?.xMm !== 300)).toBe(true)
    expect(candidates.flatMap((candidate) => candidate.architecture.openings)
      .every((opening) => opening.offsetMm >= 0 && opening.offsetMm + opening.widthMm <= Math.hypot(1500, 1500))).toBe(true)
  })

  it('generates deterministic B substitutions and additions required by frozen capacity rules', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    const candidates = generateCandidates(baseline, {
      ...manifest(500),
      permissions: { placement: false, equipmentRedesign: true, architecture: false },
      hardRules: { minimumAisleMm: 0, noGoZones: [], requiredCapacityByCapability: { 'dish-wash': 3 } },
    })
    expect(candidates.some((candidate) => candidate.equipment.some((item) => item.id.startsWith('optimizer-add-dish-wash')))).toBe(true)
    expect(candidates.some((candidate) => candidate.equipment
      .filter((item) => item.capabilities.includes('dish-wash'))
      .reduce((total, item) => total + physicalStationCapacity(item), 0) >= 3)).toBe(true)
    expect(candidates.some((candidate) => candidate.equipment.some((item) => item.catalogId !== baseline.equipment.find((source) => source.id === item.id)?.catalogId))).toBe(true)
    expect(generateCandidates(baseline, {
      ...manifest(500), permissions: { placement: false, equipmentRedesign: true, architecture: false },
      hardRules: { minimumAisleMm: 0, noGoZones: [], requiredCapacityByCapability: { 'dish-wash': 3 } },
    })).toEqual(candidates)
  })

  it('uses a deterministic weighted-flow heuristic to prune before expensive evaluation', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    baseline.architecture = {
      ...baseline.architecture,
      widthMm: 5000, depthMm: 5000,
      roomPolygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }],
      openings: [], pillars: [], storageZones: [], locked: true,
    }
    baseline.equipment = [
      { ...baseline.equipment[0], id: 'cold', xMm: 500, yMm: 500, widthMm: 500, depthMm: 500, capabilities: ['cold-retrieval'] },
      { ...baseline.equipment[1], id: 'prep', xMm: 1500, yMm: 500, widthMm: 500, depthMm: 500, capabilities: ['food-prep'] },
    ]
    const farther = structuredClone(baseline)
    farther.equipment[1].xMm = 3500
    expect(geometricFlowCost(baseline)).toBeLessThan(geometricFlowCost(farther))

    const result = runAnytimeSearch({
      baseline,
      manifest: { ...manifest(5), baselineVariantId: baseline.id, seeds: [3], confirmationSeeds: [101] },
      evaluate: () => metrics(10_000),
    })
    expect(result.searchStats!.prunedCandidates).toBeGreaterThan(0)
    expect(result.searchStats!.evaluatedCandidates).toBe(result.candidates.length)
  })

  it('rejects mismatched frozen baseline bindings and isolates evaluator mutation', () => {
    const baseline = structuredClone(createSeedProject().variants[0])
    expect(() => runAnytimeSearch({
      baseline,
      manifest: { ...manifest(), baselineVariantId: 'other-layout' },
      evaluate: () => metrics(10_000),
    })).toThrow(/baseline/i)

    const originalX = baseline.equipment[0].xMm
    const result = runAnytimeSearch({
      baseline,
      manifest: manifest(),
      evaluate: ({ candidate }) => {
        candidate.equipment[0].xMm = 999_999
        return metrics(10_000)
      },
    })
    expect(baseline.equipment[0].xMm).toBe(originalX)
    expect(result.candidates.every((candidate) => candidate.variant.equipment[0].xMm !== 999_999)).toBe(true)
  })

  it('always evaluates the baseline and skips individual candidates rejected by simulation', () => {
    const baseline = createSeedProject().variants[0]
    const baselineHash = canonicalLayoutHash(baseline)
    const evaluatedHashes: string[] = []

    const result = runAnytimeSearch({
      baseline,
      manifest: { ...manifest(8), baselineVariantId: baseline.id },
      evaluate: ({ candidateHash }) => {
        evaluatedHashes.push(candidateHash)
        if (candidateHash !== baselineHash) throw new Error('route-station-unreachable')
        return metrics(10_000)
      },
    })

    expect(evaluatedHashes).toContain(baselineHash)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].hash).toBe(baselineHash)
    expect(result.finalists).toHaveLength(1)
  })

  it('retains actionable feasibility and simulation rejection diagnostics when no finalist exists', () => {
    const baseline = createSeedProject().variants[0]
    const infeasible = runAnytimeSearch({
      baseline,
      manifest: {
        ...manifest(8),
        baselineVariantId: baseline.id,
        hardRules: {
          minimumAisleMm: 0,
          noGoZones: [{ id: 'whole-room', xMm: 0, yMm: 0, widthMm: 3900, depthMm: 6650 }],
        },
      },
      evaluate: () => metrics(10_000),
    })
    expect(infeasible.finalists).toEqual([])
    expect(infeasible.diagnostics?.feasibilityReasonCounts['no-go-overlap']).toBeGreaterThan(0)

    const rejected = runAnytimeSearch({
      baseline,
      manifest: { ...manifest(8), baselineVariantId: baseline.id, hardRules: { minimumAisleMm: 0, noGoZones: [] } },
      evaluate: () => { throw new Error('route-station-unreachable: Tandoor') },
    })
    expect(rejected.finalists).toEqual([])
    expect(rejected.diagnostics).toMatchObject({
      simulationRejectionCount: expect.any(Number),
      simulationRejectionMessages: ['route-station-unreachable: Tandoor'],
    })
    expect(rejected.diagnostics!.simulationRejectionCount).toBeGreaterThan(0)
  })
})
