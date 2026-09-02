import { describe, expect, it } from 'vitest'
import { createBlankProject } from './blank-project'
import { createSeedProject } from './seed-project'
import { previewSharedArchitectureImpact } from './space-impact'

describe('shared space impact', () => {
  it('reports conflicts for every layout against the next architecture', () => {
    const project = createSeedProject()
    const candidate = structuredClone(project.variants[0])
    candidate.id = 'layout-b'
    candidate.name = 'Layout B'
    project.variants.push(candidate)
    const next = { ...project.architecture, widthMm: 2000, depthMm: 2000, roomPolygon: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }] }
    const impacts = previewSharedArchitectureImpact(project, next)
    expect(impacts).toHaveLength(2)
    expect(impacts.every((impact) => impact.conflicts.length > 0)).toBe(true)
  })

  it('returns no conflicts for an empty layout in a larger room', () => {
    const project = createBlankProject()
    const impacts = previewSharedArchitectureImpact(project, rectangularEnough())
    expect(impacts[0].conflicts).toEqual([])
  })
})

function rectangularEnough() {
  return createBlankProject().architecture
}
