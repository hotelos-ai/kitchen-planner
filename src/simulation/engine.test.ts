import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { runSimulation } from './engine'

describe('simulation engine', () => {
  it('returns identical results for identical inputs and seed', () => {
    const project = createSeedProject()
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const first = runSimulation(input)
    const second = runSimulation(structuredClone(input))
    expect(second.metrics).toEqual(first.metrics)
    expect(second.events).toEqual(first.events)
  })

  it('completes the default run with per-second frames and all five staff', () => {
    const project = createSeedProject()
    const result = runSimulation({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    expect(result.frames.length).toBeGreaterThanOrEqual(3600)
    expect(result.frames[0].agents).toHaveLength(5)
    expect(result.metrics.completedOrders).toBeGreaterThan(0)
  })
})
