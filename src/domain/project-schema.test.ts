import { describe, expect, it } from 'vitest'
import type { KitchenProject } from './project'
import { projectSchema } from './project-schema'

const validProject = {
  schemaVersion: 3,
  id: 'schema-fixture',
  name: 'Schema fixture kitchen',
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
  it('accepts zero to explicitly disable the optional minimum-aisle rule', () => {
    const candidate = structuredClone(validProject)
    Object.assign(candidate.variants[0], { layoutConstraints: { minimumAisleMm: 0 } })

    expect(projectSchema.safeParse(candidate).success).toBe(true)
  })

  it('accepts a complete metric project', () => {
    expect(projectSchema.safeParse(validProject).success).toBe(true)
  })

  it('strictly preserves arbitrary polygon wall-segment targets with named-wall fallback', () => {
    const segmented = structuredClone(validProject)
    ;(segmented.variants[0].architecture.openings as unknown[]).push({
      id: 'jagged-window',
      label: 'Jagged pass',
      kind: 'service-window',
      wall: 'top',
      segmentIndex: 2,
      offsetMm: 500,
      widthMm: 900,
    })
    const parsed = projectSchema.parse(segmented)
    expect(parsed.variants[0].architecture.openings[0]).toMatchObject({ wall: 'top', segmentIndex: 2 })

    ;(segmented.variants[0].architecture.openings[0] as unknown as { segmentIndex: number }).segmentIndex = -1
    expect(projectSchema.safeParse(segmented).success).toBe(false)
  })

  it('accepts a nonempty equipment configuration identifier', () => {
    const configured = structuredClone(validProject)
    Object.assign(configured.variants[0].equipment[0], { configurationPreset: 'hot-tandoor' })
    expect(projectSchema.safeParse(configured).success).toBe(true)
  })

  it('preserves the originating catalog identifier for editable instances', () => {
    const catalogItem = structuredClone(validProject)
    Object.assign(catalogItem.variants[0].equipment[0], { catalogId: 'hot-tandoor' })
    const parsed = projectSchema.parse(catalogItem)
    expect(parsed.variants[0].equipment[0].catalogId).toBe('hot-tandoor')
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

  it('rejects non-positive scenario role counts and reversed task duration ranges', () => {
    const invalidCount = structuredClone(validProject)
    invalidCount.scenarios[0].staff[0].count = 0
    expect(projectSchema.safeParse(invalidCount).success).toBe(false)

    const invalidDuration = structuredClone(validProject)
    Object.assign(invalidDuration.scenarios[0], { taskDurations: { 'food-prep': { minSeconds: 90, maxSeconds: 30 } } })
    expect(projectSchema.safeParse(invalidDuration).success).toBe(false)
  })

  it('accepts variant-owned architecture and reproducible layout metadata', () => {
    const enriched = structuredClone(validProject) as unknown as KitchenProject
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
        lockedArchitectureElementIds: ['room'],
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
    const adopted = structuredClone(enriched.variants[0])
    adopted.id = 'adopted-option'
    adopted.parentId = 'baseline'
    delete enriched.variants[0].adoptedExperimentManifest
    enriched.variants.push(adopted)

    expect(projectSchema.safeParse(enriched).success).toBe(true)
  })

  it('requires each layout variant to own valid architecture', () => {
    const invalid = structuredClone(validProject)
    delete (invalid.variants[0] as Partial<(typeof invalid.variants)[number]>).architecture
    expect(projectSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate IDs and broken variant-owned references', () => {
    const duplicateVariant = structuredClone(validProject)
    duplicateVariant.variants.push(structuredClone(duplicateVariant.variants[0]))
    expect(projectSchema.safeParse(duplicateVariant).success).toBe(false)

    const duplicateEquipment = structuredClone(validProject)
    duplicateEquipment.variants[0].equipment.push(structuredClone(duplicateEquipment.variants[0].equipment[0]))
    expect(projectSchema.safeParse(duplicateEquipment).success).toBe(false)

    const broken = structuredClone(validProject)
    Object.assign(broken.variants[0], {
      parentId: 'missing-parent',
      layoutConstraints: { lockedComponentIds: ['missing-component'], lockedArchitectureElementIds: ['missing-opening'] },
    })
    expect(projectSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects adopted experiment manifests with a missing or self-referencing baseline', () => {
    const missingBaseline = structuredClone(validProject) as unknown as KitchenProject
    Object.assign(missingBaseline.variants[0], {
      adoptedExperimentManifest: {
        id: 'experiment-missing-baseline',
        baselineVariantId: 'missing-layout',
        finalistId: 'fastest-service',
        createdAt: '2026-09-02T00:00:00.000Z',
        scenarioIds: ['dinner-peak'],
        seeds: [7],
        confirmationSeeds: [17],
        permissions: { placement: true, equipmentRedesign: false, architecture: false },
        budget: { maxEvaluations: 20 },
        objective: 'fastest-service',
      },
    })
    expect(projectSchema.safeParse(missingBaseline).success).toBe(false)

    const selfBaseline = structuredClone(missingBaseline)
    selfBaseline.variants[0].adoptedExperimentManifest!.baselineVariantId = selfBaseline.variants[0].id
    expect(projectSchema.safeParse(selfBaseline).success).toBe(false)
  })

  it('rejects duplicate architecture element IDs across openings, pillars, and storage zones', () => {
    const duplicateArchitectureId = structuredClone(validProject) as unknown as KitchenProject
    duplicateArchitectureId.variants[0].architecture.openings.push({
      id: 'shared-architecture-id',
      label: 'Entry',
      kind: 'door',
      wall: 'top',
      offsetMm: 500,
      widthMm: 900,
    })
    duplicateArchitectureId.variants[0].architecture.pillars.push({
      id: 'shared-architecture-id',
      xMm: 1200,
      yMm: 1200,
      widthMm: 400,
      depthMm: 400,
    })

    expect(projectSchema.safeParse(duplicateArchitectureId).success).toBe(false)
  })
})
