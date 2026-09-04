import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import type { WebMcpToolDefinition } from './model-context'
import type { WebMcpToolResult } from './tool-result'
import { createWebMcpController, REGISTRATION_RETRY_DELAYS_MS } from './webmcp-controller'

type CapturedTool = WebMcpToolDefinition & { signal?: AbortSignal }

const createFakeDetection = () => {
  const captured: CapturedTool[] = []
  const registerTool = vi.fn((tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => {
    captured.push({ ...tool, signal: options?.signal })
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
  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers every tool and reports availability', async () => {
    const fake = createFakeDetection()
    const store = createProjectStore(createSeedProject())
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    expect(controller.getStatus()).toBe('available')
    const toolCount = controller.getTools().length
    expect(controller.getStatusMessage()).toContain(`Registered ${toolCount} agent tools`)
    expect(fake.captured).toHaveLength(toolCount)
    controller.dispose()
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
    controller.dispose()
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
    controller.dispose()
  })

  it('wraps execute with activity records and caps the feed', async () => {
    const { store } = setup()
    const fake = createFakeDetection()
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    const guide = fake.captured.find((tool) => tool.name === 'get_workspace_guide')!
    const result = await guide.execute({}) as WebMcpToolResult
    const payload = result.structuredContent as { ok: boolean; revision: number }
    expect(payload.ok).toBe(true)
    const activity = controller.getActivity()
    expect(activity).toHaveLength(1)
    expect(activity[0]).toMatchObject({ tool: 'get_workspace_guide', ok: true, revision: payload.revision })

    const preview = fake.captured.find((tool) => tool.name === 'preview_layout_changes')!
    for (let index = 0; index < 35; index += 1) {
      await preview.execute({ expectedRevision: 0, operations: [{ type: 'nudge_components', variantId: store.getState().project.activeVariantId, componentIds: ['tandoor'], delta: { xMm: 10, yMm: 10 } }] })
    }
    expect(controller.getActivity()).toHaveLength(30)
    expect(controller.getActivity()[0].summary.length).toBeLessThanOrEqual(200)
    controller.dispose()
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
    controller.dispose()
  })

  it('exposes a starter prompt naming the core tools', () => {
    const { controller } = setup()
    const prompt = controller.getStarterPrompt()
    expect(prompt.startsWith("Use this page's site tools")).toBe(true)
    expect(prompt).toMatch(/Choose a focused tool sequence/)
    expect(prompt).not.toMatch(/\bCall\b/)
    expect(prompt).toMatch(/get_workspace_guide/)
    expect(prompt).toMatch(/preview_layout_changes/)
    expect(prompt).toMatch(/apply_layout_changes/)
    expect(prompt).toMatch(/set_app_view/)
    expect(prompt).toMatch(/select_components/)
    expect(prompt).toMatch(/check_operational_essentials/)
    expect(prompt).toMatch(/run_simulation/)
    expect(prompt).toMatch(/export_project/)
  })

  it('retries unavailable registration at the bounded absolute schedule', async () => {
    vi.useFakeTimers()
    const { store } = setup()
    const detect = vi.fn(() => ({ available: false as const, reason: 'not ready' }))
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect })

    await controller.register()
    expect(detect).toHaveBeenCalledTimes(1)
    let elapsed = 0
    for (const deadline of REGISTRATION_RETRY_DELAYS_MS.slice(1)) {
      await vi.advanceTimersByTimeAsync(deadline - elapsed)
      elapsed = deadline
      expect(detect).toHaveBeenCalledTimes(REGISTRATION_RETRY_DELAYS_MS.indexOf(deadline) + 1)
    }
    await vi.advanceTimersByTimeAsync(10_000)
    expect(detect).toHaveBeenCalledTimes(REGISTRATION_RETRY_DELAYS_MS.length)
    controller.dispose()
  })

  it('re-registers all tools when a persisted page is restored from bfcache', async () => {
    const fake = createFakeDetection()
    const { store } = setup()
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => fake.detection })
    await controller.register()
    const initialSignals = fake.captured.map((tool) => tool.signal)
    const toolCount = initialSignals.length

    const pageShow = new Event('pageshow') as PageTransitionEvent
    Object.defineProperty(pageShow, 'persisted', { value: true })
    window.dispatchEvent(pageShow)
    await vi.waitFor(() => expect(fake.captured).toHaveLength(toolCount * 2))

    expect(initialSignals.every((signal) => signal?.aborted)).toBe(true)
    expect(controller.getStatus()).toBe('available')
    controller.dispose()
  })

  it('reconciles a tool removed from the model context after toolchange', async () => {
    const store = createProjectStore(createSeedProject())
    const captured: CapturedTool[] = []
    const registeredNames = new Set<string>()
    let toolChangeListener: (() => void) | undefined
    const detection = {
      available: true as const,
      surface: 'document' as const,
      registerTool: vi.fn((tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => {
        captured.push({ ...tool, signal: options?.signal })
        registeredNames.add(tool.name)
        return Promise.resolve()
      }),
      getTools: () => Promise.resolve([...registeredNames].map((name) => ({ name }))),
      subscribeToolChanges: (listener: () => void) => {
        toolChangeListener = listener
        return () => { toolChangeListener = undefined }
      },
    }
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => detection })
    await controller.register()
    const original = captured.find((tool) => tool.name === 'get_layout')!
    const initialCallCount = detection.registerTool.mock.calls.length

    registeredNames.delete('get_layout')
    toolChangeListener?.()
    await vi.waitFor(() => expect(detection.registerTool).toHaveBeenCalledTimes(initialCallCount + 1))

    expect(original.signal?.aborted).toBe(true)
    expect(captured.filter((tool) => tool.name === 'get_layout')).toHaveLength(2)
    expect(controller.getStatus()).toBe('available')
    controller.dispose()
  })
})
