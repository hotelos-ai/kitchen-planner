import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { resolveSceneArchitecture } from './KitchenScene'

describe('3D scene variant architecture', () => {
  it('uses the active layout architecture rather than the compatibility mirror', () => {
    const project = createSeedProject()
    project.architecture.wallHeightMm = 2100
    project.variants[0].architecture.wallHeightMm = 4700

    expect(resolveSceneArchitecture(project.variants[0])).toBe(project.variants[0].architecture)
    expect(resolveSceneArchitecture(project.variants[0]).wallHeightMm).toBe(4700)
  })
})
