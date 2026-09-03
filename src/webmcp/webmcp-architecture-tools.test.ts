import { beforeEach, describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/blank-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getActiveVariant, getWorkspaceFacade } from '../state/project-store'
import type { WebMcpToolDefinition } from './model-context'
import { createArchitectureTools } from './webmcp-architecture-tools'

type Envelope = { ok: boolean; revision: number; code?: string } & Record<string, unknown>

const setup = (mutate?: (project: ReturnType<typeof createBlankProject>) => void) => {
  const project = createBlankProject()
  mutate?.(project)
  const store = createProjectStore(project)
  const tool = createArchitectureTools({ store, getFacade: () => getWorkspaceFacade(store) })[0] as WebMcpToolDefinition
  const call = (input: unknown) => tool.execute(input) as Envelope
  return { store, tool, call }
}

describe('edit_architecture WebMCP tool', () => {
  beforeEach(() => appStateStore.getState().reset())
  it('commits ordered granular edits as one validated, undoable transaction', () => {
    const { store, call } = setup()
    const before = structuredClone(getActiveVariant(store.getState()).architecture)

    const result = call({
      expectedRevision: 0,
      intent: 'Model the structural survey',
      operations: [
        { type: 'update_room', patch: { widthMm: 7000, depthMm: 5000, wallHeightMm: 3000 } },
        { type: 'add_opening', opening: { id: 'pass', label: 'Pass', kind: 'service-window', wall: 'top', segmentIndex: 0, offsetMm: 1200, widthMm: 1000, flow: 'clean-out' } },
        { type: 'update_opening', id: 'pass', patch: { sillHeightMm: 900, heightMm: 1100 } },
        { type: 'add_pillar', pillar: { id: 'column-a', xMm: 2400, yMm: 1800, widthMm: 350, depthMm: 350 } },
        { type: 'update_pillar', id: 'column-a', patch: { widthMm: 400, depthMm: 400 } },
        { type: 'add_storage_zone', storageZone: { id: 'dry-store', label: 'Dry store', xMm: 4000, yMm: 1000, widthMm: 1800, depthMm: 1200, adjacent: true } },
        { type: 'update_storage_zone', id: 'dry-store', patch: { label: 'Bulk dry store', adjacent: false } },
        { type: 'remove_opening', id: 'main-entry' },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      variantId: 'layout-a',
      changedIds: ['room', 'pass', 'column-a', 'dry-store', 'main-entry'],
    })
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().revisionEntries).toContainEqual(expect.objectContaining({
      revision: 1,
      author: 'agent',
      intent: 'Model the structural survey',
      variantIds: ['layout-a'],
    }))
    expect(appStateStore.getState().lastAgentAction).toMatchObject({
      revision: 1,
      intent: 'Model the structural survey',
    })
    expect(getActiveVariant(store.getState()).architecture).toMatchObject({
      widthMm: 7000,
      depthMm: 5000,
      wallHeightMm: 3000,
      openings: [{ id: 'pass', sillHeightMm: 900, heightMm: 1100 }],
      pillars: [{ id: 'column-a', widthMm: 400, depthMm: 400 }],
      storageZones: [{ id: 'dry-store', label: 'Bulk dry store', adjacent: false }],
    })
    expect(store.getState().project.architecture).toEqual(getActiveVariant(store.getState()).architecture)

    store.getState().undo()
    expect(getActiveVariant(store.getState()).architecture).toEqual(before)
  })

  it('rejects stale revisions and leaves the project untouched', () => {
    const { store, call } = setup()
    const before = store.getState().project
    expect(call({
      expectedRevision: 3,
      operations: [{ type: 'remove_opening', id: 'main-entry' }],
    })).toMatchObject({ ok: false, revision: 0, code: 'stale-revision' })
    expect(store.getState().project).toBe(before)
    expect(store.getState().past).toHaveLength(0)
  })

  it('removes pillars and storage zones by stable ID', () => {
    const { store, call } = setup((project) => {
      const architecture = project.variants[0].architecture
      architecture.pillars = [{ id: 'old-column', xMm: 1000, yMm: 1000, widthMm: 300, depthMm: 300 }]
      architecture.storageZones = [{ id: 'old-zone', label: 'Old zone', xMm: 2000, yMm: 1000, widthMm: 1000, depthMm: 800, adjacent: false }]
      project.architecture = structuredClone(architecture)
    })

    expect(call({
      expectedRevision: 0,
      operations: [
        { type: 'remove_pillar', id: 'old-column' },
        { type: 'remove_storage_zone', id: 'old-zone' },
      ],
    })).toMatchObject({ ok: true, revision: 1, changedIds: ['old-column', 'old-zone'] })
    expect(getActiveVariant(store.getState()).architecture).toMatchObject({ pillars: [], storageZones: [] })
    expect(store.getState().past).toHaveLength(1)
  })

  it('rejects the whole batch when a later granular edit is invalid', () => {
    const { store, call } = setup()
    const before = structuredClone(store.getState().project)
    const result = call({
      expectedRevision: 0,
      operations: [
        { type: 'add_pillar', pillar: { id: 'new-column', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 } },
        { type: 'update_opening', id: 'missing', patch: { widthMm: 1200 } },
      ],
    })
    expect(result).toMatchObject({ ok: false, code: 'missing-architecture-element', details: { operationIndex: 1 } })
    expect(store.getState().project).toEqual(before)
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('honors whole-architecture and per-element locks', () => {
    const whole = setup((project) => {
      project.architecture.locked = true
      project.variants[0].architecture.locked = true
    })
    expect(whole.call({ expectedRevision: 0, operations: [{ type: 'remove_opening', id: 'main-entry' }] }))
      .toMatchObject({ ok: false, code: 'locked-architecture' })

    const element = setup((project) => {
      project.variants[0].layoutConstraints = { lockedArchitectureElementIds: ['main-entry'] }
    })
    expect(element.call({ expectedRevision: 0, operations: [{ type: 'remove_opening', id: 'main-entry' }] }))
      .toMatchObject({ ok: false, code: 'locked-architecture-element', details: { operationIndex: 0 } })
    expect(element.store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('requires explicit polygon geometry before resizing a non-rectangular room', () => {
    const { store, call } = setup((project) => {
      const architecture = project.variants[0].architecture
      architecture.roomPolygon = [
        { x: 0, y: 0 }, { x: 6200, y: 0 }, { x: 6200, y: 3000 },
        { x: 5000, y: 3000 }, { x: 5000, y: 4800 }, { x: 0, y: 4800 },
      ]
      project.architecture = structuredClone(architecture)
    })
    expect(call({ expectedRevision: 0, operations: [{ type: 'update_room', patch: { widthMm: 7000 } }] }))
      .toMatchObject({ ok: false, code: 'room-polygon-required' })
    expect(store.getState().revision).toBe(0)

    expect(call({
      expectedRevision: 0,
      operations: [{ type: 'update_room', patch: {
        roomPolygon: [
          { xMm: 0, yMm: 0 }, { xMm: 7000, yMm: 0 }, { xMm: 7000, yMm: 3000 },
          { xMm: 5000, yMm: 3000 }, { xMm: 5000, yMm: 4800 }, { xMm: 0, yMm: 4800 },
        ],
      } }],
    })).toMatchObject({ ok: true, revision: 1 })
    expect(getActiveVariant(store.getState()).architecture.widthMm).toBe(7000)
  })

  it('exposes strict schemas and rejects unknown fields or duplicate cross-kind IDs', () => {
    const { store, tool, call } = setup()
    expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false })
    expect(call({ expectedRevision: 0, operations: [{ type: 'remove_opening', id: 'main-entry', surprise: true }] }))
      .toMatchObject({ ok: false, code: 'invalid-input' })
    expect(call({
      expectedRevision: 0,
      operations: [{ type: 'add_pillar', pillar: { id: 'main-entry', xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 } }],
    })).toMatchObject({ ok: false, code: 'duplicate-id', details: { operationIndex: 0 } })
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })
})
