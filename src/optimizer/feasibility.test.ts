import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { checkCandidateFeasibility } from './feasibility'
import type { EquipmentItem, LayoutVariant } from '../domain/project'
import type { OptimizerManifest } from './types'

const manifest = (tier: 'A' | 'B' | 'C', lockedComponentIds: string[] = []): OptimizerManifest => ({
  id: 'experiment', documentId: 'document', revision: 2, baselineVariantId: 'baseline', scenarioIds: ['dinner-peak'],
  seeds: [11, 12], confirmationSeeds: [91], permissionTier: tier, lockedComponentIds, lockedArchitectureElementIds: [],
  hardRules: { minimumAisleMm: 800, noGoZones: [] }, budget: { maxEvaluations: 20, maxDurationMs: 10_000 },
})

describe('candidate feasibility', () => {
  it('accepts the frozen baseline when it does not introduce a new hard violation', () => {
    const baseline = createSeedProject().variants[0]
    expect(checkCandidateFeasibility(baseline, baseline, manifest('A'))).toEqual({ feasible: true, codes: [], reasons: [] })
  })

  it('enforces locks before scoring', () => {
    const baseline = createSeedProject().variants[0]
    const moved = structuredClone(baseline)
    moved.equipment.find((item) => item.id === 'tandoor')!.xMm += 100
    expect(checkCandidateFeasibility(baseline, moved, manifest('C', ['tandoor']))).toEqual(expect.objectContaining({ feasible: false, codes: expect.arrayContaining(['locked-component-changed']) }))
  })

  it('enforces A/B/C permission boundaries', () => {
    const baseline = createSeedProject().variants[0]
    const resized = structuredClone(baseline)
    resized.equipment[0].widthMm += 100
    expect(checkCandidateFeasibility(baseline, resized, manifest('A')).codes).toContain('equipment-redesign-not-authorized')
    expect(checkCandidateFeasibility(baseline, resized, manifest('B')).codes).not.toContain('equipment-redesign-not-authorized')
    const architecture = structuredClone(baseline)
    architecture.architecture.wallHeightMm += 100
    expect(checkCandidateFeasibility(baseline, architecture, manifest('B')).codes).toContain('architecture-change-not-authorized')
    expect(checkCandidateFeasibility(baseline, architecture, manifest('C')).codes).not.toContain('architecture-change-not-authorized')
  })

  it('rejects boundary and explicit no-go violations before evaluation', () => {
    const baseline = createSeedProject().variants[0]
    const invalid = structuredClone(baseline)
    invalid.equipment[0].xMm = -1000
    const result = checkCandidateFeasibility(baseline, invalid, { ...manifest('A'), hardRules: { minimumAisleMm: 800, noGoZones: [{ id: 'protected', xMm: 0, yMm: 0, widthMm: 1000, depthMm: 1000 }] } })
    expect(result.feasible).toBe(false)
    expect(result.codes).toEqual(expect.arrayContaining(['outside-room', 'no-go-overlap']))
  })

  it('rejects component, pillar, door-swing, and newly obstructed clearance overlaps', () => {
    const baseline = simpleVariant()
    const candidate = structuredClone(baseline)
    candidate.equipment.push(item('clearance-blocker', 500, 1000))
    candidate.architecture.pillars = [{ id: 'pillar-new', xMm: 500, yMm: 1000, widthMm: 100, depthMm: 100 }]
    candidate.architecture.openings = [{
      id: 'door', label: 'Door', kind: 'door', wall: 'top', offsetMm: 500, widthMm: 500, flow: 'entry', swingDepthMm: 1200,
    }]
    const result = checkCandidateFeasibility(baseline, candidate, manifest('C'))
    expect(result.codes).toEqual(expect.arrayContaining(['clearance-obstructed', 'pillar-overlap', 'door-swing-overlap']))

    candidate.equipment[1].xMm = 700
    candidate.equipment[1].yMm = 700
    expect(checkCandidateFeasibility(baseline, candidate, manifest('C')).codes).toContain('component-overlap')
  })

  it('enforces configured capability capacity before simulation', () => {
    const baseline = simpleVariant()
    baseline.equipment.push(item('prep-two', 1800, 500, ['food-prep']))
    const candidate = structuredClone(baseline)
    candidate.equipment.pop()
    const result = checkCandidateFeasibility(baseline, candidate, {
      ...manifest('B'),
      hardRules: { minimumAisleMm: 0, noGoZones: [], requiredCapacityByCapability: { 'food-prep': 2 } },
    })
    expect(result).toEqual(expect.objectContaining({
      feasible: false,
      codes: expect.arrayContaining(['required-capacity-missing']),
    }))
  })

  it('rejects body-inflated unreachable stations and reports the affected station', () => {
    const baseline = simpleVariant()
    baseline.architecture.widthMm = 3000
    baseline.architecture.depthMm = 2000
    baseline.architecture.roomPolygon = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }, { x: 0, y: 2000 }]
    baseline.architecture.openings = [{ id: 'entry', label: 'Entry', kind: 'door', wall: 'left', offsetMm: 400, widthMm: 600, flow: 'entry' }]
    baseline.equipment = [item('station', 2300, 700, ['food-prep']), item('barrier', 1200, 1300)]
    baseline.equipment[1].widthMm = 600
    baseline.equipment[1].depthMm = 500
    baseline.equipment[1].dimensionsLocked = false
    const blocked = structuredClone(baseline)
    blocked.equipment[1].yMm = 0
    blocked.equipment[1].depthMm = 2000
    const result = checkCandidateFeasibility(baseline, blocked, {
      ...manifest('B'),
      hardRules: { minimumAisleMm: 400, bodyRadiusMm: 200, noGoZones: [] },
    })
    expect(result.codes).toContain('station-unreachable')
    expect(result.reasons.join(' ')).toMatch(/station/i)
  })

  it('enforces intrinsic move, dimension, removal and exact architecture-element locks', () => {
    const baseline = simpleVariant()
    baseline.equipment[0].movable = false
    baseline.equipment[0].removable = false
    const moved = structuredClone(baseline)
    moved.equipment[0].xMm += 100
    moved.equipment[0].widthMm += 100
    expect(checkCandidateFeasibility(baseline, moved, manifest('C')).codes).toEqual(expect.arrayContaining([
      'immovable-component-changed', 'locked-dimensions-changed',
    ]))
    const removed = structuredClone(baseline)
    removed.equipment = []
    expect(checkCandidateFeasibility(baseline, removed, manifest('C')).codes).toContain('nonremovable-component-removed')

    baseline.architecture.locked = false
    baseline.architecture.openings = [
      { id: 'locked-door', label: 'Locked', kind: 'door', wall: 'left', offsetMm: 300, widthMm: 500 },
      { id: 'free-door', label: 'Free', kind: 'door', wall: 'right', offsetMm: 300, widthMm: 500 },
    ]
    const changedFree = structuredClone(baseline)
    changedFree.architecture.openings[1].offsetMm += 100
    const lockedManifest = { ...manifest('C'), lockedArchitectureElementIds: ['locked-door'] }
    expect(checkCandidateFeasibility(baseline, changedFree, lockedManifest).codes).not.toContain('locked-architecture-changed')
    const changedLocked = structuredClone(baseline)
    changedLocked.architecture.openings[0].offsetMm += 100
    expect(checkCandidateFeasibility(baseline, changedLocked, lockedManifest).codes).toContain('locked-architecture-changed')
  })
})

const item = (id: string, xMm: number, yMm: number, capabilities: EquipmentItem['capabilities'] = []): EquipmentItem => ({
  id, label: id, category: 'prep', widthMm: 500, depthMm: 500, heightMm: 900,
  xMm, yMm, rotationDeg: 0, dimensionsLocked: true, movable: true, removable: true,
  capabilities, clearance: id === 'prep' ? { frontMm: 500, kind: 'work' } : undefined,
})

function simpleVariant(): LayoutVariant {
  return {
    id: 'baseline', name: 'Baseline',
    architecture: {
      widthMm: 3000, depthMm: 3000, wallHeightMm: 2800,
      roomPolygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
      openings: [], pillars: [], storageZones: [], locked: false,
    },
    equipment: [item('prep', 500, 500, ['food-prep'])],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
