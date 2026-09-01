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
    expect(JSON.stringify(result)).toContain('move-items')
  })

  it('returns structured missing-item errors', () => {
    expect(executeLayoutQuery(envelope, kitchenSpatialAdapter, { type: 'item', id: 'missing' })).toMatchObject({
      ok: false, code: 'missing-item', revision: 4,
    })
  })
})
