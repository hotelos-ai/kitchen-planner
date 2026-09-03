import { z } from 'zod'
import type { KitchenProject, LayoutVariant } from '../domain/project'
import type { ProjectStore } from '../state/project-store'

/**
 * Shared plumbing for the WebMCP tool layer: strict input parsing, JSON-safe
 * result envelopes, and store/variant resolution. Tool handlers never throw;
 * every failure is returned as a structured envelope.
 */

export type ToolEnvelope =
  | { ok: true; revision: number } & Record<string, unknown>
  | { ok: false; revision: number; code: string; message: string; details?: unknown }

export type ToolDependencies = {
  store: ProjectStore
}

export const success = (revision: number, payload: Record<string, unknown> = {}): ToolEnvelope =>
  ({ ok: true, revision, ...payload })

export const failure = (revision: number, code: string, message: string, details?: unknown): ToolEnvelope => ({
  ok: false,
  revision,
  code,
  message,
  ...(details === undefined ? {} : { details }),
})

export const currentRevision = (deps: ToolDependencies): number => deps.store.getState().revision

export type ParsedInput<T> = { ok: true; value: T } | { ok: false; revision: number; issues: unknown }

export const parseInput = <T>(deps: ToolDependencies, schema: z.ZodType<T>, input: unknown): ParsedInput<T> => {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    revision: currentRevision(deps),
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
  }
}

export const resolveVariant = (project: KitchenProject, variantId?: string): LayoutVariant | undefined =>
  project.variants.find((candidate) => candidate.id === (variantId ?? project.activeVariantId))

export const variantSummary = (project: KitchenProject) =>
  project.variants.map((variant) => ({ id: variant.id, name: variant.name, active: variant.id === project.activeVariantId }))

/** Collapses a diagnostics delta to a bounded, JSON-safe summary. */
export const diagnosticsSummary = (delta: { added: unknown[]; resolved: unknown[]; current: unknown[] }) => ({
  addedCount: delta.added.length,
  resolvedCount: delta.resolved.length,
  currentCount: delta.current.length,
  added: structuredClone(delta.added),
  resolved: structuredClone(delta.resolved),
})

export const jsonSafeSize = (value: unknown): number => JSON.stringify(value)?.length ?? 0

export const unknownErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected tool failure.'
