import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore } from '../state/project-store'
import { createSimulationRunStore } from '../state/simulation-run-store'
import type { WebMcpToolDefinition } from './model-context'
import { createSharingTools } from './webmcp-sharing-tools'

describe('share_results WebMCP tool', () => {
  beforeEach(() => appStateStore.getState().reset())

  const setup = () => {
    const store = createProjectStore(createSeedProject())
    const runStore = createSimulationRunStore()
    const tool = createSharingTools({
      store,
      runStore,
      getHref: () => 'https://example.test/designer?embed=0',
    }).find((candidate) => candidate.name === 'share_results') as WebMcpToolDefinition
    return { store, runStore, call: (input: unknown) => tool.execute(input) as Record<string, unknown> }
  }

  it('returns a portable report and a scoped link to the current workspace state', () => {
    const { store, call } = setup()
    appStateStore.getState().setStage('equipment')
    appStateStore.getState().setView('split')
    appStateStore.getState().setOverlay('compare')
    const result = call({})

    expect(result).toMatchObject({
      ok: true,
      revision: 0,
      simulationStatus: 'not-run',
      mimeType: expect.stringContaining('text/html'),
      downloaded: false,
      workspaceUrlScope: expect.stringContaining('already saved'),
    })
    expect(result.contents).toMatch(/<!doctype html>[\s\S]*<svg[\s\S]*Professional review required/)
    const url = new URL(result.workspaceUrl as string)
    expect(url.origin).toBe('https://example.test')
    expect(url.hash).toContain(`project=${encodeURIComponent(store.getState().project.id)}`)
    expect(url.hash).toContain('stage=equipment')
    expect(url.hash).toContain('view=split')
    expect(url.hash).toContain('overlay=compare')
  })

  it('rejects invalid IDs and unknown fields without mutating the document', () => {
    const { store, call } = setup()
    expect(call({ variantId: 'missing' })).toMatchObject({ ok: false, code: 'missing-variant', revision: 0 })
    expect(call({ scenarioId: 'missing' })).toMatchObject({ ok: false, code: 'missing-scenario', revision: 0 })
    expect(call({ surprise: true })).toMatchObject({ ok: false, code: 'invalid-input', revision: 0 })
    expect(store.getState().revision).toBe(0)
  })
})
