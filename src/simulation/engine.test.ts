import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { openingInteriorPoint, runSimulation } from './engine'

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

  it('never assigns production work to an ineligible warewashing role', () => {
    const project = createSeedProject()
    project.scenarios[0].staff = [{ role: 'busser-washer', count: 2 }]
    expect(() => runSimulation({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })).toThrow(/staff-production|production role/i)
  })

  it('dynamically dispatches repeated work across multiple compatible stations', () => {
    const project = createSeedProject()
    const result = runSimulation({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] })
    const prepStations = new Set(result.taskTimeline.filter((task) => task.capability === 'food-prep').map((task) => task.stationId))
    expect(prepStations.size).toBeGreaterThan(1)
  })

  it('starts from a non-seed right-wall entry without hard-coded D2 coordinates', () => {
    const project = createSeedProject()
    const architecture = structuredClone(project.architecture)
    const widthMm = architecture.widthMm
    architecture.roomPolygon = architecture.roomPolygon.map((point) => ({ x: widthMm - point.x, y: point.y }))
    architecture.pillars = architecture.pillars.map((pillar) => ({ ...pillar, xMm: widthMm - pillar.xMm - pillar.widthMm }))
    architecture.openings = architecture.openings.map((opening) => ({
      ...opening,
      wall: opening.wall === 'left' ? 'right' : opening.wall === 'right' ? 'left' : opening.wall,
    }))
    const equipment = structuredClone(project.variants[0].equipment).map((item) => ({ ...item, xMm: widthMm - item.xMm - item.widthMm }))
    const scenario = { ...project.scenarios[0], covers: 4, durationMinutes: 10 }

    const result = runSimulation({ architecture, equipment, scenario })

    expect(result.frames[0].agents.every((agent) => agent.xMm > widthMm / 2)).toBe(true)
    expect(result.metrics.completedOrders).toBeGreaterThan(0)
  })

  it('derives hot-line congestion from cooking geometry after a generic room translation', () => {
    const project = createSeedProject()
    const offsetMm = 3000
    const architecture = structuredClone(project.architecture)
    architecture.depthMm += offsetMm
    architecture.roomPolygon = architecture.roomPolygon.map((point) => ({ x: point.x, y: point.y + offsetMm }))
    architecture.pillars = architecture.pillars.map((pillar) => ({ ...pillar, yMm: pillar.yMm + offsetMm }))
    architecture.storageZones = architecture.storageZones.map((zone) => ({ ...zone, yMm: zone.yMm + offsetMm }))
    architecture.openings = architecture.openings.map((opening) => ({
      ...opening,
      offsetMm: opening.wall === 'left' || opening.wall === 'right' ? opening.offsetMm + offsetMm : opening.offsetMm,
    }))
    const equipment = structuredClone(project.variants[0].equipment).map((item) => ({ ...item, yMm: item.yMm + offsetMm }))
    const scenario = { ...project.scenarios[0], covers: 10, durationMinutes: 20 }

    const result = runSimulation({ architecture, equipment, scenario })

    expect(result.metrics.congestionEvents).toBeGreaterThan(0)
    expect(result.metrics.hotLineCongestionEvents).toBeGreaterThan(0)
  })

  it('evaluates dirty-clean crossings independently from collision reporting', () => {
    const project = createSeedProject()
    const snapshot = { architecture: project.architecture, equipment: project.variants[0].equipment }
    const scenario = { ...project.scenarios[0], covers: 10, durationMinutes: 20, checks: { collisions: false, doorSwings: false, dirtyCleanCrossings: true } }
    const dirtyOnly = runSimulation({ ...snapshot, scenario })
    const checksDisabled = runSimulation({ ...snapshot, scenario: { ...scenario, checks: { ...scenario.checks, dirtyCleanCrossings: false } } })

    expect(dirtyOnly.metrics.congestionEvents).toBe(0)
    expect(dirtyOnly.metrics.dirtyCleanCrossings).toBeGreaterThan(0)
    expect(checksDisabled.metrics.dirtyCleanCrossings).toBe(0)
  })

  it('reports unmodeled professional constraints as unknown', () => {
    const project = createSeedProject()
    const result = runSimulation({ architecture: project.architecture, equipment: project.variants[0].equipment, scenario: { ...project.scenarios[0], covers: 4, durationMinutes: 10 }, outputMode: 'metrics-only' })

    expect(result.warnings).toContain('Professional fire, ventilation, hygiene, accessibility, electrical, and drainage constraints remain unknown pending qualified review.')
  })

  it('completes station work from the closest reachable point when the preferred approach is obstructed', () => {
    const project = createSeedProject()
    const equipment = structuredClone(project.variants[0].equipment)
    const dirtyLanding = equipment.find((item) => item.id === 'dirty-landing')!
    Object.assign(dirtyLanding, { xMm: 2700, yMm: 5950, widthMm: 700, depthMm: 600 })
    const scenario = { ...project.scenarios[0], covers: 2, durationMinutes: 10 }

    const result = runSimulation({ architecture: project.architecture, equipment, scenario })

    expect(result.warnings).toContainEqual(expect.stringMatching(/Dishwasher.*closest reachable service point/i))
    expect(result.metrics.unreachableTasks).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'station-work', stationId: 'dishwasher' }))
  })

  it('derives navigation opening points from arbitrary polygon segments', () => {
    const project = createSeedProject()
    const architecture = {
      ...project.architecture,
      widthMm: 4000,
      depthMm: 3000,
      roomPolygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 4000, y: 1000 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }],
      openings: [{ id: 'diagonal-entry', label: 'Diagonal entry', kind: 'door' as const, wall: 'right' as const, segmentIndex: 1, offsetMm: 200, widthMm: 600, flow: 'entry' as const }],
    }

    const point = openingInteriorPoint({ architecture }, 'diagonal-entry')

    expect(point.x).toBeCloseTo(3247.487)
    expect(point.y).toBeCloseTo(459.619)
  })
})
