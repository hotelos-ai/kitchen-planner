import { describe, expect, it } from 'vitest'
import { createBlankProject, lShapedArchitecture, rectangularArchitecture, uShapedArchitecture } from './blank-project'

describe('blank project', () => {
  it('creates a rectangular starter kitchen with a shared space and Layout A', () => {
    const project = createBlankProject('Harbour kitchen')
    expect(project.name).toBe('Harbour kitchen')
    expect(project.variants).toHaveLength(1)
    expect(project.variants[0].name).toBe('Layout A')
    expect(project.variants[0].equipment).toEqual([])
    expect(project.architecture.widthMm).toBe(6200)
    expect(project.architecture.depthMm).toBe(4800)
  })

  it('builds rectangle, L, and U room polygons', () => {
    expect(rectangularArchitecture(4000, 3000).roomPolygon).toHaveLength(4)
    expect(lShapedArchitecture(4000, 3000).roomPolygon).toHaveLength(6)
    expect(uShapedArchitecture(4000, 3000).roomPolygon.length).toBeGreaterThan(4)
  })
})
