import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import {
  CURRENT_PROJECT_KEY,
  LAST_GOOD_PROJECT_KEY,
  LEGACY_CURRENT_PROJECT_KEY,
  LEGACY_LAST_GOOD_PROJECT_KEY,
  exportProject,
  importProject,
  loadProject,
  saveProject,
} from './persistence'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('project persistence', () => {
  it('round-trips a validated project through export and import', () => {
    const project = createSeedProject()
    expect(importProject(exportProject(project))).toEqual(project)
  })

  it('round-trips multiple layouts with independent architecture and planning metadata', () => {
    const project = createSeedProject()
    const alternative = structuredClone(project.variants[0])
    alternative.id = 'courtyard-option'
    alternative.name = 'Courtyard option'
    alternative.parentId = project.variants[0].id
    alternative.architecture.widthMm = 5200
    alternative.architecture.roomPolygon = [{ x: 0, y: 0 }, { x: 5200, y: 0 }, { x: 5200, y: 6650 }, { x: 0, y: 6650 }]
    alternative.equipment[0].appearanceSkinId = 'blackened-steel'
    alternative.operationalProfile = { covers: 72, arrivalPattern: 'steady', staff: [{ role: 'head-chef', count: 1 }] }
    alternative.layoutConstraints = { lockedComponentIds: ['tandoor'], minimumAisleMm: 1000 }
    alternative.adoptedExperimentManifest = {
      id: 'run-1', baselineVariantId: project.variants[0].id, finalistId: 'fastest-service',
      createdAt: '2026-09-02T00:00:00.000Z', scenarioIds: ['dinner-peak'], seeds: [3],
      confirmationSeeds: [13], permissions: { placement: true, equipmentRedesign: false, architecture: false },
      budget: { maxEvaluations: 100 }, objective: 'fastest-service', resultMetrics: { throughput: 42 },
    }
    project.variants.push(alternative)
    project.activeVariantId = alternative.id
    project.architecture = structuredClone(alternative.architecture)
    const secondScenario = structuredClone(project.scenarios[0])
    secondScenario.id = 'lunch-steady'
    secondScenario.name = 'Lunch steady'
    secondScenario.covers = 48
    secondScenario.arrivalPattern = 'steady'
    secondScenario.seed = 41
    secondScenario.stationCapacities = { tandoor: 3 }
    project.scenarios.push(secondScenario)
    project.activeScenarioId = secondScenario.id
    project.displayUnit = 'cm'
    project.snapMm = 25

    const exported = exportProject(project)
    const decoded = JSON.parse(exported)
    expect(decoded).toMatchObject({
      schemaVersion: 2,
      activeVariantId: 'courtyard-option',
      activeScenarioId: 'lunch-steady',
      displayUnit: 'cm',
      snapMm: 25,
    })
    expect(decoded.variants[1]).toMatchObject({
      id: 'courtyard-option',
      parentId: project.variants[0].id,
      architecture: { widthMm: 5200 },
      operationalProfile: { covers: 72 },
      layoutConstraints: { lockedComponentIds: ['tandoor'], minimumAisleMm: 1000 },
      adoptedExperimentManifest: { id: 'run-1', finalistId: 'fastest-service' },
    })
    expect(decoded.variants[1].equipment).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: project.variants[0].equipment[0].id, appearanceSkinId: 'blackened-steel' }),
    ]))
    expect(decoded.scenarios).toHaveLength(2)
    expect(importProject(exported)).toEqual(project)
  })

  it('falls back to the last good snapshot when current JSON is corrupt', () => {
    const project = createSeedProject()
    const storage = memoryStorage({
      [CURRENT_PROJECT_KEY]: '{broken',
      [LAST_GOOD_PROJECT_KEY]: JSON.stringify(project),
    })
    expect(loadProject(storage)).toEqual(project)
  })

  it('starts from the seed when nothing recoverable exists', () => {
    expect(loadProject(memoryStorage()).id).toBe('manta-raja-kitchen-lab')
  })

  it('rejects malformed imports and saves only valid projects', () => {
    expect(() => importProject('{"schemaVersion":1}')).toThrow(/valid kitchen project/i)
    const storage = memoryStorage()
    saveProject(storage, createSeedProject())
    expect(storage.length).toBe(2)
  })

  it('migrates the supported legacy project version and rejects future versions clearly', () => {
    const legacy = structuredClone(createSeedProject()) as unknown as Record<string, unknown>
    legacy.schemaVersion = 0
    const architecture = legacy.architecture as Record<string, unknown>
    const variants = legacy.variants as Array<Record<string, unknown>>
    delete architecture.wallHeightMm
    variants.forEach((variant) => { delete variant.architecture })
    const migrated = importProject(JSON.stringify(legacy))
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.architecture.wallHeightMm).toBe(2800)
    expect(migrated.variants[0].architecture).toEqual(migrated.architecture)
    expect(() => importProject('{"schemaVersion":99}')).toThrow(/unsupported future schema version 99/i)
  })

  it('migrates v1 global architecture into independent variant-owned copies', () => {
    const current = createSeedProject()
    const legacy = structuredClone(current) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    const variants = legacy.variants as Array<Record<string, unknown>>
    variants.push({ ...structuredClone(variants[0]), id: 'legacy-option', name: 'Legacy option' })
    variants.forEach((variant) => { delete variant.architecture })

    const migrated = importProject(JSON.stringify(legacy))

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.variants).toHaveLength(2)
    expect(migrated.variants[0].architecture).toEqual(migrated.architecture)
    expect(migrated.variants[1].architecture).toEqual(migrated.architecture)
    expect(migrated.variants[0].architecture).not.toBe(migrated.variants[1].architecture)
  })

  it('strictly rejects unknown fields in current projects at every persisted boundary', () => {
    const project = createSeedProject() as unknown as Record<string, unknown>
    project.transientPreviewToken = 'must-not-leak'
    expect(() => exportProject(project as never)).toThrow(/invalid kitchen project/i)

    const nested = structuredClone(createSeedProject()) as unknown as Record<string, unknown>
    const variants = nested.variants as Array<Record<string, unknown>>
    const equipment = variants[0].equipment as Array<Record<string, unknown>>
    equipment[0].unknownPhysicalField = true
    expect(() => importProject(JSON.stringify(nested))).toThrow(/not a valid kitchen project/i)
  })

  it('reads legacy Manta storage keys only as fallback and saves generic product keys', () => {
    const project = createSeedProject()
    const legacyStorage = memoryStorage({ [LEGACY_CURRENT_PROJECT_KEY]: JSON.stringify(project) })
    expect(loadProject(legacyStorage)).toEqual(project)

    const storage = memoryStorage({ [LEGACY_LAST_GOOD_PROJECT_KEY]: JSON.stringify(project) })
    saveProject(storage, project)
    expect(storage.getItem(CURRENT_PROJECT_KEY)).toBeTruthy()
    expect(storage.getItem(LAST_GOOD_PROJECT_KEY)).toBeTruthy()
    expect(CURRENT_PROJECT_KEY).toMatch(/^kitchen-planner:/)
    expect(LAST_GOOD_PROJECT_KEY).toMatch(/^kitchen-planner:/)
  })

  it('restores presentation presets in schema-valid projects saved before equipment skins existed', () => {
    const legacyPresentation = createSeedProject()
    legacyPresentation.variants.forEach((variant) => variant.equipment.forEach((item) => {
      delete item.visualPreset
      delete item.configurationPreset
    }))
    legacyPresentation.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm = 2150
    const storage = memoryStorage({ [CURRENT_PROJECT_KEY]: JSON.stringify(legacyPresentation) })

    const loaded = loadProject(storage)

    expect(loaded.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({
      xMm: 2150,
      visualPreset: 'tandoor',
      configurationPreset: 'hot-tandoor',
    })
    expect(new Set(loaded.variants[0].equipment.map((item) => item.visualPreset)).size).toBeGreaterThan(8)
  })

  it('preserves explicit visual and configuration presets', () => {
    const project = createSeedProject()
    const item = project.variants[0].equipment[0]
    item.visualPreset = 'custom-studio-model'
    item.configurationPreset = 'custom-family-model'

    expect(importProject(JSON.stringify(project)).variants[0].equipment[0]).toMatchObject({
      visualPreset: 'custom-studio-model',
      configurationPreset: 'custom-family-model',
    })
  })

  it('uses the generic visual for unknown custom legacy equipment', () => {
    const project = createSeedProject()
    const custom = project.variants[0].equipment[0]
    Object.assign(custom, {
      id: 'custom-unknown',
      category: 'custom',
      capabilities: [],
      visualPreset: undefined,
      configurationPreset: undefined,
    })

    expect(importProject(JSON.stringify(project)).variants[0].equipment[0]).toMatchObject({
      visualPreset: 'generic',
    })
  })
})
