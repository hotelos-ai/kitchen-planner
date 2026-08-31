import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { exportProject, importProject, loadProject, saveProject } from './persistence'

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
})
