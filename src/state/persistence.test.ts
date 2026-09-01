import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { CURRENT_PROJECT_KEY, exportProject, importProject, loadProject, saveProject } from './persistence'

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

  it('falls back to the last good snapshot when current JSON is corrupt', () => {
    const project = createSeedProject()
    const storage = memoryStorage({
      'manta-raja:project:v1': '{broken',
      'manta-raja:project:last-good:v1': JSON.stringify(project),
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
    delete architecture.wallHeightMm
    const migrated = importProject(JSON.stringify(legacy))
    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.architecture.wallHeightMm).toBe(2800)
    expect(() => importProject('{"schemaVersion":99}')).toThrow(/unsupported future schema version 99/i)
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
