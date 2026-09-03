import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { runSimulation } from '../simulation/engine'
import { SimulationRunCancelledError } from '../simulation/responsive-runner'
import type { SimulationInput, SimulationResult } from '../simulation/types'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import { createSimulationRunStore, selectSimulationRun } from '../state/simulation-run-store'
import { recoveryForErrorCode } from './error-taxonomy'
import { createRunTools } from './webmcp-run-tools'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const runStore = createSimulationRunStore()
  const pending = deferred<SimulationResult>()
  let capturedInput: SimulationInput | undefined
  const runSimulationDependency = vi.fn((input: SimulationInput) => {
    capturedInput = input
    return pending.promise
  })
  const tool = createRunTools({
    store,
    runStore,
    getFacade: () => getWorkspaceFacade(store),
    runSimulation: runSimulationDependency,
  }).find((candidate) => candidate.name === 'run_simulation')!
  const finish = () => {
    if (!capturedInput) throw new Error('Simulation did not start')
    pending.resolve(runSimulation(capturedInput))
  }
  return { store, runStore, tool, finish, runSimulationDependency }
}

describe('run_simulation concurrency', () => {
  beforeEach(() => appStateStore.getState().reset())

  it('normalizes an already-aborted request to the stable cancellation taxonomy', async () => {
    const { runStore, tool, runSimulationDependency } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(tool.execute({}, { signal: controller.signal })).resolves.toMatchObject({
      ok: false,
      revision: 0,
      code: 'cancelled',
      recovery: recoveryForErrorCode('cancelled'),
    })
    expect(runSimulationDependency).not.toHaveBeenCalled()
    expect(runStore.getState().runs).toEqual({})
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', requestedSimulationRun: null })
  })

  it('normalizes cancellation raised during computation and does not publish a run', async () => {
    const store = createProjectStore(createSeedProject())
    const runStore = createSimulationRunStore()
    const tool = createRunTools({
      store,
      runStore,
      getFacade: () => getWorkspaceFacade(store),
      runSimulation: async () => { throw new SimulationRunCancelledError() },
    }).find((candidate) => candidate.name === 'run_simulation')!

    await expect(tool.execute({})).resolves.toMatchObject({
      ok: false,
      revision: 0,
      code: 'cancelled',
      recovery: recoveryForErrorCode('cancelled'),
    })
    expect(runStore.getState().runs).toEqual({})
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', requestedSimulationRun: null })
  })

  it('discards a completed result when aborted before publication', async () => {
    const store = createProjectStore(createSeedProject())
    const runStore = createSimulationRunStore()
    const controller = new AbortController()
    const tool = createRunTools({
      store,
      runStore,
      getFacade: () => getWorkspaceFacade(store),
      runSimulation: async (input) => {
        const result = runSimulation(input)
        controller.abort()
        return result
      },
    }).find((candidate) => candidate.name === 'run_simulation')!

    await expect(tool.execute({}, { signal: controller.signal })).resolves.toMatchObject({
      ok: false,
      revision: 0,
      code: 'cancelled',
      recovery: recoveryForErrorCode('cancelled'),
    })
    expect(runStore.getState().runs).toEqual({})
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', requestedSimulationRun: null })
  })

  it('discards a Worker result when the document revision changes before completion', async () => {
    const { store, runStore, tool, finish } = setup()
    const execution = tool.execute({})
    store.getState().nudgeItems(['tandoor'], { x: 50, y: 0 })
    finish()

    await expect(execution).resolves.toMatchObject({
      ok: false,
      revision: 1,
      code: 'stale-revision',
      recovery: recoveryForErrorCode('stale-revision'),
    })
    expect(runStore.getState().runs).toEqual({})
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', requestedSimulationRun: null })
  })

  it('discards a Worker result when the open document is replaced before completion', async () => {
    const { store, runStore, tool, finish } = setup()
    const execution = tool.execute({})
    store.getState().replaceProject(createSeedProject())
    finish()

    await expect(execution).resolves.toMatchObject({
      ok: false,
      revision: 0,
      code: 'wrong-document',
      recovery: recoveryForErrorCode('wrong-document'),
    })
    expect(runStore.getState().runs).toEqual({})
    expect(appStateStore.getState()).toMatchObject({ stage: 'space', requestedSimulationRun: null })
  })

  it('stores playback-none work as compact history without replacing the active full result', async () => {
    const { store, runStore, tool, finish } = setup()
    const project = store.getState().project
    const activeResult = runSimulation({
      architecture: project.variants[0].architecture,
      equipment: project.variants[0].equipment,
      scenario: { ...project.scenarios[0], covers: 2, durationMinutes: 5 },
    })
    runStore.getState().storeRun({
      variantId: 'visible-layout',
      scenarioId: 'visible-scenario',
      result: activeResult,
      seed: activeResult.seed,
      ranAtRevision: 0,
    })

    const execution = tool.execute({ playback: 'none', navigateTo: false })
    finish()
    await expect(execution).resolves.toMatchObject({ ok: true })

    expect(selectSimulationRun(runStore.getState(), 'visible-layout', 'visible-scenario')?.result).toBe(activeResult)
    expect(selectSimulationRun(runStore.getState(), project.activeVariantId, project.activeScenarioId)?.result.frames).toEqual([])
  })
})
