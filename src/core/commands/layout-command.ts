import { z } from 'zod'

const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const idsSchema = z.array(z.string().min(1)).min(1)
const jsonObjectSchema = z.record(z.string(), z.unknown())

export const layoutCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move-items'), ids: idsSchema, anchor: pointSchema }).strict(),
  z.object({ type: z.literal('nudge-items'), ids: idsSchema, delta: pointSchema }).strict(),
  z.object({ type: z.literal('rotate-items'), ids: idsSchema, deltaDeg: z.number().finite() }).strict(),
  z.object({ type: z.literal('resize-item'), id: z.string().min(1), widthMm: z.number().positive(), depthMm: z.number().positive() }).strict(),
  z.object({ type: z.literal('set-dimensions-locked'), id: z.string().min(1), locked: z.boolean() }).strict(),
  z.object({ type: z.literal('update-item'), id: z.string().min(1), patch: jsonObjectSchema }).strict(),
  z.object({ type: z.literal('add-item'), item: jsonObjectSchema }).strict(),
  z.object({ type: z.literal('duplicate-item'), id: z.string().min(1), duplicateId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('remove-items'), ids: idsSchema }).strict(),
  z.object({ type: z.literal('set-display-unit'), unit: z.enum(['mm', 'cm', 'in', 'ft']) }).strict(),
  z.object({ type: z.literal('set-snap'), intervalMm: z.number().positive().finite() }).strict(),
  z.object({ type: z.literal('set-architecture-lock'), locked: z.boolean() }).strict(),
  z.object({ type: z.literal('create-variant'), id: z.string().min(1), name: z.string().min(1), now: z.string().datetime() }).strict(),
  z.object({ type: z.literal('activate-variant'), id: z.string().min(1) }).strict(),
  z.object({ type: z.literal('rename-variant'), id: z.string().min(1), name: z.string().min(1) }).strict(),
  z.object({ type: z.literal('remove-variant'), id: z.string().min(1) }).strict(),
])

export type LayoutCommand = z.infer<typeof layoutCommandSchema>

export const LAYOUT_COMMAND_TYPES: LayoutCommand['type'][] = [
  'move-items', 'nudge-items', 'rotate-items', 'resize-item', 'set-dimensions-locked',
  'update-item', 'add-item', 'duplicate-item', 'remove-items', 'set-display-unit',
  'set-snap', 'set-architecture-lock', 'create-variant', 'activate-variant',
  'rename-variant', 'remove-variant',
]
