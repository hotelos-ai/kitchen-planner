import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import { createWebMcpController } from './webmcp-controller'

type CapturedTool = { name: string; signal?: AbortSignal; execute: (input: unknown) => unknown }

const createFakeDetection = () => {
  const captured: CapturedTool[] = []
  const registerTool = vi.fn((tool: { name: string; execute: (input: unknown) => unknown }, options?: { signal?: AbortSignal }) => {
    captured.push({ name: tool.name, signal: options?.signal, execute: tool.execute })
    return Promise.resolve(undefined)
  })
  return {
    captured,
    detection: { available: true as const, surface: 'document' as const, registerTool },
  }
}

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const controller = createWebMcpController({
    store,
    getFacade: () => getWorkspaceFacade(store),
    now: () => '2026-09-03T00:00:00.000Z',
  })
  return { store, controller }
}

describe('webmcp controller', () => {
  it('registers every tool and reports availability', async () => {
    const fake = createFakeDetection()
    const store = createProjectStore(createSeedProject())
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    expect(controller.getStatus()).toBe('available')
    expect(controller.getStatusMessage()).toMatch(/11 agent tools/)
    expect(controller.getTools()).toHaveLength(11)
    expect(fake.captured).toHaveLength(11)
  })

  it('resolves as unavailable without throwing when WebMCP is missing', async () => {
    const { store } = setup()
    const controller = createWebMcpController({
      store,
      getFacade: () => getWorkspaceFacade(store),
      detect: () => ({ available: false, reason: 'not supported here' }),
    })
    await controller.register()
    expect(controller.getStatus()).toBe('unavailable')
    expect(controller.getStatusMessage()).toBe('not supported here')
  })

  it('reports partial registration when some tools fail', async () => {
    const store = createProjectStore(createSeedProject())
    const calls: string[] = []
    const detection = {
      available: true as const,
      surface: 'document' as const,
      registerTool: (tool: { name: string }) => {
        calls.push(tool.name)
        return tool.name === 'get_layout' ? Promise.reject(new Error('duplicate name')) : Promise.resolve(undefined)
      },
    }
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => detection })
    await controller.register()
    expect(controller.getStatus()).toBe('partial')
    expect(controller.getStatusMessage()).toMatch(/get_layout/)
  })

  it('wraps execute with activity records and caps the feed', async () => {
    const { store } = setup()
    const fake = createFakeDetection()
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    const guide = fake.captured.find((tool) => tool.name === 'get_workspace_guide')!
    const result = await guide.execute({}) as { ok: boolean; revision: number }
    expect(result.ok).toBe(true)
    const activity = controller.getActivity()
    expect(activity).toHaveLength(1)
    expect(activity[0]).toMatchObject({ tool: 'get_workspace_guide', ok: true, revision: result.revision })

    const preview = fake.captured.find((tool) => tool.name === 'preview_layout_changes')!
    for (let index = 0; index < 35; index += 1) {
      await preview.execute({ expectedRevision: 0, operations: [{ type: 'nudge_components', variantId: store.getState().project.activeVariantId, componentIds: ['tandoor'], delta: { xMm: 10, yMm: 10 } }] })
    }
    expect(controller.getActivity()).toHaveLength(30)
    expect(controller.getActivity()[0].summary.length).toBeLessThanOrEqual(200)
  })

  it('notifies subscribers on activity and disposes registrations strictly once', async () => {
    const { store } = setup()
    const fake = createFakeDetection()
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    await controller.register()
    const guide = fake.captured.find((tool) => tool.name === 'get_workspace_guide')!
    await guide.execute({})
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    controller.dispose()
    const abortedSignals = fake.captured.filter((tool) => tool.signal?.aborted).length
    expect(abortedSignals).toBe(fake.captured.length)
    expect(controller.getStatus()).toBe('idle')
  })

  it('re-registers cleanly after disposal without duplicate active tools', async () => {
    const { store } = setup()
    const fake = createFakeDetection()
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    controller.dispose()
    fake.captured.length = 0
    await controller.register()
    const names = fake.captured.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    expect(controller.getStatus()).toBe('available')
    const activeSignals = fake.captured.filter((tool) => !tool.signal?.aborted).length
    expect(activeSignals).toBe(names.length)
  })

  it('exposes a starter prompt naming the core tools', () => {
    const { controller } = setup()
    const prompt = controller.getStarterPrompt()
    expect(prompt).toMatch(/get_workspace_guide/)
    expect(prompt).toMatch(/preview_layout_changes/)
    expect(prompt).toMatch(/apply_layout_changes/)
    expect(prompt).toMatch(/export_project/)
  })
})
