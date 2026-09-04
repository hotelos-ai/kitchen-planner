import { describe, expect, it } from 'vitest'
import type { Architecture, PointMm } from '../../domain/project'
import { constrainToAxes, createOpeningAt, createRectItemAt, edgeMidpoint, insertVertexOnSegment, moveOpening, moveVertex, nearestSegment, openingCenter, openingEnds, polygonCentroid, removeVertex, resizeOpening, resizePillarRect, slideEdge, squarePointAround } from './room-outline'

const polygon: PointMm[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 2000 },
  { x: 0, y: 2000 },
]

const architecture: Architecture = {
  widthMm: 3000,
  depthMm: 2000,
  wallHeightMm: 2800,
  roomPolygon: polygon,
  openings: [
    { id: 'door-a', label: 'Door', kind: 'door', wall: 'top', segmentIndex: 0, offsetMm: 500, widthMm: 900, flow: 'entry', swingDepthMm: 900 },
    { id: 'window-b', label: 'Window', kind: 'service-window', wall: 'right', segmentIndex: 1, offsetMm: 300, widthMm: 900, sillHeightMm: 900, heightMm: 900, flow: 'clean-out' },
    { id: 'legacy-c', label: 'Named wall', kind: 'door', wall: 'bottom', offsetMm: 200, widthMm: 800, flow: 'entry', swingDepthMm: 800 },
  ],
  pillars: [],
  storageZones: [],
  locked: true,
}

describe('room outline editing', () => {
  it('moves a vertex with snapping and never below zero', () => {
    const next = moveVertex(architecture, 1, { x: 3010, y: -140 }, 100)
    expect(next.roomPolygon[1]).toEqual({ x: 3000, y: 0 })
    expect(next.roomPolygon[0]).toEqual({ x: 0, y: 0 })
  })

  it('recomputes bounds when a vertex extends the room', () => {
    const next = moveVertex(architecture, 1, { x: 4200, y: 0 }, 100)
    expect(next.widthMm).toBe(4200)
    expect(next.depthMm).toBe(2000)
  })

  it('slides an edge by snapping both of its endpoints only', () => {
    const next = slideEdge(architecture, 1, { x: 0, y: 500 }, 100)
    expect(next.roomPolygon[1]).toEqual({ x: 3000, y: 500 })
    expect(next.roomPolygon[2]).toEqual({ x: 3000, y: 2500 })
    expect(next.roomPolygon[0]).toEqual({ x: 0, y: 0 })
    expect(next.depthMm).toBe(2500)
  })

  it('ignores an edge slide that snaps to zero movement', () => {
    expect(slideEdge(architecture, 0, { x: 40, y: 0 }, 100)).toBe(architecture)
  })

  it('inserts a vertex after the segment and remaps later opening segments', () => {
    const next = insertVertexOnSegment(architecture, 0, { x: 1500, y: 0 }, 100)
    expect(next.roomPolygon).toHaveLength(5)
    expect(next.roomPolygon[1]).toEqual({ x: 1500, y: 0 })
    const doorA = next.openings.find((opening) => opening.id === 'door-a')
    const windowB = next.openings.find((opening) => opening.id === 'window-b')
    expect(doorA?.segmentIndex).toBe(0)
    expect(windowB?.segmentIndex).toBe(2)
    expect(next.openings.find((opening) => opening.id === 'legacy-c')?.segmentIndex).toBeUndefined()
  })

  it('finds the nearest segment with a clamped projection', () => {
    const hit = nearestSegment(polygon, { x: 2600, y: 950 })
    expect(hit.segmentIndex).toBe(1)
    expect(hit.point).toEqual({ x: 3000, y: 950 })
    expect(hit.distanceMm).toBe(400)
  })

  it('computes midpoints and centroid', () => {
    expect(edgeMidpoint(polygon, 0)).toEqual({ x: 1500, y: 0 })
    expect(polygonCentroid(polygon)).toEqual({ x: 1500, y: 1000 })
  })
})

