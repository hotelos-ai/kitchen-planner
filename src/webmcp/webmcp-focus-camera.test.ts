import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore } from '../state/project-store'
import { createAppTools } from './webmcp-app-tools'

describe('focus_camera WebMCP tool', () => {
  beforeEach(() => appStateStore.getState().reset())

  it('reveals and frames a component without changing the revision', async () => {
    const store = createProjectStore(createSeedProject())
    const tool = createAppTools({ store }).find((candidate) => candidate.name === 'focus_camera')!
    const result = await tool.execute({ target: 'component', componentId: 'tandoor', cameraMode: 'perspective' }) as Record<string, unknown>

    expect(result).toMatchObject({ ok: true, revision: 0, stage: 'equipment', view: 'scene', cameraMode: 'perspective' })
    expect(store.getState().selectedIds).toEqual(['tandoor'])
    expect(store.getState().revision).toBe(0)
    expect(appStateStore.getState().cameraFocusRequest).toMatchObject({ target: 'component', componentId: 'tandoor' })
  })

  it('rejects missing targets and unknown components atomically', async () => {
    const store = createProjectStore(createSeedProject())
    const tool = createAppTools({ store }).find((candidate) => candidate.name === 'focus_camera')!
    expect(await tool.execute({ target: 'point' })).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await tool.execute({ target: 'component', componentId: 'missing' })).toMatchObject({ ok: false, code: 'unknown-component' })
    expect(appStateStore.getState().stage).toBe('space')
    expect(store.getState().selectedIds).toEqual([])
  })
})
