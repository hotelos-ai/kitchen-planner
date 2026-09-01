import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { equipmentSelectionDescriptor } from './equipment-selection'

it('uses exact cuboid bounds and never a circular marker', () => {
  const item = createSeedProject().variants[0].equipment.find((value) => value.id === 'tandoor')!
  expect(equipmentSelectionDescriptor(item)).toEqual({
    shape: 'cuboid',
    widthM: .7,
    depthM: .7,
    heightM: .9,
    ring: false,
  })
})