describe('named-wall opening movement', () => {
  it('slides a named-wall service window along its wall with snapping and clamping', () => {
    const named: Architecture = {
      ...architecture,
      openings: [{ id: 'clean-window', label: 'Clean service window', kind: 'service-window', wall: 'right', offsetMm: 500, widthMm: 900, sillHeightMm: 900, heightMm: 900, flow: 'clean-out' as const }],
    }
    const next = moveOpening(named, 0, { x: 3000, y: 1550 }, 100)
    expect(next.openings[0].offsetMm).toBe(1100)
    expect(next.openings[0].wall).toBe('right')
    const clamped = moveOpening(named, 0, { x: 3000, y: 2950 }, 100)
    expect(clamped.openings[0].offsetMm).toBe(1100)
    const corner = moveOpening(named, 0, { x: 3000, y: 0 }, 100)
    expect(corner.openings[0].segmentIndex).toBe(0)
    expect(corner.openings[0].offsetMm).toBe(2100)
  })

  it('places the named-wall handle at offset plus half width', () => {
    const named: Architecture = { ...architecture, openings: [{ id: 'w', label: 'W', kind: 'service-window', wall: 'top', offsetMm: 600, widthMm: 900, sillHeightMm: 900, heightMm: 900, flow: 'clean-out' as const }] }
    const center = openingCenter(named, named.openings[0])
    expect(center).toEqual({ x: 1050, y: 0 })
  })
})

describe('cross-wall opening movement', () => {
  it('moves an opening to the nearest wall, not just its own', () => {
    const source: Architecture = {
      ...architecture,
      openings: [{ id: 'w', label: 'W', kind: 'service-window', wall: 'right', offsetMm: 500, widthMm: 900, sillHeightMm: 900, heightMm: 900, flow: 'clean-out' as const }],
    }
    // drop near the bottom wall (y=2000), far from the right wall
    const next = moveOpening(source, 0, { x: 1500, y: 1900 }, 100)
    expect(next.openings[0].segmentIndex).toBe(2)
    expect(next.openings[0].wall).toBe('bottom')
    expect(next.openings[0].offsetMm).toBe(1100)
  })

  it('keeps the opening on its wall when dragged along it', () => {
    const source: Architecture = {
      ...architecture,
      openings: [{ id: 'w', label: 'W', kind: 'service-window', wall: 'right', offsetMm: 500, widthMm: 900, sillHeightMm: 900, heightMm: 900, flow: 'clean-out' as const }],
    }
    const next = moveOpening(source, 0, { x: 2950, y: 1600 }, 100)
    expect(next.openings[0].segmentIndex).toBe(1)
    expect(next.openings[0].wall).toBe('right')
    expect(next.openings[0].offsetMm).toBe(1100)
  })

  it('keeps rendered geometry moving in the drag direction on a reverse-oriented wall', () => {
    const source: Architecture = {
      ...architecture,
      openings: [{ id: 'door', label: 'Door', kind: 'door', wall: 'left', offsetMm: 200, widthMm: 600, flow: 'entry' as const }],
    }
    const next = moveOpening(source, 0, { x: 0, y: 1500 }, 100)
    const center = openingCenter(next, next.openings[0])
    const ends = openingEnds(next, next.openings[0])

    expect(next.openings[0].segmentIndex).toBe(3)
    expect(center.y).toBe(1500)
    expect((ends.start.y + ends.end.y) / 2).toBe(1500)
  })

  it('clamps width when the only reachable wall is shorter than the opening', () => {
    const narrow: Architecture = {
      ...architecture,
      roomPolygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 }],
      widthMm: 1000,
      depthMm: 2000,
      openings: [{ id: 'w', label: 'W', kind: 'door', wall: 'right', offsetMm: 500, widthMm: 900, flow: 'entry' as const, swingDepthMm: 900 }],
    }
    const next = moveOpening(narrow, 0, { x: 900, y: 100 }, 100)
    expect(next.openings[0].widthMm).toBeLessThanOrEqual(1000)
    expect(next.openings[0].offsetMm).toBeGreaterThanOrEqual(0)
  })
})

describe('vertex removal', () => {
  it('removes a middle vertex and remaps later opening segments', () => {
    const next = removeVertex(architecture, 1)
    expect(next.roomPolygon).toHaveLength(3)
    expect(next.roomPolygon[0]).toEqual({ x: 0, y: 0 })
    expect(next.roomPolygon[1]).toEqual({ x: 3000, y: 2000 })
    const windowB = next.openings.find((opening) => opening.id === 'window-b')
    expect(windowB?.segmentIndex).toBe(0)
  })

  it('merges the wrap-around segments when removing vertex zero', () => {
    const next = removeVertex(architecture, 0)
    expect(next.roomPolygon).toHaveLength(3)
    const doorA = next.openings.find((opening) => opening.id === 'door-a')
    expect(doorA?.segmentIndex).toBe(2)
  })

  it('refuses to drop below three vertices', () => {
    const triangle: Architecture = { ...architecture, roomPolygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 1000 }] }
    expect(removeVertex(triangle, 1)).toBe(triangle)
  })
})

