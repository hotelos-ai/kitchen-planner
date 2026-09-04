import { describe, expect, it } from 'vitest'
import type { Architecture, EquipmentItem } from '../project'
import { suggestCatalogPlacement } from './suggest-placement'

const architecture: Architecture = {
  widthMm: 600,
  depthMm: 400,
  wallHeightMm: 2800,
  roomPolygon: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }, { x: 0, y: 400 }],
  openings: [],
  pillars: [],
  storageZones: [],
  locked: false,
}

const entry = { typicalDimensions: { widthMm: 200, depthMm: 200, heightMm: 850 } }

const occupied = (id: string, xMm: number, yMm: number): EquipmentItem => ({
  id,
  label: id,
  category: 'custom',
  widthMm: 200,
  depthMm: 200,
  heightMm: 850,
  xMm,
  yMm,
  rotationDeg: 0,
  dimensionsLocked: false,
  movable: true,
  removable: true,
  capabilities: [],
})

describe('catalog placement suggestion', () => {
  it('uses a snapped preferred point when it is feasible', () => {
    expect(suggestCatalogPlacement({ architecture, equipment: [], entry, snapMm: 100, preferredPoint: { xMm: 249, yMm: 151 } })).toEqual({ xMm: 200, yMm: 200, rotationDeg: 0 })
  })

  it('falls back to deterministic row-major free space', () => {
    const equipment = [occupied('first', 0, 0)]
    const input = { architecture, equipment, entry, snapMm: 100, preferredPoint: { xMm: 0, yMm: 0 } }

    expect(suggestCatalogPlacement(input)).toEqual({ xMm: 200, yMm: 0, rotationDeg: 0 })
    expect(suggestCatalogPlacement(structuredClone(input))).toEqual(suggestCatalogPlacement(input))
  })

  it('respects pillars, rotated equipment, and jagged room boundaries', () => {
    const jagged: Architecture = {
      ...architecture,
      roomPolygon: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 400 }, { x: 0, y: 400 }],
      pillars: [{ id: 'pillar', xMm: 200, yMm: 0, widthMm: 200, depthMm: 200 }],
    }
    const rotated = { ...occupied('rotated', 600, 0), rotationDeg: 90 }

    expect(suggestCatalogPlacement({ architecture: jagged, equipment: [occupied('first', 0, 0), rotated], entry, snapMm: 100 })).toEqual({ xMm: 0, yMm: 200, rotationDeg: 0 })
  })

  it('returns null rather than overlapping when no placement fits', () => {
    const equipment = [occupied('a', 0, 0), occupied('b', 200, 0), occupied('c', 400, 0), occupied('d', 0, 200), occupied('e', 200, 200), occupied('f', 400, 200)]
    expect(suggestCatalogPlacement({ architecture, equipment, entry, snapMm: 100 })).toBeNull()
  })

  it('allows elevated shelves to be placed above occupied floor footprints', () => {
    const elevatedEntry = {
      ...entry,
      placementRules: { mounting: 'overhead' as const, requiresWall: false },
    }
    expect(suggestCatalogPlacement({
      architecture,
      equipment: [occupied('counter', 0, 0)],
      entry: elevatedEntry,
      snapMm: 100,
      preferredPoint: { xMm: 0, yMm: 0 },
    })).toEqual({ xMm: 0, yMm: 0, rotationDeg: 0 })
  })

  it('keeps new floor equipment out of no-go zones and opening clearances', () => {
    const constrained: Architecture = {
      ...architecture,
      openings: [{ id: 'entry', label: 'Entry', kind: 'door', wall: 'top', offsetMm: 0, widthMm: 200, flow: 'entry' }],
    }
    const constrainedEntry = {
      ...entry,
      placementRules: { mounting: 'floor' as const, requiresWall: false, keepClearOfOpeningsMm: 100 },
    }

    expect(suggestCatalogPlacement({
      architecture: constrained,
      equipment: [],
      entry: constrainedEntry,
      snapMm: 100,
      layoutConstraints: { noGoZones: [{ id: 'protected', xMm: 200, yMm: 0, widthMm: 100, depthMm: 200 }] },
    })).toEqual({ xMm: 300, yMm: 0, rotationDeg: 0 })
  })

  it('rejects malformed dimensions or snap intervals without throwing', () => {
    expect(suggestCatalogPlacement({ architecture, equipment: [], entry: { typicalDimensions: { widthMm: -1, depthMm: 200, heightMm: 850 } }, snapMm: 100 })).toBeNull()
    expect(suggestCatalogPlacement({ architecture, equipment: [], entry, snapMm: 0 })).toBeNull()
  })
})
