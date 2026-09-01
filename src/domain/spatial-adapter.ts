import type { SpatialDocumentAdapter, SpatialProject } from '../core/spatial/types'
import type { EquipmentItem, KitchenProject, SimulationScenario } from './project'

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
      architecture: structuredClone(source.architecture),
      variants: spatial.variants.map(({ items, ...variant }) => ({ ...structuredClone(variant), equipment: structuredClone(items) })),
      scenarios: structuredClone(spatial.scenarios),
    }
    return project
  },
  validateItem(value) {
    return isEquipmentItem(value) ? { success: true, data: structuredClone(value) } : { success: false, issues: 'Invalid equipment item' }
  },
}

export type { KitchenSpatialProject }
