import type { KitchenProject } from '../domain/project'
import { EQUIPMENT_CONFIGURATIONS, inferEquipmentConfiguration } from '../domain/equipment-configurations'
import { projectSchema } from '../domain/project-schema'
import { createSeedProject } from '../domain/seed-project'

export const CURRENT_PROJECT_KEY = 'kitchen-planner:project:v2'
export const LAST_GOOD_PROJECT_KEY = 'kitchen-planner:project:last-good:v2'
export const LEGACY_CURRENT_PROJECT_KEY = 'manta-raja:project:v1'
export const LEGACY_LAST_GOOD_PROJECT_KEY = 'manta-raja:project:last-good:v1'

function migrate(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== 0 && source.schemaVersion !== 1 && source.schemaVersion !== 2 && source.schemaVersion !== 3) return value
  const migrated = structuredClone(source)
  if (migrated.schemaVersion === 0 && migrated.architecture && typeof migrated.architecture === 'object') {
    const architecture = migrated.architecture as Record<string, unknown>
    architecture.wallHeightMm ??= 2800
    architecture.locked ??= true
  }
  if (migrated.schemaVersion !== 3 && migrated.architecture && typeof migrated.architecture === 'object' && Array.isArray(migrated.variants)) {
    migrated.variants = migrated.variants.map((value) => {
      if (!value || typeof value !== 'object') return value
      const variant = structuredClone(value as Record<string, unknown>)
      variant.architecture ??= structuredClone(migrated.architecture)
      return variant
    })
  }
  if (migrated.schemaVersion !== 3) {
    migrated.schemaVersion = 2
    // v2 → v3: drag-resize became the default editing affordance, so dimensions persisted
    // under the old lock-by-default seed are unlocked once during this one-time migration.
    if (Array.isArray(migrated.variants)) {
      migrated.variants = migrated.variants.map((value) => {
        if (!value || typeof value !== 'object') return value
        const variant = structuredClone(value as Record<string, unknown>)
        if (Array.isArray(variant.equipment)) {
          variant.equipment = variant.equipment.map((item) => (item && typeof item === 'object' ? { ...item, dimensionsLocked: false } : item))
        }
        return variant
      })
    }
    migrated.schemaVersion = 3
  }
  // v3 → v4 only introduces optional scenario menu data. Leaving it absent is
  // meaningful: legacy scenarios continue through the exact original task model.
  migrated.schemaVersion = 4
  return migrated
}

function validated(value: unknown): KitchenProject | null {
  const result = projectSchema.safeParse(migrate(value))
  return result.success ? hydrateEquipmentPresentation(result.data) : null
}

export function hydrateEquipmentPresentation(project: KitchenProject): KitchenProject {
  const hydrated = structuredClone(project)
  hydrated.variants.forEach((variant) => variant.equipment.forEach((item) => {
    const inferred = inferEquipmentConfiguration(item)
    const configuration = inferred
      ? EQUIPMENT_CONFIGURATIONS.find((value) => value.id === inferred)
      : undefined
    item.configurationPreset ??= inferred
    item.visualPreset ??= configuration?.visualPreset ?? 'generic'
    item.appearanceSkinId ??= `${item.visualPreset}-default`
  }))
  const activeArchitecture = hydrated.variants.find((variant) => variant.id === hydrated.activeVariantId)?.architecture
  if (activeArchitecture) hydrated.architecture = structuredClone(activeArchitecture)
  return hydrated
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
    ?? parseStored(storage.getItem(LEGACY_CURRENT_PROJECT_KEY))
    ?? parseStored(storage.getItem(LEGACY_LAST_GOOD_PROJECT_KEY))
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
  const candidate = structuredClone(project)
  const activeArchitecture = candidate.variants.find((variant) => variant.id === candidate.activeVariantId)?.architecture
  if (activeArchitecture) candidate.architecture = structuredClone(activeArchitecture)
  const parsed = projectSchema.safeParse(candidate)
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
    if (typeof version === 'number' && version > 4) throw new Error(`Unsupported future schema version ${version}`)
  }
  const project = validated(candidate)
  if (!project) throw new Error('Import is not a valid kitchen project')
  return project
}
