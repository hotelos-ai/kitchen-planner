import { describe, expect, it } from 'vitest'
import { projectSchema } from './project-schema'

const validProject = {
  schemaVersion: 2,
  id: 'manta-raja',
  name: 'Manta Raja Kitchen Lab',
  displayUnit: 'mm',
  snapMm: 100,
  architecture: {
    widthMm: 3900,
    depthMm: 6650,
    wallHeightMm: 2800,
    roomPolygon: [{ x: 0, y: 0 }, { x: 3900, y: 0 }, { x: 3900, y: 6650 }, { x: 0, y: 6650 }],
    openings: [],
    pillars: [],
    storageZones: [],
    locked: true,
  },
  variants: [{
    id: 'baseline', name: 'Baseline', createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
    architecture: {
      widthMm: 3900,
      depthMm: 6650,
      wallHeightMm: 2800,
      roomPolygon: [{ x: 0, y: 0 }, { x: 3900, y: 0 }, { x: 3900, y: 6650 }, { x: 0, y: 6650 }],
      openings: [],
      pillars: [],
      storageZones: [],
      locked: true,
    },
    equipment: [{
      id: 'tandoor', label: 'Tandoor', category: 'cooking', widthMm: 700, depthMm: 700, heightMm: 900,
      xMm: 2400, yMm: 900, rotationDeg: 0, dimensionsLocked: true, movable: true, removable: true,
      capabilities: ['tandoor-cook'],
    }],
  }],
  scenarios: [{
    id: 'dinner-peak', name: 'Dinner peak', covers: 50, durationMinutes: 60, arrivalPattern: 'seating-wave',
    cookToOrderRatio: 0.85, seed: 20260831,
    staff: [{ role: 'head-chef', count: 1 }, { role: 'sous-chef', count: 1 }, { role: 'cdp', count: 2 }, { role: 'busser-washer', count: 1 }],
    checks: { collisions: true, doorSwings: true, dirtyCleanCrossings: true },
  }],
  activeVariantId: 'baseline',
  activeScenarioId: 'dinner-peak',
}

describe('project schema', () => {
  it('accepts a complete metric project', () => {
    expect(projectSchema.safeParse(validProject).success).toBe(true)
  })

  it('accepts a nonempty equipment configuration identifier', () => {
    const configured = structuredClone(validProject)
    Object.assign(configured.variants[0].equipment[0], { configurationPreset: 'hot-tandoor' })
    expect(projectSchema.safeParse(configured).success).toBe(true)
  })

  it('rejects an empty equipment configuration identifier', () => {
    const configured = structuredClone(validProject)
    Object.assign(configured.variants[0].equipment[0], { configurationPreset: '' })
    expect(projectSchema.safeParse(configured).success).toBe(false)
  })

  it('rejects an imported item with a negative width', () => {
    const invalid = structuredClone(validProject)
    invalid.variants[0].equipment[0].widthMm = -1
    expect(projectSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects projects without a usable layout or scenario', () => {
    expect(projectSchema.safeParse({ ...validProject, variants: [] }).success).toBe(false)
    expect(projectSchema.safeParse({ ...validProject, scenarios: [] }).success).toBe(false)
  })

  it('accepts variant-owned architecture and reproducible layout metadata', () => {
    const enriched = structuredClone(validProject)
    Object.assign(enriched.variants[0], {
      operationalProfile: {
        covers: 80,
        peakDurationMinutes: 90,
        arrivalPattern: 'two-waves',
        serviceStyle: 'sharing plates',
        menuAssumptions: ['fried starters', 'tandoor mains'],
        staff: [{ role: 'head-chef', count: 1 }, { role: 'cdp', count: 3 }],
        targetCapacityPerHour: 60,
      },
      layoutConstraints: {
        lockedComponentIds: ['tandoor'],
        lockedArchitectureElementIds: ['pillar'],
        minimumAisleMm: 1100,
        permissions: { placement: true, equipmentRedesign: false, architecture: false },
        noGoZones: [{ id: 'gas-riser', xMm: 300, yMm: 400, widthMm: 500, depthMm: 600 }],
      },
      adoptedExperimentManifest: {
        id: 'experiment-1',
        baselineVariantId: 'baseline',
        finalistId: 'least-travel',
        createdAt: '2026-09-02T00:00:00.000Z',
        scenarioIds: ['dinner-peak'],
        seeds: [7, 11],
        confirmationSeeds: [17],
        permissions: { placement: true, equipmentRedesign: false, architecture: false },
        budget: { maxDurationMs: 30000, maxEvaluations: 400 },
        objective: 'least-travel',
        resultHash: 'sha256:abc',
        resultMetrics: { travelDistanceMm: 12345 },
      },
    })
    Object.assign(enriched.variants[0].equipment[0], { appearanceSkinId: 'stainless-brushed' })

    expect(projectSchema.safeParse(enriched).success).toBe(true)
  })

  it('requires each layout variant to own valid architecture', () => {
    const invalid = structuredClone(validProject)
    delete (invalid.variants[0] as Partial<(typeof invalid.variants)[number]>).architecture
    expect(projectSchema.safeParse(invalid).success).toBe(false)
  })
})
