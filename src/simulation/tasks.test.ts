import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createRng } from './rng'
import { bindServiceTaskStations, generateServiceTaskDemand, generateServiceTasks } from './tasks'

describe('service task generation', () => {
  it('creates cook-to-order and dirty-dish chains for the default wave', () => {
    const project = createSeedProject()
    const tasks = generateServiceTasks(project.scenarios[0], project.variants[0].equipment, createRng(20260831))
    expect(tasks.some((task) => task.capability === 'tandoor-cook')).toBe(true)
    expect(tasks.some((task) => task.capability === 'dish-pre-rinse')).toBe(true)
    expect(tasks.filter((task) => task.orderId).length).toBeGreaterThan(50)
  })

  it('uses configurable station duration ranges', () => {
    const project = createSeedProject()
    project.scenarios[0].taskDurations = { 'tandoor-cook': { minSeconds: 42, maxSeconds: 42 } }
    const tasks = generateServiceTasks(project.scenarios[0], project.variants[0].equipment, createRng(20260831))
    expect(tasks.find((task) => task.capability === 'tandoor-cook')?.durationSeconds).toBe(42)
  })

  it('creates deterministic demand independently from station inventory and ordering', () => {
    const project = createSeedProject()
    const first = generateServiceTaskDemand(project.scenarios[0], createRng(77))
    const second = generateServiceTaskDemand(project.scenarios[0], createRng(77))
    expect(second).toEqual(first)

    const stations = project.variants[0].equipment.filter((item) => item.capabilities.includes('food-prep')).reverse()
    const bound = bindServiceTaskStations(first, [...project.variants[0].equipment.filter((item) => !item.capabilities.includes('food-prep')), ...stations])
    expect(bound.find((task) => task.capability === 'food-prep')?.stationIds).toEqual([...stations.map((station) => station.id)].sort())
  })

  it('binds every compatible station instead of selecting one during demand generation', () => {
    const project = createSeedProject()
    const tasks = generateServiceTasks(project.scenarios[0], project.variants[0].equipment, createRng(20260831))
    expect(tasks.find((task) => task.capability === 'food-prep')?.stationIds).toEqual(expect.arrayContaining([
      'fridge-clean-prep', 'prep-fridge-counter', 'working-table',
    ]))
  })

  it('does not silently normalize invalid configured duration ranges', () => {
    const project = createSeedProject()
    project.scenarios[0].taskDurations = { 'food-prep': { minSeconds: 90, maxSeconds: 30 } }
    expect(() => generateServiceTaskDemand(project.scenarios[0], createRng(1))).toThrow(/duration range/i)
  })
})
