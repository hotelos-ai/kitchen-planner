import { describe, expect, it } from 'vitest'
import type { Architecture, EquipmentItem } from '../domain/project'
import { emptyMetrics } from './metrics'
import { buildFindings, compareResults } from './recommendations'
import type { SimulationResult } from './types'

const result = (patch: Partial<ReturnType<typeof emptyMetrics>>): SimulationResult => ({
  seed: 1, durationSeconds: 3600, frames: [], events: [], taskTimeline: [], orders: [], warnings: [], metrics: { ...emptyMetrics(), ...patch },
})

const equipment = (id: string, label: string, capabilities: EquipmentItem['capabilities'], patch: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id, label, capabilities, category: 'custom', widthMm: 600, depthMm: 600, heightMm: 900,
  xMm: 0, yMm: 0, rotationDeg: 0, dimensionsLocked: false, movable: true, removable: true, ...patch,
})

const architecture: Architecture = {
  widthMm: 6000,
  depthMm: 4000,
  wallHeightMm: 2800,
  roomPolygon: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }],
  openings: [{ id: 'crew-door', label: 'Crew entrance', kind: 'door', wall: 'top', offsetMm: 700, widthMm: 900, flow: 'entry', swingDepthMm: 900 }],
  pillars: [], storageZones: [], locked: false,
}

describe('layout recommendations', () => {
  it('recommends the candidate only when evidence improves a hot-line pressure point', () => {
    const findings = buildFindings({ baseline: result({ hotLineCongestionEvents: 50 }), candidate: result({ hotLineCongestionEvents: 12 }) })
    expect(findings).toContainEqual(expect.objectContaining({
      ruleId: 'hot-line-pinch-point', severity: 'high',
      evidence: expect.arrayContaining([expect.stringMatching(/congestion/i)]),
      delta: expect.objectContaining({ direction: 'improved' }),
    }))
  })

  it('preserves positive findings for compact wash-up zoning', () => {
    const good = result({ dirtyToWashTravelMm: 18000, unreachableTasks: 0 })
    expect(buildFindings({ baseline: good, candidate: good }).some((finding) => finding.ruleId === 'wash-route-performing-well')).toBe(true)
  })

  it('uses generic metric labels and arbitrary cooking-station ids', () => {
    const candidateEquipment = [
      equipment('plancha-west', 'West plancha', ['flat-top-cook'], { category: 'cooking' }),
      equipment('range-east', 'East range', ['range-cook'], { category: 'cooking' }),
      equipment('cold-bank', 'Cold bank', ['cold-retrieval'], { category: 'cold' }),
    ]
    const baseline = result({ hotLineCongestionEvents: 35 })
    const candidate = result({ hotLineCongestionEvents: 12 })

    expect(compareResults(baseline, candidate).find((metric) => metric.key === 'doorConflictEvents')?.label).toBe('Entry door conflicts')
    const finding = buildFindings({ baseline, candidate, candidateEquipment }).find((value) => value.ruleId === 'hot-line-pinch-point')
    expect(finding).toMatchObject({ affectedItemIds: ['plancha-west', 'range-east'] })
    expect(JSON.stringify(finding)).not.toMatch(/D2|tandoor|six-burner|flat-top-fryer/i)
  })

  it('links unreachable and workflow findings to matching capabilities and warnings', () => {
    const candidateEquipment = [
      equipment('frozen-vault', 'Frozen vault', ['cold-retrieval'], { category: 'cold' }),
      equipment('plate-bench', 'Plate bench', ['finish-plate'], { category: 'prep' }),
      equipment('return-bench', 'Return bench', ['dirty-landing'], { category: 'landing' }),
      equipment('spray-sink', 'Spray sink', ['dish-pre-rinse'], { category: 'washing' }),
      equipment('rack-washer', 'Rack washer', ['dish-wash'], { category: 'washing' }),
      equipment('clean-bench', 'Clean bench', ['clean-landing'], { category: 'landing' }),
    ]
    const baseline = result({ unreachableTasks: 0 })
    const candidate = { ...result({ unreachableTasks: 2, dirtyCleanCrossings: 3, finishToPassTravelMm: 31_000 }), warnings: ['Frozen vault is unreachable from the current circulation grid.'] }
    const findings = buildFindings({ baseline, candidate, candidateEquipment })

    expect(findings.find((value) => value.ruleId === 'station-access-failure')?.affectedItemIds).toEqual(['frozen-vault'])
    expect(findings.find((value) => value.ruleId === 'dirty-clean-crossing')?.affectedItemIds).toEqual(expect.arrayContaining(['return-bench', 'spray-sink', 'plate-bench', 'clean-bench']))
    expect(findings.find((value) => value.ruleId === 'finish-to-pass-distance')?.affectedItemIds).toEqual(['plate-bench'])
  })

  it('derives entry-buffer recommendations from opening flow and relative geometry', () => {
    const candidateEquipment = [
      equipment('receiving-cart', 'Receiving cart', [], { category: 'storage', xMm: 750, yMm: 250 }),
      equipment('remote-rack', 'Remote rack', [], { category: 'storage', xMm: 4800, yMm: 2800 }),
    ]
    const candidate = result({ doorConflictEvents: 4 })
    const finding = buildFindings({ baseline: result({}), candidate, candidateEquipment, candidateArchitecture: architecture })

    expect(finding.find((value) => value.ruleId === 'entry-door-conflicts')).toMatchObject({
      title: 'Keep the Crew entrance buffer clear',
      affectedItemIds: ['receiving-cart'],
    })
    expect(JSON.stringify(finding)).not.toMatch(/D2|manta|confirmed.*anchor|2400.*900/i)
  })

  it('finds equipment near an entry on an arbitrary polygon segment', () => {
    const polygonArchitecture: Architecture = {
      ...architecture,
      roomPolygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 6000, y: 1000 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }],
      openings: [{ id: 'angled-door', label: 'Angled staff entry', kind: 'door', wall: 'right', segmentIndex: 1, offsetMm: 100, widthMm: 800, flow: 'entry' }],
    }
    const candidateEquipment = [
      equipment('angled-landing', 'Angled landing', [], { category: 'landing', xMm: 5100, yMm: 300 }),
      equipment('distant-landing', 'Distant landing', [], { category: 'landing', xMm: 500, yMm: 3000 }),
    ]

    const findings = buildFindings({ baseline: result({}), candidate: result({ doorConflictEvents: 2 }), candidateEquipment, candidateArchitecture: polygonArchitecture })
    expect(findings.find((value) => value.ruleId === 'entry-door-conflicts')?.affectedItemIds).toEqual(['angled-landing'])
  })
})
