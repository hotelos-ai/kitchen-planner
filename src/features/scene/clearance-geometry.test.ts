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
})
