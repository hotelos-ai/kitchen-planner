import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import type { SimulationFrame } from '../../simulation/types'
import { buildAgentTrails, stationQueueAnchors } from './spatial-overlay-data'

describe('3D simulation overlay data', () => {
  it('builds recent per-agent trails at the active playback time', () => {
    const frames: SimulationFrame[] = [0, 1, 2].map((elapsedSeconds) => ({ elapsedSeconds, agents: [{ agentId: 'chef-1', role: 'cdp', xMm: elapsedSeconds * 100, yMm: 900, state: 'walking' }] }))
    expect(buildAgentTrails(frames, 2, 2)).toEqual([{ agentId: 'chef-1', role: 'cdp', points: [[0, 900], [100, 900], [200, 900]] }])
  })

  it('anchors live queue badges to the matching equipment footprint', () => {
    const equipment = createSeedProject().variants[0].equipment
    expect(stationQueueAnchors(equipment, [{ stationId: 'tandoor', active: 1, waiting: 3, completed: 2 }])).toEqual([
      { stationId: 'tandoor', label: 'Tandoor', xMm: 2750, yMm: 1250, active: 1, waiting: 3 },
    ])
  })
})
