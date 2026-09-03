import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore } from '../state/project-store'
import { createSimulationRunStore } from '../state/simulation-run-store'
import { resolveWorkspaceDeepLink } from '../app/workspace-deep-link'
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
      include: ['report', 'workspace-link'],
      variantIds: [store.getState().project.activeVariantId],
      simulationStatus: 'not-run',
      mimeType: expect.stringContaining('text/html'),
      downloaded: false,
      workspaceUrlScope: expect.stringContaining('without local persistence'),
    })
    expect(result.contents).toMatch(/<!doctype html>[\s\S]*<svg[\s\S]*Professional review required/)
    const url = new URL(result.workspaceUrl as string)
    expect(url.origin).toBe('https://example.test')
    expect(url.hash).toContain(`project=${encodeURIComponent(store.getState().project.id)}`)
    expect(url.hash).toContain('payload=')
    expect(url.hash).toContain('stage=equipment')
    expect(url.hash).toContain('view=split')
    expect(url.hash).toContain('overlay=compare')
  })

  it('scopes a multi-layout report and restores the first layout plus current selection', () => {
    const { store, call } = setup()
    const second = structuredClone(store.getState().project.variants[0])
    second.id = 'courtyard-option'
    second.name = 'Courtyard option'
    second.equipment[0].label = 'Courtyard fryer'
    const candidate = structuredClone(store.getState().project)
    candidate.variants.push(second)
    store.getState().commitProjectCandidate(candidate, 0, store.getState().documentId)
    store.getState().selectItems(['flat-top-fryer'])

    const result = call({
      include: ['report', 'workspace-link'],
      variantIds: ['courtyard-option', 'baseline-trace'],
      scenarioId: 'dinner-peak',
    })

    expect(result).toMatchObject({
      ok: true,
      variantId: 'courtyard-option',
      variantIds: ['courtyard-option', 'baseline-trace'],
      scenarioId: 'dinner-peak',
      simulationStatuses: [
        { variantId: 'courtyard-option', status: 'not-run' },
        { variantId: 'baseline-trace', status: 'not-run' },
      ],
    })
    expect(result.contents).toMatch(/data-variant-id="courtyard-option"[\s\S]*Courtyard fryer/)
    expect(result.contents).toMatch(/data-variant-id="baseline-trace"[\s\S]*Flat-top \+ fryer/)
    const url = new URL(result.workspaceUrl as string)
    expect(url.hash).toContain('variant=courtyard-option')
    expect(url.hash).toContain('select=flat-top-fryer')
  })

  it('can return only the requested artifact and accepts the deprecated variantId alias', () => {
    const { call } = setup()
    const reportOnly = call({ include: ['report'], variantId: 'baseline-trace' })
    expect(reportOnly).toMatchObject({ ok: true, variantIds: ['baseline-trace'], mimeType: expect.stringContaining('text/html') })
    expect(reportOnly).not.toHaveProperty('workspaceUrl')

    const linkOnly = call({ include: ['workspace-link'], returnContents: false })
    expect(linkOnly).toMatchObject({ ok: true, workspaceUrl: expect.stringContaining('#workspace=v2') })
    expect(linkOnly).not.toHaveProperty('contents')
    expect(linkOnly).not.toHaveProperty('filename')
  })

  it('supports section-level report includes while preserving the report shorthand', () => {
    const { call } = setup()
    const selected = call({ include: ['plan', 'assumptions'] })
    expect(selected).toMatchObject({
      ok: true,
      include: ['plan', 'assumptions'],
      reportSections: ['plan', 'assumptions'],
      mimeType: expect.stringContaining('text/html'),
    })
    expect(selected.contents).toMatch(/<h2>Plan<\/h2>[\s\S]*Scenario and menu assumptions/)
    expect(selected.contents).not.toMatch(/Simulation evidence|Ranked findings/)

    const all = call({ include: ['report'] })
    expect(all).toMatchObject({ reportSections: ['plan', 'metrics', 'findings', 'assumptions'] })
    expect(all.contents).toMatch(/<h2>Plan<\/h2>[\s\S]*Scenario and menu assumptions[\s\S]*Simulation evidence[\s\S]*Ranked findings/)
  })

  it('embeds the scoped project in workspace links for fresh-browser restoration', () => {
    const { store, call } = setup()
    const result = call({ include: ['workspace-link'] })
    const resolved = resolveWorkspaceDeepLink(new URL(result.workspaceUrl as string).hash)

    expect(resolved).toMatchObject({
      project: {
        id: store.getState().project.id,
        variants: [{ id: store.getState().project.activeVariantId }],
        scenarios: [{ id: store.getState().project.activeScenarioId }],
      },
      variantId: store.getState().project.activeVariantId,
    })
  })

  it('rejects invalid IDs and unknown fields without mutating the document', () => {
    const { store, call } = setup()
    expect(call({ variantId: 'missing' })).toMatchObject({ ok: false, code: 'missing-variant', revision: 0 })
    expect(call({ scenarioId: 'missing' })).toMatchObject({ ok: false, code: 'missing-scenario', revision: 0 })
    expect(call({ surprise: true })).toMatchObject({ ok: false, code: 'invalid-input', revision: 0 })
    expect(call({ variantId: 'baseline-trace', variantIds: ['baseline-trace'] })).toMatchObject({ ok: false, code: 'invalid-input', revision: 0 })
    expect(call({ include: ['workspace-link'], download: true })).toMatchObject({ ok: false, code: 'invalid-input', revision: 0 })
    expect(store.getState().revision).toBe(0)
  })
})
