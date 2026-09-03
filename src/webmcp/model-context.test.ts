import { describe, expect, it, vi } from 'vitest'
import { detectModelContext, type WebMcpToolDefinition } from './model-context'

const surfaceWithRegisterTool = () => ({ registerTool: () => Promise.resolve(undefined) })

describe('detectModelContext', () => {
  it('reports unavailable when neither surface exposes registerTool', () => {
    const detection = detectModelContext({ document: {}, navigator: {}, isTopLevel: true, isSecureContext: true })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/modelContext/)
  })

  it('prefers the document surface over the deprecated navigator surface', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      navigator: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: true, surface: 'document' })
  })

  it('falls back to the navigator surface when document is missing', () => {
    const detection = detectModelContext({
      document: {},
      navigator: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: true, surface: 'navigator' })
  })

  it('refuses registration inside iframes', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: false,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/iframe/i)
  })

  it('refuses registration in insecure contexts', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: false,
    })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/secure/i)
  })

  it('ignores non-function modelContext surfaces', () => {
    const detection = detectModelContext({
      document: { modelContext: { registerTool: 'not a function' } },
      navigator: { modelContext: null },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: false })
  })

  it('preserves the model-context receiver and exposes optional reconciliation methods', async () => {
    const listeners = new Set<() => void>()
    const modelContext = {
      tools: [{ name: 'example' }],
      registerTool(this: { tools: { name: string }[] }, tool: { name: string }) {
        this.tools.push(tool)
      },
      getTools(this: { tools: { name: string }[] }) {
        return this.tools
      },
      addEventListener(this: unknown, type: string, listener: () => void) {
        expect(this).toBe(modelContext)
        if (type === 'toolchange') listeners.add(listener)
      },
      removeEventListener(this: unknown, type: string, listener: () => void) {
        expect(this).toBe(modelContext)
        if (type === 'toolchange') listeners.delete(listener)
      },
    }
    const detection = detectModelContext({
      document: { modelContext },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection.available).toBe(true)
    if (!detection.available) return

    const tool = { name: 'next' } as WebMcpToolDefinition
    await detection.registerTool(tool)
    expect(await detection.getTools?.()).toEqual([{ name: 'example' }, { name: 'next' }])
    const listener = vi.fn()
    const unsubscribe = detection.subscribeToolChanges?.(listener)
    listeners.forEach((notify) => notify())
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe?.()
    expect(listeners).toHaveLength(0)
  })

  it('types the optional execution context with an AbortSignal', () => {
    const execute: WebMcpToolDefinition['execute'] = (_input, context) => context?.signal?.aborted ?? false
    const controller = new AbortController()
    expect(execute({}, { signal: controller.signal })).toBe(false)
  })
})