describe('shift constraints and canvas creation', () => {
  it('constrains a drag to the nearest 45-degree axis', () => {
    const horizontal = constrainToAxes({ x: 0, y: 0 }, { x: 1010, y: 90 })
    expect(horizontal.y).toBe(0)
    expect(horizontal.x).toBeCloseTo(1014, 0)
    const diagonal = constrainToAxes({ x: 0, y: 0 }, { x: 1000, y: 990 })
    expect(diagonal.x).toBeCloseTo(diagonal.y, 6)
    const vertical = constrainToAxes({ x: 1000, y: 1000 }, { x: 1010, y: 1300 })
    expect(vertical.x).toBe(1000)
    expect(vertical.y).toBeCloseTo(1300.17, 1)
  })

  it('expands a square point around the opposite corner', () => {
    expect(squarePointAround({ x: 0, y: 0 }, { x: 800, y: 300 })).toEqual({ x: 800, y: 800 })
    expect(squarePointAround({ x: 1000, y: 1000 }, { x: 400, y: 900 })).toEqual({ x: 400, y: 400 })
  })

  it('creates a pillar by drag with snapped bounds', () => {
    const next = createRectItemAt(architecture, { id: 'architecture-pillar', label: 'Pillar', kind: 'pillar', widthMm: 400, depthMm: 400 }, { x: 500, y: 500 }, { x: 1300, y: 900 }, 100)
    const created = next.pillars[next.pillars.length - 1]
    expect(created.xMm).toBe(500)
    expect(created.yMm).toBe(500)
    expect(created.widthMm).toBe(800)
    expect(created.depthMm).toBe(400)
  })

  it('creates a pillar by click with typical size centered', () => {
    const next = createRectItemAt(architecture, { id: 'architecture-pillar', label: 'Pillar', kind: 'pillar', widthMm: 400, depthMm: 400 }, { x: 1500, y: 1000 }, null, 100)
    const created = next.pillars[next.pillars.length - 1]
    expect(created.xMm).toBe(1300)
    expect(created.yMm).toBe(800)
    expect(created.widthMm).toBe(400)
  })

  it('creates an opening on the nearest wall with drag length as width', () => {
    const next = createOpeningAt(architecture, { label: 'Door', kind: 'door', widthMm: 900 }, { x: 500, y: 0 }, { x: 1400, y: 0 }, 100)
    const created = next.openings[next.openings.length - 1]
    expect(created.kind).toBe('door')
    expect(created.segmentIndex).toBe(0)
    expect(created.offsetMm).toBe(500)
    expect(created.widthMm).toBe(900)
  })

  it('creates a regular window without assigning service flow', () => {
    const next = createOpeningAt(architecture, { label: 'Natural light', kind: 'window', widthMm: 1200 }, { x: 500, y: 0 }, { x: 1700, y: 0 }, 100)
    expect(next.openings.at(-1)).toMatchObject({
      kind: 'window', label: 'Natural light', widthMm: 1200, sillHeightMm: 1000, heightMm: 1200, flow: 'closed',
    })
  })

  it('resizes a pillar from a corner handle', () => {
    const withPillar: Architecture = { ...architecture, pillars: [{ id: 'p1', xMm: 500, yMm: 500, widthMm: 400, depthMm: 400 }] }
    const next = resizePillarRect(withPillar, 0, 'br', { x: 1400, y: 900 }, 100)
    expect(next.pillars[0].widthMm).toBe(900)
    expect(next.pillars[0].depthMm).toBe(400)
  })

  it('resizes an opening end handle with a minimum width', () => {
    const withOpening: Architecture = { ...architecture, openings: [{ id: 'd1', label: 'D', kind: 'door', wall: 'top', segmentIndex: 0, offsetMm: 500, widthMm: 900, flow: 'entry' as const, swingDepthMm: 900 }] }
    const grown = resizeOpening(withOpening, 0, 'end', { x: 2000, y: 0 }, 100)
    expect(grown.openings[0].widthMm).toBe(1500)
    const shrunk = resizeOpening(withOpening, 0, 'end', { x: 0, y: 0 }, 100)
    expect(shrunk.openings[0].widthMm).toBeGreaterThanOrEqual(200)
  })
})
