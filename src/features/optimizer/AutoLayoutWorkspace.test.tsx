import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { canonicalLayoutHash } from '../../optimizer/canonical-layout'
import type { EvaluatedCandidate, OptimizerManifest } from '../../optimizer/types'
import { createProjectStore } from '../../state/project-store'
import {
  AutoLayoutWorkspace,
  type AutoLayoutProgress,
  type AutoLayoutRunResult,
  type AutoLayoutRunner,
} from './AutoLayoutWorkspace'

const candidate = (id: string, score: Partial<EvaluatedCandidate['score']> = {}): EvaluatedCandidate & { serviceMetrics: { completionPct: number; throughputPerHour: number } } => {
  const variant = structuredClone(createSeedProject().variants[0])
  variant.equipment.find((item) => item.id === 'tandoor')!.xMm += id === 'candidate-minimal' ? 0 : 200
  return {
    id,
    hash: `hash-${id}`,
    variant,
    score: {
      unfinishedOrders: 0,
      p90WaitSeconds: 720,
      peakBacklog: 4,
      totalTravelMm: 12_000,
      congestionEvents: 2,
      changeCost: 1,
      ...score,
    },
    evaluatedSeeds: [3, 5],
    confirmationSeeds: [101],
    diff: {
      moved: id === 'candidate-minimal' ? [] : ['tandoor'],
      rotated: id === 'candidate-travel' ? ['two-door-fridge'] : [],
      resized: [],
      substituted: [],
      added: [],
      removed: [],
      architectureChanged: false,
    },
    serviceMetrics: { completionPct: 100, throughputPerHour: 42 },
  }
}

const runResult = (manifest: OptimizerManifest): AutoLayoutRunResult => {
  const finalists = [
    candidate('candidate-fastest', { p90WaitSeconds: 600, totalTravelMm: 13_000 }),
    candidate('candidate-travel', { p90WaitSeconds: 800, totalTravelMm: 9_000, changeCost: 2 }),
    candidate('candidate-minimal', { p90WaitSeconds: 900, totalTravelMm: 14_000, changeCost: 0 }),
  ]
  return {
    manifest,
    candidates: finalists,
    finalists,
    evaluationCount: 12,
    termination: 'exhausted',
    bestObservedDisclaimer: 'These are the best observed feasible layouts under this frozen manifest and budget, not universal optima.',
  }
}

const runner = (progress?: AutoLayoutProgress): AutoLayoutRunner => ({
  run: vi.fn(async (request, onProgress) => {
    if (progress) onProgress(progress)
    return runResult(request.manifest)
  }),
  cancel: vi.fn(),
})

