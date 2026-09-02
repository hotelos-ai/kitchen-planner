import { z } from 'zod'

export const CATALOG_DRAG_MIME = 'application/x-kitchen-planner-catalog'

const catalogDragPayloadSchema = z.object({
  catalogId: z.string().min(1).max(128),
  dimensions: z.object({
    widthMm: z.number().finite().positive(),
    depthMm: z.number().finite().positive(),
    heightMm: z.number().finite().positive(),
  }).strict(),
  placement: z.literal('preferred-point'),
}).strict()

export type CatalogDragPayload = z.infer<typeof catalogDragPayloadSchema>

export function parseCatalogDragPayload(value: string): CatalogDragPayload | null {
  try {
    const parsed = catalogDragPayloadSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
