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

  it('keeps the legacy demand and RNG stream unchanged when menuItems is absent or empty', () => {
    const project = createSeedProject()
    const absent = generateServiceTaskDemand(project.scenarios[0], createRng(20260831))
    const empty = generateServiceTaskDemand({ ...project.scenarios[0], menuItems: [] }, createRng(20260831))

    expect(empty).toEqual(absent)
    expect(absent.slice(0, 5).map((task) => ({ id: task.id, capability: task.capability, durationSeconds: task.durationSeconds }))).toEqual([
      { id: 'order-1-0-retrieve', capability: 'cold-retrieval', durationSeconds: 21 },
      { id: 'order-1-1-prep', capability: 'food-prep', durationSeconds: 116 },
      { id: 'order-1-2-cook', capability: 'flat-top-cook', durationSeconds: 292 },
      { id: 'order-1-3-finish', capability: 'finish-plate', durationSeconds: 45 },
      { id: 'order-1-4-pass', capability: 'clean-window', durationSeconds: 13 },
    ])
  })

  it('uses a deterministic share-weighted menu choice and each selected item task chain', () => {
    const project = createSeedProject()
    const scenario = {
      ...project.scenarios[0],
      covers: 12,
      menuItems: [
        {
          id: 'salad', name: 'Salad', sharePct: 75, source: 'user-provided' as const,
          steps: [{ label: 'Assemble', capability: 'food-prep' as const, activeSeconds: 30 }],
        },
        {
          id: 'curry', name: 'Curry', sharePct: 25, source: 'imported' as const,
          steps: [
            { label: 'Prepare', capability: 'food-prep' as const, activeSeconds: 45 },
            { label: 'Simmer', capability: 'range-cook' as const, activeSeconds: 15, passiveSeconds: { minSeconds: 120, maxSeconds: 120 } },
          ],
        },
      ],
    }

    const first = generateServiceTaskDemand(scenario, createRng(77))
    const second = generateServiceTaskDemand(scenario, createRng(77))
    const orderTasks = first.filter((task) => task.orderId)

    expect(second).toEqual(first)
    expect(orderTasks.map((task) => task.id)).toEqual([
      'order-1-salad-0-assemble',
      'order-2-salad-0-assemble',
      'order-3-curry-0-prepare',
      'order-3-curry-1-simmer',
      'order-4-salad-0-assemble',
      'order-5-curry-0-prepare',
      'order-5-curry-1-simmer',
      'order-6-salad-0-assemble',
    ])
    expect(orderTasks.find((task) => task.id.endsWith('simmer'))?.durationSeconds).toBe(135)
    expect(orderTasks.find((task) => task.id === 'order-3-curry-1-simmer')?.predecessorId).toBe('order-3-curry-0-prepare')
  })
})
