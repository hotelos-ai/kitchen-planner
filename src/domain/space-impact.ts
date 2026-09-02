import { analyzeLayout } from './layout-diagnostics'
import type { Architecture, KitchenProject } from './project'

export type LayoutSpaceImpact = {
  layoutId: string
  layoutName: string
  conflicts: string[]
}

export function previewSharedArchitectureImpact(project: KitchenProject, nextArchitecture: Architecture): LayoutSpaceImpact[] {
  return project.variants.map((variant) => {
    const issues = analyzeLayout(nextArchitecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
    return {
      layoutId: variant.id,
      layoutName: variant.name,
      conflicts: issues.map((issue) => issue.title),
    }
  })
}

export function architectureAffectsMultipleLayouts(project: KitchenProject): boolean {
  return project.variants.length > 1
}
