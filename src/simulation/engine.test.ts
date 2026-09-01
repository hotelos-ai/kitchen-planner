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
    expect(result.metrics.totalOrders).toBe(25)
    expect(result.metrics.averageOrderWaitSeconds).toBeGreaterThan(0)
    expect(result.metrics.throughputPerHour).toBeGreaterThan(0)
    expect(result.taskTimeline.some((task) => task.orderId && task.queueSeconds >= 0)).toBe(true)
    expect(result.orders).toHaveLength(25)
    expect(result.orders.every((order) => order.arrivedAtSeconds >= 0 && order.stages.length === 5)).toBe(true)
    expect(result.orders.every((order) => order.stages.at(-1)?.stationId === 'clean-window')).toBe(true)
    expect(result.taskTimeline.find((task) => task.capability === 'dirty-window')?.stationId).toBe('dirty-window')
    expect(result.metrics.finishToPassTravelMm).toBeGreaterThan(0)
    expect(result.metrics.dirtyToWashTravelMm).toBeGreaterThan(0)
  })

  it('dispatches newly arrived tickets before reserving the whole first ticket chain', () => {
    const project = createSeedProject()
    const result = runSimulation({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    const thirdTicket = result.orders[2]
    const thirdTicketRetrieval = thirdTicket.stages.find((stage) => stage.capability === 'cold-retrieval')!

    expect(thirdTicketRetrieval.workStartSeconds - thirdTicket.arrivedAtSeconds).toBeLessThan(180)
  })
})
