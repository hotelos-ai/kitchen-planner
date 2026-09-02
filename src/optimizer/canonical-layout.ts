import type { LayoutVariant } from '../domain/project'

const rounded = (value: number) => Math.round(value * 1000) / 1000
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, stable(child)]),
  )
  return typeof value === 'number' ? rounded(value) : value
}

export function canonicalLayoutSnapshot(variant: LayoutVariant): string {
  const architecture = {
    ...variant.architecture,
    openings: [...variant.architecture.openings].sort((left, right) => compareText(left.id, right.id)),
    pillars: [...variant.architecture.pillars].sort((left, right) => compareText(left.id, right.id)),
    storageZones: [...variant.architecture.storageZones].sort((left, right) => compareText(left.id, right.id)),
  }
  const layoutConstraints = variant.layoutConstraints ? {
    minimumAisleMm: variant.layoutConstraints.minimumAisleMm,
    noGoZones: [...(variant.layoutConstraints.noGoZones ?? [])].sort((left, right) => compareText(left.id, right.id)),
  } : undefined
  const physical = {
    architecture,
    layoutConstraints,
    equipment: [...variant.equipment].sort((left, right) => compareText(left.id, right.id)).map((item) => ({
      id: item.id,
      catalogId: item.catalogId,
      category: item.category,
      widthMm: item.widthMm,
      depthMm: item.depthMm,
      heightMm: item.heightMm,
      xMm: item.xMm,
      yMm: item.yMm,
      rotationDeg: item.rotationDeg,
      movable: item.movable,
      removable: item.removable,
      capabilities: [...item.capabilities].sort(),
      clearance: item.clearance,
      configurationPreset: item.configurationPreset,
    })),
  }
  return JSON.stringify(stable(physical))
}

export function canonicalLayoutHash(variant: LayoutVariant): string {
  const text = canonicalLayoutSnapshot(variant)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
