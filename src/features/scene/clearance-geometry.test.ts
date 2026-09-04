import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { buildClearanceDescriptors } from './clearance-geometry'

describe('clearance descriptors', () => {
  it('creates visible heat zones and labeled cold door swings', () => {
    const project = createSeedProject()
    const descriptors = buildClearanceDescriptors(project.variants[0].equipment, project.architecture, 'mm')
    expect(descriptors.find((zone) => zone.id === 'clearance-tandoor')).toMatchObject({ kind: 'heat', label: 'Heat clearance · 1000 mm', shape: 'rect' })
    expect(descriptors.find((zone) => zone.id === 'swing-upright-freezer')).toMatchObject({ kind: 'door-swing', shape: 'arc' })
    expect(descriptors.find((zone) => zone.id === 'swing-d2')).toMatchObject({ kind: 'door-swing', shape: 'arc' })
  })

  it('formats labels in the project display unit', () => {
    const project = createSeedProject()
    const descriptor = buildClearanceDescriptors(project.variants[0].equipment, project.architecture, 'cm').find((zone) => zone.id === 'clearance-six-burner')
    expect(descriptor?.label).toBe('Heat clearance · 110 cm')
  })

  it('creates two swing zones for double doors and none for sliding doors', () => {
    const project = createSeedProject()
    const door = project.architecture.openings.find((opening) => opening.id === 'd2')!
    door.doorType = 'double-hinged'
    door.widthMm = 1_800
    project.variants[0].architecture = structuredClone(project.architecture)
    expect(buildClearanceDescriptors([], project.architecture, 'mm').filter((zone) => zone.id.startsWith('swing-d2'))).toHaveLength(2)

    door.doorType = 'sliding'
    expect(buildClearanceDescriptors([], project.architecture, 'mm').filter((zone) => zone.id.startsWith('swing-d2'))).toHaveLength(0)
  })
})
