import { describe, expect, it } from 'vitest'
import { createCatalogEquipmentItem } from './catalog/kitchen-catalog'
import type { Architecture, EquipmentItem } from './project'
import { analyzeLayout, UNKNOWN_PROFESSIONAL_CONSTRAINTS } from './layout-diagnostics'
import { createSeedProject } from './seed-project'

describe('layout diagnostics', () => {
  it('flags equipment outside the room and overlapping another footprint', () => {
    const project = createSeedProject()
    const equipment = structuredClone(project.variants[0].equipment)
    equipment.find((item) => item.id === 'mixer')!.xMm = -300
    const duplicate = { ...structuredClone(equipment.find((item) => item.id === 'tandoor')!), id: 'second-tandoor', label: 'Second tandoor' }
    equipment.push(duplicate)
    const issues = analyzeLayout(project.architecture, equipment)
    expect(issues).toContainEqual(expect.objectContaining({ code: 'outside-room', itemIds: ['mixer'] }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'equipment-overlap', itemIds: expect.arrayContaining(['tandoor', 'second-tandoor']) }))
  })

  it('recognizes the confirmed tandoor-to-pillar contact as touching, not overlap', () => {
    const project = createSeedProject()
    const issues = analyzeLayout(project.architecture, project.variants[0].equipment)
    expect(issues.some((issue) => issue.code === 'pillar-overlap' && issue.itemIds.includes('tandoor'))).toBe(false)
  })

  it('allows wall shelves and other walk-under items to overlap floor equipment', () => {
    const project = createSeedProject()
    const floorItem = project.variants[0].equipment.find((item) => item.id === 'six-burner')!
    const shelf = createCatalogEquipmentItem({
      catalogId: 'storage-wall-shelf',
      componentId: 'wall-shelf-over-range',
      position: { xMm: floorItem.xMm, yMm: floorItem.yMm },
    })
    const issues = analyzeLayout(project.architecture, [floorItem, shelf])

    expect(issues.some((issue) => issue.code === 'equipment-overlap')).toBe(false)
  })

  it('checks full rotated clearance envelopes against equipment, pillars, walls, doors, and no-go zones', () => {
    const architecture: Architecture = {
      widthMm: 4000, depthMm: 4000, wallHeightMm: 2800, locked: false,
      roomPolygon: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }],
      openings: [{ id: 'staff-door', label: 'Staff door', kind: 'door', wall: 'left', offsetMm: 1400, widthMm: 900, swingDepthMm: 900 }],
      pillars: [{ id: 'column', xMm: 1550, yMm: 900, widthMm: 300, depthMm: 300 }],
      storageZones: [],
    }
    const item = (id: string, xMm: number, yMm: number, rotationDeg = 0): EquipmentItem => ({
      id, label: id, category: 'prep', widthMm: 400, depthMm: 400, heightMm: 850,
      xMm, yMm, rotationDeg, dimensionsLocked: false, movable: true, removable: true,
      capabilities: [],
    })
    const main = { ...item('main', 1400, 1400, 90), clearance: { frontMm: 500, backMm: 500, leftMm: 500, rightMm: 500, kind: 'work' as const } }
    const wall = { ...item('wall-clearance', 100, 100), clearance: { frontMm: 0, backMm: 300, leftMm: 300, rightMm: 0, kind: 'work' as const } }
    const door = { ...item('door-clearance', 850, 1650), clearance: { frontMm: 0, backMm: 0, leftMm: 400, rightMm: 0, kind: 'work' as const } }
    const noGo = { ...item('zone-clearance', 2500, 2500), clearance: { frontMm: 600, kind: 'work' as const } }
    const equipment = [main, item('side-blocker', 900, 1500), wall, door, noGo]
    const issues = analyzeLayout(architecture, equipment, {
      layoutConstraints: { noGoZones: [{ id: 'protected-riser', xMm: 2450, yMm: 3300, widthMm: 800, depthMm: 400 }] },
    }).filter((issue) => issue.code === 'clearance-obstructed')

    expect(issues.find((issue) => issue.itemIds[0] === 'main')).toEqual(expect.objectContaining({ itemIds: expect.arrayContaining(['main', 'side-blocker', 'column']) }))
    expect(issues.find((issue) => issue.itemIds[0] === 'wall-clearance')?.message).toMatch(/room boundary/i)
    expect(issues.find((issue) => issue.itemIds[0] === 'door-clearance')).toEqual(expect.objectContaining({ itemIds: expect.arrayContaining(['door-clearance', 'staff-door']) }))
    expect(issues.find((issue) => issue.itemIds[0] === 'zone-clearance')).toEqual(expect.objectContaining({ itemIds: expect.arrayContaining(['zone-clearance', 'protected-riser']) }))
  })

  it('keeps unmodeled professional constraints explicitly unknown', () => {
    expect(UNKNOWN_PROFESSIONAL_CONSTRAINTS).toEqual(expect.arrayContaining([
      { code: 'fire', status: 'unknown' },
      { code: 'ventilation', status: 'unknown' },
      { code: 'hygiene', status: 'unknown' },
      { code: 'accessibility', status: 'unknown' },
    ]))
    expect(UNKNOWN_PROFESSIONAL_CONSTRAINTS.every((constraint) => constraint.status === 'unknown')).toBe(true)
  })
})
