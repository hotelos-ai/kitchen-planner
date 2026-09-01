import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { kitchenSpatialAdapter } from '../../domain/spatial-adapter'
import { executeLayoutCommand } from './execute-layout-command'

describe('executeLayoutCommand', () => {
  it('returns a new revision and changed IDs without mutating input', () => {
    const project = createSeedProject()
    const result = executeLayoutCommand({
      envelope: { project, revision: 7 },
      adapter: kitchenSpatialAdapter,
      expectedRevision: 7,
      command: { type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 } },
    })

    expect(result).toMatchObject({ ok: true, revision: 8, changedIds: ['tandoor'] })
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')?.xMm).toBe(2400)
    if (result.ok) expect(result.project.variants[0].equipment.find((item) => item.id === 'tandoor')?.xMm).toBe(2300)
  })

  it('supports dry run and stale revision errors', () => {
    const envelope = { project: createSeedProject(), revision: 2 }
    const dry = executeLayoutCommand({ envelope, adapter: kitchenSpatialAdapter, dryRun: true, command: { type: 'remove-items', ids: ['tandoor'] } })
    expect(dry).toMatchObject({ ok: true, revision: 2, dryRun: true, changedIds: ['tandoor'] })
    expect(executeLayoutCommand({ envelope, adapter: kitchenSpatialAdapter, expectedRevision: 1, command: { type: 'remove-items', ids: ['tandoor'] } })).toMatchObject({
      ok: false, code: 'stale-revision', revision: 2,
    })
  })

  it('enforces item locks and exact identifiers', () => {
    const project = createSeedProject()
    expect(executeLayoutCommand({
      envelope: { project, revision: 0 }, adapter: kitchenSpatialAdapter,
      command: { type: 'resize-item', id: 'tandoor', widthMm: 900, depthMm: 700 },
    })).toMatchObject({ ok: false, code: 'locked-item' })
    expect(executeLayoutCommand({
      envelope: { project, revision: 0 }, adapter: kitchenSpatialAdapter,
      command: { type: 'remove-items', ids: ['missing'] },
    })).toMatchObject({ ok: false, code: 'missing-item' })
  })
})