describe('auto-layout workspace', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('collects demand, staffing, A/B/C permissions, locks, hard rules, SLA, and budget', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    const injected = runner()
    render(<AutoLayoutWorkspace store={store} runner={injected} />)

    await user.clear(screen.getByLabelText('Covers'))
    await user.type(screen.getByLabelText('Covers'), '180')
    await user.clear(screen.getByLabelText('Peak duration (minutes)'))
    await user.type(screen.getByLabelText('Peak duration (minutes)'), '90')
    await user.clear(screen.getByLabelText('Head chef count'))
    await user.type(screen.getByLabelText('Head chef count'), '2')
    await user.click(screen.getByRole('checkbox', { name: /B.*resize, substitute/i }))
    await user.click(screen.getByRole('checkbox', { name: /Lock Tandoor/i }))
    await user.clear(screen.getByLabelText('Minimum aisle (mm)'))
    await user.type(screen.getByLabelText('Minimum aisle (mm)'), '1100')
    await user.click(screen.getByRole('button', { name: 'Add no-go zone' }))
    await user.clear(screen.getByLabelText('Target P90 wait (minutes)'))
    await user.type(screen.getByLabelText('Target P90 wait (minutes)'), '14')
    await user.clear(screen.getByLabelText('Maximum evaluations'))
    await user.type(screen.getByLabelText('Maximum evaluations'), '80')
    await user.clear(screen.getByLabelText('Time budget (seconds)'))
    await user.type(screen.getByLabelText('Time budget (seconds)'), '20')
    await user.selectOptions(screen.getByLabelText('Priority'), 'service')
    await user.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    expect(injected.run).toHaveBeenCalledOnce()
    const request = vi.mocked(injected.run).mock.calls[0][0]
    expect(request.scenario).toMatchObject({ covers: 180, durationMinutes: 90, staff: expect.arrayContaining([{ role: 'head-chef', count: 2 }]) })
    expect(request.manifest).toMatchObject({
      permissions: { placement: true, equipmentRedesign: true, architecture: false },
      lockedComponentIds: ['tandoor'],
      hardRules: { minimumAisleMm: 1100, noGoZones: [expect.objectContaining({ id: expect.any(String) })] },
      targetP90WaitSeconds: 840,
      budget: { maxEvaluations: 80, maxDurationMs: 20_000 },
      priority: 'service',
    })
  })

  it('shows detailed progress, baseline, named finalists, deltas, seeds, diffs, and exact manifest', async () => {
    const progress: AutoLayoutProgress = {
      phase: 'simulation', feasibleCandidates: 12, prunedCandidates: 8, simulatedCandidates: 4,
      candidateCount: 20, elapsedMs: 1250, bestObserved: 'candidate-fastest',
    }
    render(<AutoLayoutWorkspace store={createProjectStore(createSeedProject())} runner={runner(progress)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    expect(await screen.findByText('12 feasible')).toBeInTheDocument()
    expect(screen.getByText('8 pruned')).toBeInTheDocument()
    expect(screen.getByText('4 simulated')).toBeInTheDocument()
    expect(screen.getByText(/1.25 s elapsed/i)).toBeInTheDocument()
    expect(screen.getByText(/current best observed.*candidate-fastest/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Baseline' })).toBeInTheDocument()

    for (const name of ['Fastest service', 'Least travel', 'Minimal change']) {
      const card = screen.getByTestId(`finalist-${name.toLowerCase().replaceAll(' ', '-')}`)
      expect(within(card).getByRole('heading', { name })).toBeInTheDocument()
      expect(within(card).getByText(/Hard feasible/i)).toBeInTheDocument()
      expect(within(card).getByText(/P90 wait/i)).toBeInTheDocument()
      expect(within(card).getByText(/Throughput/i)).toBeInTheDocument()
      expect(within(card).getAllByText(/Seeds.*3, 5.*101/i).length).toBeGreaterThan(0)
      expect(within(card).getByText(/moved.*rotated.*change cost/i)).toBeInTheDocument()
    }
    expect(screen.getByText(/best observed feasible layouts.*not universal optima/i)).toBeInTheDocument()
    expect(screen.getAllByText(/"baselineVariantId": "baseline-trace"/i).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Inspect Fastest service' }))
    expect(screen.getByLabelText('Layout preview viewer')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Preview view')).getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(screen.getByLabelText('Preview view')).getByRole('button', { name: '3D' }))
    expect(screen.getByLabelText('3D kitchen workspace')).toBeInTheDocument()
    await userEvent.click(within(screen.getByLabelText('Preview view')).getByRole('button', { name: 'Walk' }))
    expect(screen.getByRole('button', { name: 'Walk kitchen' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Compare Least travel' }))
    expect(screen.getByRole('img', { name: 'Baseline comparison plan' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Finalist comparison plan' })).toBeInTheDocument()
  })

  it('reconciles completion progress with exact search statistics from the Worker', async () => {
    const injected: AutoLayoutRunner = {
      run: vi.fn(async (request, onProgress) => {
        onProgress({ phase: 'simulation', feasibleCandidates: 4, prunedCandidates: 0, simulatedCandidates: 1, candidateCount: 4, elapsedMs: 900 })
        return {
          ...runResult(request.manifest),
          searchStats: {
            generatedCandidates: 25, uniqueCandidates: 20, infeasibleCandidates: 5,
            prunedCandidates: 6, evaluatedCandidates: 9,
            evaluationCacheEntries: 30, evaluationCacheHits: 3,
          },
        }
      }),
    }
    render(<AutoLayoutWorkspace store={createProjectStore(createSeedProject())} runner={injected} />)

    await userEvent.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    expect(await screen.findByText('15 feasible')).toBeInTheDocument()
    expect(screen.getByText('6 pruned')).toBeInTheDocument()
    expect(screen.getByText('9 simulated')).toBeInTheDocument()
    expect(screen.getByText('20 candidates')).toBeInTheDocument()
  })

  it('explains feasibility and simulation rejection reasons when no finalist can be confirmed', async () => {
    const injected: AutoLayoutRunner = {
      run: vi.fn(async (request) => ({
        manifest: request.manifest,
        candidates: [],
        finalists: [],
        evaluationCount: 2,
        termination: 'evaluation-budget' as const,
        bestObservedDisclaimer: 'Best observed only.',
        diagnostics: {
          feasibilityReasonCounts: { 'no-go-overlap': 7, 'station-unreachable': 3 },
          simulationRejectionCount: 2,
          simulationRejectionMessages: ['route-station-unreachable: Tandoor'],
        },
      })),
    }
    render(<AutoLayoutWorkspace store={createProjectStore(createSeedProject())} runner={injected} />)

    await userEvent.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    const diagnosis = await screen.findByRole('alert', { name: 'No feasible auto-layout finalists' })
    expect(diagnosis).toHaveTextContent(/no confirmed feasible finalist/i)
    expect(diagnosis).toHaveTextContent(/no-go-overlap.*7/i)
    expect(diagnosis).toHaveTextContent(/station-unreachable.*3/i)
    expect(diagnosis).toHaveTextContent(/2 candidates were rejected by simulation/i)
    expect(diagnosis).toHaveTextContent(/route-station-unreachable.*Tandoor/i)
  })

  it('computes deltas from the candidate matching the frozen baseline hash, regardless of result order', async () => {
    const injected: AutoLayoutRunner = {
      run: vi.fn(async (request) => {
        const fastest = candidate('candidate-fastest', { p90WaitSeconds: 600 })
        const actualBaseline = candidate('candidate-baseline', { p90WaitSeconds: 900 })
        actualBaseline.variant = structuredClone(request.baseline)
        actualBaseline.hash = canonicalLayoutHash(request.baseline)
        return {
          ...runResult(request.manifest),
          candidates: [fastest, candidate('candidate-travel'), actualBaseline],
          finalists: [fastest],
        }
      }),
    }
    render(<AutoLayoutWorkspace store={createProjectStore(createSeedProject())} runner={injected} />)

    await userEvent.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    const fastest = await screen.findByTestId('finalist-fastest-service')
    expect(within(fastest).getByText(/10 min \(-300 s\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Improvement versus current layout')).toHaveTextContent(/better p90 wait/i)
    expect(screen.getByLabelText('Improvement versus current layout')).toHaveTextContent(/Layout A/i)
  })

  it('keeps inspect and compare non-mutating', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    const before = structuredClone(store.getState().project)
    render(<AutoLayoutWorkspace store={store} runner={runner()} />)
    await user.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    await user.click(await screen.findByRole('button', { name: 'Inspect Fastest service' }))
    expect(screen.getByRole('region', { name: 'Inspected finalist' })).toHaveTextContent('candidate-fastest')
    await user.click(screen.getByRole('button', { name: 'Inspect Least travel' }))
    expect(screen.getByRole('region', { name: 'Inspected finalist' })).toHaveTextContent('candidate-travel')
    await user.click(screen.getByRole('button', { name: 'Compare Least travel' }))
    expect(screen.getByRole('region', { name: 'Finalist comparison' })).toHaveTextContent('candidate-travel')
    expect(store.getState().project).toEqual(before)
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('cancels an active search without mutating the project', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    const before = structuredClone(store.getState().project)
    const injected: AutoLayoutRunner = {
      run: vi.fn(() => new Promise<AutoLayoutRunResult>(() => undefined)),
      cancel: vi.fn(),
    }
    render(<AutoLayoutWorkspace store={store} runner={injected} />)

    await user.click(screen.getByRole('button', { name: 'Run auto-layout' }))
    await user.click(screen.getByRole('button', { name: 'Cancel auto-layout' }))

    expect(injected.cancel).toHaveBeenCalledOnce()
    expect(store.getState().project).toEqual(before)
    expect(store.getState()).toMatchObject({ revision: 0, past: [] })
  })

  it('saves one finalist as exactly one parented variant and one history entry', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'adopted' })
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    render(<AutoLayoutWorkspace store={store} runner={runner()} now={() => '2026-09-02T00:00:00.000Z'} />)
    await user.click(screen.getByRole('button', { name: 'Run auto-layout' }))
    await user.click(await screen.findByRole('button', { name: 'Save Fastest service as new layout' }))

    expect(screen.getByRole('status')).toHaveTextContent(/saved as a new layout/i)
    expect(store.getState()).toMatchObject({ revision: 1 })
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().project.variants).toHaveLength(2)
    expect(store.getState().project.variants[1]).toMatchObject({
      id: 'layout-adopted',
      name: 'Fastest service',
      parentId: 'baseline-trace',
      adoptedExperimentManifest: {
        id: 'experiment-adopted',
        baselineVariantId: 'baseline-trace',
        finalistId: 'candidate-fastest',
        createdAt: '2026-09-02T00:00:00.000Z',
        seeds: [3, 5],
        confirmationSeeds: [101],
        objective: 'fastest-service',
        resultHash: 'hash-candidate-fastest',
      },
    })
  })

  it('saves the best finalist and opens it in the full comparison workspace', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'compare-adopted' })
    const store = createProjectStore(createSeedProject())
    const onCompareLayouts = vi.fn()
    render(<AutoLayoutWorkspace store={store} runner={runner()} onCompareLayouts={onCompareLayouts} />)
    await userEvent.click(screen.getByRole('button', { name: 'Run auto-layout' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Save best observed and compare side by side' }))

    expect(store.getState().project.variants).toHaveLength(2)
    expect(onCompareLayouts).toHaveBeenCalledWith('baseline-trace', 'layout-compare-adopted')
  })

  it('refuses to adopt a result after the workspace revision changes', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    render(<AutoLayoutWorkspace store={store} runner={runner()} />)
    await user.click(screen.getByRole('button', { name: 'Run auto-layout' }))
    store.getState().rotateItems(['tandoor'], 90)
    await user.click(await screen.findByRole('button', { name: 'Save Fastest service as new layout' }))

    expect(screen.getByRole('status')).toHaveTextContent(/revision/i)
    expect(store.getState().project.variants).toHaveLength(1)
  })
})
