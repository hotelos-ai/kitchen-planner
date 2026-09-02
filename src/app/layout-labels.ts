import type { LayoutVariant } from '../domain/project'

export function formatLayoutTabLabel(variant: LayoutVariant, revision: number): string {
  return `${variant.name} · Rev ${revision}`
}

export function formatBaseSpaceLabel(revision: number, layoutCount: number): string {
  return `Base space · Rev ${revision} · Used by ${layoutCount} layout${layoutCount === 1 ? '' : 's'}`
}
