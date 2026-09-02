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

  it('promotes the activated variant architecture to the compatibility view', () => {
    const project = createSeedProject()
    const alternative = structuredClone(project.variants[0])
    alternative.id = 'wide-room'
    alternative.architecture.widthMm = 5200
    alternative.architecture.roomPolygon = [{ x: 0, y: 0 }, { x: 5200, y: 0 }, { x: 5200, y: 6650 }, { x: 0, y: 6650 }]
    project.variants.push(alternative)
    const spatial = kitchenSpatialAdapter.read(project)

    spatial.activeVariantId = alternative.id
    const activated = kitchenSpatialAdapter.write(spatial, project)

    expect(activated.architecture).toEqual(alternative.architecture)
    expect(activated.variants[0].architecture.widthMm).toBe(3900)
    expect(activated.variants[1].architecture.widthMm).toBe(5200)
  })
})
