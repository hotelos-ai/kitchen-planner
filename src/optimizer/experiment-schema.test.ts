import { describe, expect, it } from 'vitest'
import { optimizerManifestSchema } from './experiment-schema'

const valid = {
  id: 'experiment', documentId: 'document', revision: 1, baselineVariantId: 'base', scenarioIds: ['dinner'],
  seeds: [1, 2], confirmationSeeds: [9], permissionTier: 'A', lockedComponentIds: [], lockedArchitectureElementIds: [],
  hardRules: { minimumAisleMm: 800, noGoZones: [] }, budget: { maxEvaluations: 50, maxDurationMs: 10_000 }, priority: 'balanced',
}

describe('optimizer experiment schema', () => {
  it('strictly accepts a frozen reproducible manifest', () => {
    expect(optimizerManifestSchema.parse(valid)).toEqual(valid)
  })

  it('rejects unknown fields, repeated/overlapping seeds, and empty budgets', () => {
    expect(optimizerManifestSchema.safeParse({ ...valid, surprise: true }).success).toBe(false)
    expect(optimizerManifestSchema.safeParse({ ...valid, seeds: [1, 1] }).success).toBe(false)
    expect(optimizerManifestSchema.safeParse({ ...valid, confirmationSeeds: [2] }).success).toBe(false)
    expect(optimizerManifestSchema.safeParse({ ...valid, budget: { maxEvaluations: 0, maxDurationMs: 0 } }).success).toBe(false)
    expect(optimizerManifestSchema.safeParse({ ...valid, lockedComponentIds: ['range', 'range'] }).success).toBe(false)
    expect(optimizerManifestSchema.safeParse({ ...valid, hardRules: {
      minimumAisleMm: 800,
      noGoZones: [
        { id: 'same', xMm: 0, yMm: 0, widthMm: 100, depthMm: 100 },
        { id: 'same', xMm: 500, yMm: 500, widthMm: 100, depthMm: 100 },
      ],
    } }).success).toBe(false)
  })

  it('freezes optional body-radius and required-capacity hard rules', () => {
    const parsed = optimizerManifestSchema.parse({
      ...valid,
      hardRules: {
        minimumAisleMm: 800,
        bodyRadiusMm: 250,
        noGoZones: [],
        requiredCapacityByCapability: { 'food-prep': 2, 'dish-wash': 1 },
      },
    })
    expect(parsed.hardRules).toMatchObject({ bodyRadiusMm: 250, requiredCapacityByCapability: { 'food-prep': 2, 'dish-wash': 1 } })
    expect(optimizerManifestSchema.safeParse({
      ...valid,
      hardRules: { minimumAisleMm: 800, bodyRadiusMm: -1, noGoZones: [] },
    }).success).toBe(false)
  })
})
