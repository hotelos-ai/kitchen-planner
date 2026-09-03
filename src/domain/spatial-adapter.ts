import type { SpatialDocumentAdapter, SpatialProject } from '../core/spatial/types'
import type { EquipmentItem, KitchenProject, SimulationScenario } from './project'
import { architectureSchema, equipmentSchema } from './project-schema'

type KitchenSpatialProject = SpatialProject<EquipmentItem, SimulationScenario>

export const kitchenSpatialAdapter: SpatialDocumentAdapter<KitchenProject, EquipmentItem, SimulationScenario> = {
  read(project) {
    return {
      ...structuredClone(project),
      architecture: structuredClone(project.architecture),
      variants: project.variants.map(({ equipment, ...variant }) => ({ ...structuredClone(variant), items: structuredClone(equipment) })),
    }
  },
  write(spatial, source) {
    const activeVariantChanged = spatial.activeVariantId !== source.activeVariantId
    const activeArchitectureChanged = !activeVariantChanged
      && JSON.stringify(spatial.architecture) !== JSON.stringify(source.architecture)
    const variants = spatial.variants.map(({ items, ...variant }) => ({
      ...structuredClone(variant),
      architecture: structuredClone(
        variant.id === spatial.activeVariantId && activeArchitectureChanged
          ? spatial.architecture
          : variant.architecture,
      ) as KitchenProject['architecture'],
      equipment: structuredClone(items),
    }))
    const activeArchitecture = variants.find((variant) => variant.id === spatial.activeVariantId)?.architecture
      ?? spatial.architecture
    const project: KitchenProject = {
      ...structuredClone(source),
      ...structuredClone(spatial),
      schemaVersion: 4,
      architecture: structuredClone(activeArchitecture) as KitchenProject['architecture'],
      variants,
      scenarios: structuredClone(spatial.scenarios),
    }
    return project
  },
  validateItem(value) {
    const parsed = equipmentSchema.safeParse(value)
    return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues }
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
