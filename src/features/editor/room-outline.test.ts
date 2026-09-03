import { describe, expect, it } from 'vitest'
import type { Architecture, PointMm } from '../../domain/project'
import { edgeMidpoint, insertVertexOnSegment, moveVertex, nearestSegment, polygonCentroid, slideEdge } from './room-outline'

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
