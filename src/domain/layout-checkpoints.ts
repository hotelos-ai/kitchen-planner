import type { LayoutCheckpoint, LayoutVariant } from './project'

export type { LayoutCheckpoint }

export function createCheckpoint(variant: LayoutVariant, revision: number, label: string, now = () => new Date().toISOString()): LayoutCheckpoint {
  return {
    id: `rev-${revision}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    revision,
    label,
    createdAt: now(),
    architecture: structuredClone(variant.architecture),
    equipment: structuredClone(variant.equipment),
  }
}

export function restoreCheckpointOnto(variant: LayoutVariant, checkpoint: LayoutCheckpoint): LayoutVariant {
  return {
    ...variant,
    architecture: structuredClone(checkpoint.architecture),
    equipment: structuredClone(checkpoint.equipment),
    updatedAt: new Date().toISOString(),
  }
}
