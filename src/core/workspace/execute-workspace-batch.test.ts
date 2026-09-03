import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../../domain/blank-project'
import { createSeedProject } from '../../domain/seed-project'
import { executeWorkspaceBatch } from './execute-workspace-batch'

describe('executeWorkspaceBatch', () => {
  it('applies ordered operations to explicit variants with one candidate revision', () => {
    const project = createSeedProject()
    const result = executeWorkspaceBatch({
      project,
      revision: 5,
      expectedRevision: 5,
      operations: [
        { type: 'create_layout', variantId: 'variant-b', parentVariantId: 'baseline-trace', name: 'Option B', equipmentMode: 'duplicate' },
        { type: 'move_components', variantId: 'variant-b', componentIds: ['tandoor'], anchor: { xMm: 2200, yMm: 1000 } },
      ],
    })

    expect(result).toMatchObject({ ok: true, revision: 6, changedIds: ['variant-b', 'tandoor'] })
    expect(project.variants).toHaveLength(1)
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900 })
    if (!result.ok) throw new Error(result.message)
    expect(result.project.variants.find((variant) => variant.id === 'variant-b')?.equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2200, yMm: 1000 })
    expect(result.project.variants.find((variant) => variant.id === 'baseline-trace')?.equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900 })
  })

  it('reports the failing index and preserves the original when a later operation fails', () => {
    const project = createSeedProject()
    const result = executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [
        { type: 'move_components', variantId: 'baseline-trace', componentIds: ['tandoor'], anchor: { xMm: 2200, yMm: 1000 } },
        { type: 'remove_components', variantId: 'baseline-trace', componentIds: ['missing-component'] },
      ],
    })

    expect(result).toMatchObject({ ok: false, code: 'batch-operation-failed', operationIndex: 1, causeCode: 'missing-component', revision: 0 })
    expect(project.variants[0].equipment.find((item) => item.id === 'tandoor')).toMatchObject({ xMm: 2400, yMm: 900 })
  })

  it('rejects locked targets instead of silently claiming a change', () => {
    const project = createSeedProject()
    const tandoor = project.variants[0].equipment.find((item) => item.id === 'tandoor')!
    tandoor.movable = false

    expect(executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [{ type: 'rotate_components', variantId: 'baseline-trace', componentIds: ['tandoor'], deltaDeg: 90 }],
    })).toMatchObject({ ok: false, operationIndex: 0, causeCode: 'locked-component' })
  })

  it('rotates components around their own center', () => {
    const project = createSeedProject()
    const before = project.variants[0].equipment.find((item) => item.id === 'two-door-fridge')!
    const center = { x: before.xMm + before.widthMm / 2, y: before.yMm + before.depthMm / 2 }
    const result = executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [{ type: 'rotate_components', variantId: 'baseline-trace', componentIds: [before.id], deltaDeg: 90 }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    const after = result.project.variants[0].equipment.find((item) => item.id === before.id)!
    const radians = after.rotationDeg * Math.PI / 180
    const rotatedCenter = {
      x: after.xMm + after.widthMm / 2 * Math.cos(radians) - after.depthMm / 2 * Math.sin(radians),
      y: after.yMm + after.widthMm / 2 * Math.sin(radians) + after.depthMm / 2 * Math.cos(radians),
    }
    expect(rotatedCenter.x).toBeCloseTo(center.x)
    expect(rotatedCenter.y).toBeCloseTo(center.y)
  })

  it('applies physical configuration and appearance skin as distinct operations', () => {
    const project = createSeedProject()
    const result = executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [
        { type: 'configure_component', variantId: 'baseline-trace', componentId: 'two-door-fridge', configurationId: 'cold-chest-freezer' },
        { type: 'skin_component', variantId: 'baseline-trace', componentId: 'two-door-fridge', skinId: 'powder-coat-blue' },
      ],
    })

    expect(result).toMatchObject({ ok: true, revision: 1, changedIds: ['two-door-fridge'] })
    if (!result.ok) throw new Error(result.message)
    expect(result.project.variants[0].equipment.find((item) => item.id === 'two-door-fridge')).toMatchObject({
      configurationPreset: 'cold-chest-freezer',
      visualPreset: 'chest-freezer',
      appearanceSkinId: 'powder-coat-blue',
      widthMm: 1200,
      depthMm: 700,
    })
  })

  it('rejects unknown or catalog-incompatible appearance skins', () => {
    const project = createSeedProject()
    expect(executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [{ type: 'skin_component', variantId: 'baseline-trace', componentId: 'tandoor', skinId: 'unknown-finish' }],
    })).toMatchObject({ ok: false, causeCode: 'invalid-candidate', operationIndex: 0 })
  })

  it('rejects stale revisions and malformed batches before mutation', () => {
    const project = createSeedProject()
    expect(executeWorkspaceBatch({ project, revision: 2, expectedRevision: 1, operations: [{ type: 'activate_layout', variantId: 'baseline-trace' }] })).toMatchObject({ ok: false, code: 'stale-revision', revision: 2 })
    expect(executeWorkspaceBatch({ project, revision: 2, operations: [] })).toMatchObject({ ok: false, code: 'empty-batch', revision: 2 })
    expect(executeWorkspaceBatch({ project, revision: 2, operations: [{ type: 'move_components', variantId: 'baseline-trace', componentIds: [], anchor: { xMm: 0, yMm: 0 } }] })).toMatchObject({ ok: false, code: 'invalid-operation', operationIndex: 0, revision: 2 })
  })

  it('patches the targeted layout operational profile inside an ordered atomic batch', () => {
    const project = createSeedProject()
    const result = executeWorkspaceBatch({
      project,
      revision: 3,
      operations: [
        { type: 'create_layout', variantId: 'wizard-layout', parentVariantId: 'baseline-trace', name: 'Wizard layout', equipmentMode: 'empty' },
        { type: 'update_operational_profile', variantId: 'wizard-layout', patch: {
          covers: 72,
          peakDurationMinutes: 90,
          arrivalPattern: 'two-waves',
          serviceStyle: 'table service',
          menuAssumptions: ['high à la minute demand'],
          staff: [{ role: 'head-chef', count: 1 }, { role: 'cdp', count: 3 }],
          targetCapacityPerHour: 54,
        } },
      ],
    })

    expect(result).toMatchObject({ ok: true, revision: 4, changedIds: ['wizard-layout', 'operational-profile'] })
    if (!result.ok) throw new Error(result.message)
    expect(result.project.variants.find((variant) => variant.id === 'wizard-layout')?.operationalProfile).toEqual({
      covers: 72,
      peakDurationMinutes: 90,
      arrivalPattern: 'two-waves',
      serviceStyle: 'table service',
      menuAssumptions: ['high à la minute demand'],
      staff: [{ role: 'head-chef', count: 1 }, { role: 'cdp', count: 3 }],
      targetCapacityPerHour: 54,
    })
    expect(project.variants).toHaveLength(1)
  })

  it('applies granular opening, pillar, and storage-zone edits in order', () => {
    const project = createBlankProject()
    project.variants[0].architecture.pillars = [{ id: 'old-column', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 }]
    project.variants[0].architecture.storageZones = [{ id: 'old-zone', label: 'Old zone', xMm: 500, yMm: 500, widthMm: 800, depthMm: 600, adjacent: false }]
    project.architecture = structuredClone(project.variants[0].architecture)

    const result = executeWorkspaceBatch({
      project,
      revision: 2,
      operations: [
        { type: 'add_opening', variantId: 'layout-a', opening: { id: 'pass', label: 'Pass', kind: 'service-window', wall: 'top', offsetMm: 1200, widthMm: 1000, flow: 'clean-out' } },
        { type: 'update_opening', variantId: 'layout-a', id: 'pass', patch: { label: 'Main pass', sillHeightMm: 900, flow: null } },
        { type: 'remove_opening', variantId: 'layout-a', id: 'main-entry' },
        { type: 'add_pillar', variantId: 'layout-a', pillar: { id: 'column-a', xMm: 2400, yMm: 1800, widthMm: 350, depthMm: 350 } },
        { type: 'update_pillar', variantId: 'layout-a', id: 'column-a', patch: { widthMm: 400, depthMm: 400 } },
        { type: 'remove_pillar', variantId: 'layout-a', id: 'old-column' },
        { type: 'add_storage_zone', variantId: 'layout-a', storageZone: { id: 'dry-store', label: 'Dry store', xMm: 4000, yMm: 1000, widthMm: 1800, depthMm: 1200, adjacent: true } },
        { type: 'update_storage_zone', variantId: 'layout-a', id: 'dry-store', patch: { label: 'Bulk dry store', adjacent: false } },
        { type: 'remove_storage_zone', variantId: 'layout-a', id: 'old-zone' },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      revision: 3,
      changedIds: ['pass', 'main-entry', 'column-a', 'old-column', 'dry-store', 'old-zone'],
    })
    if (!result.ok) throw new Error(result.message)
    expect(result.project.variants[0].architecture).toMatchObject({
      openings: [{ id: 'pass', label: 'Main pass', sillHeightMm: 900 }],
      pillars: [{ id: 'column-a', widthMm: 400, depthMm: 400 }],
      storageZones: [{ id: 'dry-store', label: 'Bulk dry store', adjacent: false }],
    })
    expect(result.project.variants[0].architecture.openings[0]).not.toHaveProperty('flow')
    expect(result.project.architecture).toEqual(result.project.variants[0].architecture)
    expect(project.variants[0].architecture.openings).toContainEqual(expect.objectContaining({ id: 'main-entry' }))
  })

  it('rejects granular architecture locks, duplicates, missing elements, and malformed geometry atomically', () => {
    const locked = createBlankProject()
    locked.variants[0].layoutConstraints = { lockedArchitectureElementIds: ['main-entry'] }
    expect(executeWorkspaceBatch({
      project: locked,
      revision: 0,
      operations: [{ type: 'remove_opening', variantId: 'layout-a', id: 'main-entry' }],
    })).toMatchObject({ ok: false, operationIndex: 0, causeCode: 'locked-architecture-element' })

    const wholeLocked = createBlankProject()
    wholeLocked.variants[0].architecture.locked = true
    wholeLocked.architecture.locked = true
    expect(executeWorkspaceBatch({
      project: wholeLocked,
      revision: 0,
      operations: [{ type: 'add_pillar', variantId: 'layout-a', pillar: { id: 'column-a', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 } }],
    })).toMatchObject({ ok: false, operationIndex: 0, causeCode: 'locked-architecture' })

    const project = createBlankProject()
    const before = structuredClone(project)
    expect(executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [{ type: 'add_pillar', variantId: 'layout-a', pillar: { id: 'main-entry', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 } }],
    })).toMatchObject({ ok: false, operationIndex: 0, causeCode: 'duplicate-id' })
    expect(executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [
        { type: 'add_pillar', variantId: 'layout-a', pillar: { id: 'column-a', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 } },
        { type: 'update_storage_zone', variantId: 'layout-a', id: 'missing-zone', patch: { adjacent: true } },
      ],
    })).toMatchObject({ ok: false, operationIndex: 1, causeCode: 'missing-architecture-element' })
    expect(executeWorkspaceBatch({
      project,
      revision: 0,
      operations: [{ type: 'add_pillar', variantId: 'layout-a', pillar: { id: 'column-a', xMm: -1, yMm: 100, widthMm: 300, depthMm: 300 } }],
    })).toMatchObject({ ok: false, code: 'invalid-operation', operationIndex: 0 })
    expect(project).toEqual(before)
  })
})
