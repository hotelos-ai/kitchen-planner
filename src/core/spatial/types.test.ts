import { describe, expect, expectTypeOf, it } from 'vitest'
import type { EquipmentItem, KitchenProject } from '../../domain/project'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import type { ProjectEnvelope, SpatialItem, SpatialProject } from './types'

describe('generic spatial types', () => {
  it('projects the kitchen document without changing its serialized shape', () => {
    const project = createSeedProject()
    const spatial: SpatialProject<EquipmentItem, KitchenProject['scenarios'][number]> = kitchenSpatialAdapter.read(project)
    const envelope: ProjectEnvelope<KitchenProject> = { revision: 0, project }

    expect(spatial.variants[0].items.some((item) => item.id === 'tandoor')).toBe(true)
    expect(envelope.revision).toBe(0)
    expect(kitchenSpatialAdapter.write(spatial, project)).toEqual(project)
    expectTypeOf<EquipmentItem>().toMatchTypeOf<SpatialItem>()
  })
})
