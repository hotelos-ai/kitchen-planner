import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createRng } from './rng'
import { generateServiceTasks } from './tasks'

describe('service task generation', () => {
  it('creates cook-to-order and dirty-dish chains for the default wave', () => {
    const project = createSeedProject()
    const tasks = generateServiceTasks(project.scenarios[0], project.variants[0].equipment, createRng(20260831))
    expect(tasks.some((task) => task.capability === 'tandoor-cook')).toBe(true)
    expect(tasks.some((task) => task.capability === 'dish-pre-rinse')).toBe(true)
    expect(tasks.filter((task) => task.orderId).length).toBeGreaterThan(50)
  })
})
