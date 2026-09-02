import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { runSimulation } from './engine'

describe('metrics-only simulation output', () => {
  it.each([
    { seed: 20260902, arrivalPattern: 'seating-wave' as const },
    { seed: 48151623, arrivalPattern: 'steady' as const },
  ])('matches full aggregate metrics and warnings exactly for seed $seed', ({ seed, arrivalPattern }) => {
    const project = createSeedProject()
    const variant = project.variants[0]
    const scenario = {
      ...project.scenarios[0],
      seed,
      arrivalPattern,
      covers: 18,
      durationMinutes: 30,
    }
    const snapshot = {
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
    }

    const full = runSimulation({ ...snapshot, outputMode: 'full' })
    const metricsOnly = runSimulation({ ...snapshot, outputMode: 'metrics-only' })

    expect(metricsOnly.metrics).toEqual(full.metrics)
    expect(metricsOnly.warnings).toEqual(full.warnings)
    expect(metricsOnly.seed).toBe(full.seed)
    expect(metricsOnly.durationSeconds).toBe(full.durationSeconds)
    expect('frames' in metricsOnly).toBe(false)
    expect('events' in metricsOnly).toBe(false)
    expect('taskTimeline' in metricsOnly).toBe(false)
    expect('orders' in metricsOnly).toBe(false)
    expect(full.frames.length).toBeGreaterThan(0)
  })
})
