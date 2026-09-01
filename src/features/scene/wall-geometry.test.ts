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
})
