import type { KitchenProject } from '../domain/project'
import { projectSchema } from '../domain/project-schema'
import { createSeedProject } from '../domain/seed-project'

export const CURRENT_PROJECT_KEY = 'manta-raja:project:v1'
export const LAST_GOOD_PROJECT_KEY = 'manta-raja:project:last-good:v1'

function migrate(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== 0) return value
  const migrated = structuredClone(source)
  migrated.schemaVersion = 1
  if (migrated.architecture && typeof migrated.architecture === 'object') {
    const architecture = migrated.architecture as Record<string, unknown>
    architecture.wallHeightMm ??= 2800
    architecture.locked ??= true
  }
  return migrated
}

function validated(value: unknown): KitchenProject | null {
  const result = projectSchema.safeParse(migrate(value))
  return result.success ? result.data : null
}

function parseStored(value: string | null): KitchenProject | null {
  if (!value) return null
  try {
    return validated(JSON.parse(value))
  } catch {
    return null
  }
}

export function loadProject(storage: Storage): KitchenProject {
  return parseStored(storage.getItem(CURRENT_PROJECT_KEY))
    ?? parseStored(storage.getItem(LAST_GOOD_PROJECT_KEY))
    ?? createSeedProject()
}

export function saveProject(storage: Storage, project: KitchenProject): void {
  const parsed = projectSchema.safeParse(project)
  if (!parsed.success) throw new Error('Cannot save an invalid kitchen project')
  const json = JSON.stringify(parsed.data)
  storage.setItem(CURRENT_PROJECT_KEY, json)
  storage.setItem(LAST_GOOD_PROJECT_KEY, json)
}

export function exportProject(project: KitchenProject): string {
  const parsed = projectSchema.safeParse(project)
  if (!parsed.success) throw new Error('Cannot export an invalid kitchen project')
  return JSON.stringify(parsed.data, null, 2)
}

export function importProject(json: string): KitchenProject {
  let candidate: unknown
  try {
    candidate = JSON.parse(json)
  } catch {
    throw new Error('Import is not valid JSON')
  }
  if (candidate && typeof candidate === 'object') {
    const version = (candidate as Record<string, unknown>).schemaVersion
    if (typeof version === 'number' && version > 1) throw new Error(`Unsupported future schema version ${version}`)
  }
  const parsed = projectSchema.safeParse(migrate(candidate))
  if (!parsed.success) throw new Error('Import is not a valid kitchen project')
  return parsed.data
}
