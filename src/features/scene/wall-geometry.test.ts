import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { buildWallPanels, serviceWindowFixtures } from './wall-geometry'

describe('wall geometry', () => {
  const architecture = createSeedProject().architecture

  it('cuts service windows between sill and head while retaining wall above and below', () => {
    const panels = buildWallPanels(architecture)
    const clean = panels.filter((panel) => panel.openingId === 'clean-window')
    expect(clean.map((panel) => panel.part).sort()).toEqual(['above', 'below'])
    expect(clean.find((panel) => panel.part === 'below')?.sizeMm.height).toBe(950)
    expect(clean.find((panel) => panel.part === 'above')?.sizeMm.height).toBe(950)
  })

  it('leaves D2 open, keeps D6 sealed, and returns distinct pass flows', () => {
    const panels = buildWallPanels(architecture)
    const covers = (wall: string, offsetMm: number) => panels.some((panel) => panel.wall === wall && panel.offsetStartMm <= offsetMm && panel.offsetEndMm >= offsetMm && panel.part === 'run')
    expect(covers('left', 6000)).toBe(false)
    expect(covers('top', 2900)).toBe(true)
    expect(serviceWindowFixtures(architecture).map((fixture) => fixture.flow)).toEqual(['clean-out', 'dirty-in'])
  })

  it('uses segmentIndex to cut and position an opening on a diagonal polygon wall', () => {
    const polygonArchitecture = structuredClone(architecture)
    polygonArchitecture.widthMm = 4000
    polygonArchitecture.depthMm = 3000
    polygonArchitecture.roomPolygon = [
      { x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 4000, y: 1000 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 },
    ]
    polygonArchitecture.pillars = []
    polygonArchitecture.openings = [{
      id: 'diagonal-pass', label: 'Diagonal pass', kind: 'service-window', wall: 'right', segmentIndex: 1,
      offsetMm: 200, widthMm: 600, sillHeightMm: 1000, heightMm: 800, flow: 'clean-out',
    }]

    const panels = buildWallPanels(polygonArchitecture)
    const passPanels = panels.filter((panel) => panel.openingId === 'diagonal-pass')
    const fixture = serviceWindowFixtures(polygonArchitecture)[0]

    expect(passPanels.map((panel) => panel.part).sort()).toEqual(['above', 'below'])
    expect(passPanels[0].rotationYRad).toBeCloseTo(-Math.PI / 4)
    expect(fixture.centerMm.x).toBeCloseTo(3353.553)
    expect(fixture.centerMm.z).toBeCloseTo(353.553)
    expect(fixture.rotationYRad).toBeCloseTo(-Math.PI / 4)
  })
})
