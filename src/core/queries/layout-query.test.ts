import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import { executeLayoutQuery } from './layout-query'

describe('executeLayoutQuery', () => {
  const envelope = { project: createSeedProject(), revision: 4 }

  it('returns concise JSON-safe item data', () => {
    const result = executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'list-items', category: 'cooking' })
    expect(result).toMatchObject({ ok: true, revision: 4 })
    expect(JSON.stringify(result)).toContain('tandoor')
  })

  it('describes the supported command surface', () => {
    const result = executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'capabilities' })
    expect(result).toMatchObject({ ok: true, revision: 4 })
    expect(JSON.stringify(result)).toContain('move_components')
    expect(JSON.stringify(result)).not.toContain('move-items')
    expect(JSON.stringify(result)).toContain('tandoor')
    expect(JSON.stringify(result)).toContain('range-cook')
  })

  it('reads architecture from the active variant instead of the compatibility mirror', () => {
    const project = createSeedProject()
    project.architecture.widthMm = 99_000
    project.variants[0].architecture.widthMm = 4_200

    expect(executeLayoutQuery({ project, revision: 0 }, kitchenSpatialAdapter, { type: 'architecture' })).toMatchObject({
      ok: true,
      data: { widthMm: 4_200 },
    })
  })

  it('returns available zones without requiring a full project snapshot', () => {
    expect(executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'available-zones' })).toMatchObject({
      ok: true, revision: 4, data: envelope.project.architecture.storageZones,
    })
  })

  it('returns structured missing-item errors', () => {
    expect(executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'item', id: 'missing' })).toMatchObject({
      ok: false, code: 'missing-item', revision: 4,
    })
  })
})
