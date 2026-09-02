import { z } from 'zod'

const stableIdSchema = z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9-]*$/)
const colourSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const appearanceSkinSchema = z.object({
  skinId: stableIdSchema,
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  finish: z.enum(['brushed', 'polished', 'matte', 'satin', 'enamel', 'powder-coated', 'galvanized', 'wood-grain']),
  material: z.enum(['stainless-steel', 'mild-steel', 'galvanized-steel', 'aluminium', 'enamelled-steel', 'timber']),
  colorHex: colourSchema,
  roughness: z.number().finite().min(0).max(1),
  metalness: z.number().finite().min(0).max(1),
  wear: z.enum(['new', 'light', 'working', 'aged']),
  branding: z.object({ label: z.string().trim().min(1).max(80), colorHex: colourSchema }).strict().optional(),
}).strict()

export type AppearanceSkin = z.infer<typeof appearanceSkinSchema>

const rawAppearanceSkins = [
  { skinId: 'stainless-brushed', displayName: 'Brushed stainless', description: 'Neutral commercial brushed stainless steel.', finish: 'brushed', material: 'stainless-steel', colorHex: '#b8bec0', roughness: 0.42, metalness: 0.9, wear: 'working' },
  { skinId: 'stainless-polished', displayName: 'Polished stainless', description: 'Bright polished stainless steel for presentation equipment.', finish: 'polished', material: 'stainless-steel', colorHex: '#d8dcdd', roughness: 0.18, metalness: 0.95, wear: 'new' },
  { skinId: 'stainless-matte', displayName: 'Matte stainless', description: 'Low-glare satin stainless steel.', finish: 'matte', material: 'stainless-steel', colorHex: '#aeb5b6', roughness: 0.58, metalness: 0.82, wear: 'light' },
  { skinId: 'powder-black', displayName: 'Black powder coat', description: 'Durable charcoal-black powder-coated steel.', finish: 'powder-coated', material: 'mild-steel', colorHex: '#252a2b', roughness: 0.66, metalness: 0.35, wear: 'light' },
  { skinId: 'powder-white', displayName: 'White powder coat', description: 'Clean warm-white powder-coated steel.', finish: 'powder-coated', material: 'mild-steel', colorHex: '#eeeae0', roughness: 0.62, metalness: 0.25, wear: 'new' },
  { skinId: 'enamel-red', displayName: 'Signal red enamel', description: 'Warm red enamelled steel accent finish.', finish: 'enamel', material: 'enamelled-steel', colorHex: '#a83f32', roughness: 0.32, metalness: 0.25, wear: 'light' },
  { skinId: 'enamel-blue', displayName: 'Deep blue enamel', description: 'Deep blue enamelled steel accent finish.', finish: 'enamel', material: 'enamelled-steel', colorHex: '#315b73', roughness: 0.34, metalness: 0.25, wear: 'light' },
  { skinId: 'galvanized', displayName: 'Galvanized steel', description: 'Utility-grade galvanized steel surface.', finish: 'galvanized', material: 'galvanized-steel', colorHex: '#aeb6b2', roughness: 0.72, metalness: 0.78, wear: 'working' },
  { skinId: 'blackened-steel', displayName: 'Blackened steel', description: 'Dark satin blackened steel presentation finish.', finish: 'satin', material: 'mild-steel', colorHex: '#343735', roughness: 0.48, metalness: 0.72, wear: 'working' },
  { skinId: 'wood-maple', displayName: 'Maple worktop', description: 'Light maple visual finish for dry service furniture.', finish: 'wood-grain', material: 'timber', colorHex: '#caa979', roughness: 0.7, metalness: 0, wear: 'light' },
  { skinId: 'powder-coat-blue', displayName: 'Blue powder coat', description: 'Durable deep-blue powder-coated steel.', finish: 'powder-coated', material: 'mild-steel', colorHex: '#315b73', roughness: 0.56, metalness: 0.3, wear: 'light' },
  { skinId: 'stainless-worn', displayName: 'Working stainless', description: 'Brushed stainless with a visibly worked commercial finish.', finish: 'brushed', material: 'stainless-steel', colorHex: '#9fa6a5', roughness: 0.62, metalness: 0.76, wear: 'aged' },
] satisfies AppearanceSkin[]

export const APPEARANCE_SKINS: readonly AppearanceSkin[] = Object.freeze(
  appearanceSkinSchema.array().parse(rawAppearanceSkins).map((skin) => Object.freeze(skin)),
)
