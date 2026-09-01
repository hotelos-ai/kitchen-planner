import type { SpatialDocumentAdapter, SpatialProject } from '../core/spatial/types'
import type { EquipmentItem, KitchenProject, SimulationScenario } from './project'
import { architectureSchema } from './project-schema'

type KitchenSpatialProject = SpatialProject<EquipmentItem, SimulationScenario>

const isEquipmentItem = (value: unknown): value is EquipmentItem => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EquipmentItem>
  return typeof item.id === 'string'
    && typeof item.label === 'string'
    && typeof item.widthMm === 'number'
    && typeof item.depthMm === 'number'
    && typeof item.heightMm === 'number'
}

export const kitchenSpatialAdapter: SpatialDocumentAdapter<KitchenProject, EquipmentItem, SimulationScenario> = {
  read(project) {
    return {
      ...structuredClone(project),
      variants: project.variants.map(({ equipment, ...variant }) => ({ ...structuredClone(variant), items: structuredClone(equipment) })),
    }
  },
  write(spatial, source) {
    const project: KitchenProject = {
      ...structuredClone(source),
      ...structuredClone(spatial),
      schemaVersion: 1,
      architecture: structuredClone(spatial.architecture) as KitchenProject['architecture'],
      variants: spatial.variants.map(({ items, ...variant }) => ({ ...structuredClone(variant), equipment: structuredClone(items) })),
      scenarios: structuredClone(spatial.scenarios),
    }
    return project
  },
  validateItem(value) {
    return isEquipmentItem(value) ? { success: true, data: structuredClone(value) } : { success: false, issues: 'Invalid equipment item' }
  },
  validateArchitecture(value) {
    const parsed = architectureSchema.safeParse(value)
    return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues }
  },
  describeCapabilities() {
    return {
      itemPresets: ['flat-top-fryer', 'six-burner-range', 'tandoor', 'upright-freezer', 'two-door-fridge', 'prep-fridge', 'double-sink', 'handwash-sink', 'pre-rinse-sink', 'dishwasher', 'open-table', 'landing-table', 'mixer', 'canopy-hood', 'generic'],
      domainCapabilities: ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep', 'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing', 'hand-wash', 'mix'],
      catalog: [
        { id: 'commercial-cooking', label: 'Commercial cooking equipment', presets: ['flat-top-fryer', 'six-burner-range', 'tandoor'] },
        { id: 'commercial-cold', label: 'Commercial refrigeration', presets: ['upright-freezer', 'two-door-fridge', 'prep-fridge'] },
        { id: 'commercial-wash', label: 'Commercial wash-up', presets: ['double-sink', 'pre-rinse-sink', 'dishwasher'] },
      ],
    }
  },
}

export type { KitchenSpatialProject }
