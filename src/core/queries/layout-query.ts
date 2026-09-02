import { z } from 'zod'
import { WORKSPACE_OPERATION_TYPES } from '../workspace/workspace-operation'
import type { ProjectEnvelope, SpatialDocumentAdapter, SpatialItem } from '../spatial/types'

export const layoutQuerySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project-snapshot') }).strict(),
  z.object({ type: z.literal('active-layout') }).strict(),
  z.object({ type: z.literal('list-items'), category: z.string().optional(), tag: z.string().optional() }).strict(),
  z.object({ type: z.literal('item'), id: z.string().min(1) }).strict(),
  z.object({ type: z.literal('architecture') }).strict(),
  z.object({ type: z.literal('available-zones') }).strict(),
  z.object({ type: z.literal('diagnostics') }).strict(),
  z.object({ type: z.literal('capabilities') }).strict(),
])

export type LayoutQuery = z.infer<typeof layoutQuerySchema>
export type LayoutQueryResult =
  | { ok: true; revision: number; data: unknown }
  | { ok: false; revision: number; code: 'invalid-query' | 'missing-item'; message: string; issues?: unknown }

export function executeLayoutQuery<TProject, TItem extends SpatialItem, TScenario>(
  envelope: ProjectEnvelope<TProject>,
  adapter: SpatialDocumentAdapter<TProject, TItem, TScenario>,
  query: unknown,
  diagnose?: (project: TProject) => unknown,
): LayoutQueryResult {
  const parsed = layoutQuerySchema.safeParse(query)
  if (!parsed.success) return { ok: false, revision: envelope.revision, code: 'invalid-query', message: 'Query payload is invalid.', issues: parsed.error.issues }
  const project = adapter.read(envelope.project)
  const variant = project.variants.find((candidate) => candidate.id === project.activeVariantId)
  const clone = <T,>(value: T): T => structuredClone(value)

  switch (parsed.data.type) {
    case 'project-snapshot': return { ok: true, revision: envelope.revision, data: clone(project) }
    case 'active-layout': return { ok: true, revision: envelope.revision, data: clone(variant ?? null) }
    case 'architecture': return { ok: true, revision: envelope.revision, data: clone(variant?.architecture ?? project.architecture) }
    case 'available-zones': return { ok: true, revision: envelope.revision, data: clone((variant?.architecture ?? project.architecture).storageZones) }
    case 'diagnostics': return { ok: true, revision: envelope.revision, data: clone(diagnose?.(envelope.project) ?? []) }
    case 'capabilities': return {
      ok: true, revision: envelope.revision,
      data: { commands: [...WORKSPACE_OPERATION_TYPES], queries: ['project-snapshot', 'active-layout', 'list-items', 'item', 'architecture', 'available-zones', 'diagnostics', 'capabilities'], units: ['mm', 'cm', 'in', 'ft'], ...(adapter.describeCapabilities?.() ?? {}) },
    }
    case 'list-items': {
      const { category, tag } = parsed.data
      const items = (variant?.items ?? []).filter((item) => {
        const record = item as TItem & { category?: string; tags?: readonly string[] }
        return (!category || record.category === category) && (!tag || record.tags?.includes(tag))
      })
      return { ok: true, revision: envelope.revision, data: clone(items) }
    }
    case 'item': {
      const id = parsed.data.id
      const item = variant?.items.find((candidate) => candidate.id === id)
      return item
        ? { ok: true, revision: envelope.revision, data: clone(item) }
        : { ok: false, revision: envelope.revision, code: 'missing-item', message: `Item ${id} does not exist.` }
    }
  }
}
