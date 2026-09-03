import { describe, expect, it } from 'vitest'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { createSeedProject } from '../domain/seed-project'
import type { AnytimeSearchResult, OptimizerManifest } from '../optimizer/types'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import type { WebMcpToolDefinition } from './model-context'
import { createLayoutIntelligenceTools } from './webmcp-layout-intelligence-tools'

type Envelope = { ok: boolean; revision: number; code?: string } & Record<string, unknown>

const byName = (tools: WebMcpToolDefinition[], name: string): WebMcpToolDefinition => {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('WebMCP layout intelligence tools', () => {
  it('compares two saved layouts with one scenario seed and optionally opens Compare', async () => {
    const project = createSeedProject()
    const candidate = structuredClone(project.variants[0])
    candidate.id = 'candidate-layout'
    candidate.name = 'Layout B'
    project.variants.push(candidate)
    const store = createProjectStore(project)
    const tools = createLayoutIntelligenceTools({ store, getFacade: () => getWorkspaceFacade(store) })
    appStateStore.getState().reset()

    const result = await byName(tools, 'compare_layouts').execute({
      baselineVariantId: project.variants[0].id,
      candidateVariantId: candidate.id,
      openOverlay: true,
    }) as Envelope

    expect(result).toMatchObject({
      ok: true,
      revision: 0,
      baseline: { variantId: project.variants[0].id },
      candidate: { variantId: candidate.id },
      scenario: { id: project.activeScenarioId, seed: project.scenarios[0].seed },
      spatial: { moved: [], changeCost: 0 },
      overlayOpened: true,
      metricDeltas: expect.any(Array),
      findings: expect.any(Array),
    })
    expect((result.metricDeltas as { delta: number }[]).every((metric) => metric.delta === 0)).toBe(true)
    expect(appStateStore.getState().overlay).toBe('compare')
    expect(store.getState().revision).toBe(0)
  })

  it('validates comparison targets before running either simulation', async () => {
    const store = createProjectStore(createSeedProject())
    let simulations = 0
    const base = getWorkspaceFacade(store)
    const facade = { ...base, runSimulation: () => { simulations += 1; throw new Error('should not run') } } as WorkspaceFacade
    const tools = createLayoutIntelligenceTools({ store, getFacade: () => facade })
    const compare = byName(tools, 'compare_layouts')

    expect(await compare.execute({ baselineVariantId: 'missing', candidateVariantId: 'baseline-trace' })).toMatchObject({ ok: false, code: 'missing-variant' })
    expect(await compare.execute({ baselineVariantId: 'baseline-trace', candidateVariantId: 'baseline-trace' })).toMatchObject({ ok: false, code: 'same-variant' })
    expect(await compare.execute({ baselineVariantId: 'baseline-trace', candidateVariantId: 'other', rogue: true })).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(simulations).toBe(0)
  })

  it('starts, reports progress, and returns deterministic auto-layout finalists without mutating the project', async () => {
    const store = createProjectStore(createSeedProject())
    let resolveSearch!: (result: AnytimeSearchResult) => void
    let capturedManifest: OptimizerManifest | undefined
    const search = new Promise<AnytimeSearchResult>((resolve) => { resolveSearch = resolve })
    const base = getWorkspaceFacade(store)
    const facade = {
      ...base,
      runAutoLayout: (input: unknown) => {
        const request = input as {
          request: { manifest: OptimizerManifest }
          onProgress(progress: Record<string, unknown>): void
        }
        capturedManifest = request.request.manifest
        request.onProgress({ phase: 'simulation', simulatedCandidates: 6, candidateCount: 12, bestObserved: 'candidate-a' })
        return search
      },
    } as WorkspaceFacade
    const tools = createLayoutIntelligenceTools({ store, getFacade: () => facade, now: () => '2026-09-03T00:00:00.000Z' })

    const started = await byName(tools, 'run_auto_layout').execute({
      objective: 'travel',
      seed: 41,
      maxCandidates: 12,
      maxDurationMs: 2_000,
      openOverlay: false,
    }) as Envelope
    expect(started).toMatchObject({ ok: true, status: 'running', revision: 0, runId: 'auto-layout-0-1' })
    await nextTask()
    expect(capturedManifest).toMatchObject({
      id: 'auto-layout-0-1',
      revision: 0,
      baselineVariantId: 'baseline-trace',
      seeds: [41],
      confirmationSeeds: [42],
      priority: 'travel',
      budget: { maxEvaluations: 12, maxDurationMs: 2_000 },
    })

    const running = await byName(tools, 'get_auto_layout_run').execute({ runId: started.runId }) as Envelope
    expect(running).toMatchObject({
      ok: true,
      status: 'running',
      progressPct: expect.any(Number),
      progress: { phase: 'simulation', simulatedCandidates: 6, bestObserved: 'candidate-a' },
    })

    const variant = structuredClone(store.getState().project.variants[0])
    variant.equipment[0].xMm += 200
    const candidate = {
      id: 'candidate-a',
      hash: 'hash-a',
      variant,
      score: {
        unfinishedOrders: 0,
        p90WaitSeconds: 240,
        peakBacklog: 2,
        totalTravelMm: 12_000,
        congestionEvents: 1,
        changeCost: 1,
      },
      evaluatedSeeds: [41],
      confirmationSeeds: [42],
      diff: {
        moved: [variant.equipment[0].id], rotated: [], resized: [], substituted: [], added: [], removed: [], architectureChanged: false,
      },
    }
    resolveSearch({
      manifest: capturedManifest!,
      candidates: [candidate],
      finalists: [candidate],
      evaluationCount: 12,
      termination: 'evaluation-budget',
      bestObservedDisclaimer: 'Best observed within the configured budget.',
    })
    await nextTask()

    const completed = await byName(tools, 'get_auto_layout_run').execute({ runId: started.runId }) as Envelope
    expect(completed).toMatchObject({
      ok: true,
      status: 'completed',
      progressPct: 100,
      termination: 'evaluation-budget',
      evaluationCount: 12,
      finalists: [{ id: 'candidate-a', variant: { id: 'baseline-trace' } }],
    })
    expect(store.getState().revision).toBe(0)

    const adopted = await byName(tools, 'adopt_auto_layout_candidate').execute({
      runId: started.runId,
      resultId: 'candidate-a',
      expectedRevision: 0,
      newVariantId: 'agent-layout-b',
      name: 'Agent layout B',
    }) as Envelope
    expect(adopted).toMatchObject({
      ok: true,
      revision: 1,
      runId: started.runId,
      resultId: 'candidate-a',
      newVariantId: 'agent-layout-b',
    })
    expect(store.getState().project.variants.at(-1)).toMatchObject({
      id: 'agent-layout-b',
      name: 'Agent layout B',
      parentId: 'baseline-trace',
      adoptedExperimentManifest: {
        id: 'auto-layout-0-1',
        finalistId: 'candidate-a',
        createdAt: '2026-09-03T00:00:00.000Z',
        resultHash: 'hash-a',
      },
    })
    expect(store.getState().past).toHaveLength(1)
  })

  it('cancels active searches and preserves structured terminal status', async () => {
    const store = createProjectStore(createSeedProject())
    let cancelledRunId: string | undefined
    const base = getWorkspaceFacade(store)
    const facade = {
      ...base,
      runAutoLayout: () => new Promise(() => undefined),
      cancelRun: ({ runId }: { runId: string }) => { cancelledRunId = runId; return { ok: true } },
    } as WorkspaceFacade
    const tools = createLayoutIntelligenceTools({ store, getFacade: () => facade })
    const started = await byName(tools, 'run_auto_layout').execute({ openOverlay: false }) as Envelope
    await nextTask()

    expect(await byName(tools, 'cancel_auto_layout_run').execute({ runId: started.runId })).toMatchObject({
      ok: true,
      status: 'cancelled',
      revision: 0,
    })
    expect(cancelledRunId).toBe(started.runId)
    expect(await byName(tools, 'get_auto_layout_run').execute({ runId: started.runId })).toMatchObject({
      ok: true,
      status: 'cancelled',
      error: { code: 'cancelled' },
    })
    expect(await byName(tools, 'cancel_auto_layout_run').execute({ runId: started.runId })).toMatchObject({ ok: false, code: 'run-not-active' })
    expect(await byName(tools, 'get_auto_layout_run').execute({ runId: 'unknown' })).toMatchObject({ ok: false, code: 'run-not-found' })
  })

  it('uses strict schemas at every controlled object boundary', () => {
    const store = createProjectStore(createSeedProject())
    const tools = createLayoutIntelligenceTools({ store, getFacade: () => getWorkspaceFacade(store) })
    const runSchema = byName(tools, 'run_auto_layout').inputSchema
    expect(runSchema).toMatchObject({ type: 'object', additionalProperties: false })
    expect(runSchema.properties.permissions).toMatchObject({ type: 'object', additionalProperties: false })
  })
})
