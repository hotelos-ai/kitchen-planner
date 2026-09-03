import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getWorkspaceFacade } from '../../state/project-store'
import type { WebMcpController } from '../../webmcp/webmcp-controller'
import { createWebMcpController } from '../../webmcp/webmcp-controller'
import { AgentToolsPanel } from './AgentToolsPanel'

const createAvailableController = async (): Promise<WebMcpController> => {
  const store = createProjectStore(createSeedProject())
  const detection = {
    available: true as const,
    surface: 'document' as const,
    registerTool: () => Promise.resolve(undefined),
  }
  const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => detection })
  await controller.register()
  return controller
}

describe('AgentToolsPanel', () => {
  it('shows setup guidance when the controller is unavailable', async () => {
    const store = createProjectStore(createSeedProject())
    const controller = createWebMcpController({
      store,
      getFacade: () => getWorkspaceFacade(store),
      detect: () => ({ available: false, reason: 'no modelContext' }),
    })
    await controller.register()
    render(<AgentToolsPanel onClose={() => undefined} controller={controller} />)
    expect(screen.getByRole('dialog', { name: 'AI agent tools' })).toBeInTheDocument()
    expect(screen.getByText('Agent tools unavailable in this browser')).toBeInTheDocument()
    expect(screen.getByText('no modelContext')).toBeInTheDocument()
    expect(screen.getByText(/stays fully usable without it/i)).toBeInTheDocument()
  })

  it('retries registration and reacts to controller status updates', async () => {
    const store = createProjectStore(createSeedProject())
    let available = false
    const controller = createWebMcpController({
      store,
      getFacade: () => getWorkspaceFacade(store),
      detect: () => available
        ? { available: true, surface: 'document', registerTool: () => Promise.resolve(undefined) }
        : { available: false, reason: 'exact detection reason' },
    })
    await controller.register()
    render(<AgentToolsPanel onClose={() => undefined} controller={controller} />)

    expect(screen.getByText('exact detection reason')).toBeInTheDocument()
    available = true
    await userEvent.click(screen.getByRole('button', { name: 'Retry registration' }))
    await waitFor(() => expect(screen.getByText('Agent tools active')).toBeInTheDocument())
  })

  it('lists the registered tools with read/write badges and the starter prompt', async () => {
    const controller = await createAvailableController()
    render(<AgentToolsPanel onClose={() => undefined} controller={controller} />)
    expect(screen.getByText('Agent tools active')).toBeInTheDocument()
    const toolNames = controller.getTools().map((tool) => tool.name)
    for (const name of toolNames) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    const prompt = screen.getByText(/Inspect my attached reference image/)
    expect(prompt).toBeInTheDocument()
    expect(screen.getByText(/never receives, uploads, or interprets images/i)).toBeInTheDocument()
    expect(screen.getByText(/only in this tab and this document/i)).toBeInTheDocument()
    expect(screen.getAllByText('untrusted content').length).toBeGreaterThan(0)
    expect(controller.getTools().find((tool) => tool.name === 'get_layout')).toMatchObject({ untrustedContentHint: true })
    expect(controller.getTools().find((tool) => tool.name === 'get_component_catalog')).toMatchObject({ untrustedContentHint: true })
  })

  it('copies the starter prompt with a graceful fallback', async () => {
    const controller = await createAvailableController()
    render(<AgentToolsPanel onClose={() => undefined} controller={controller} />)
    const button = screen.getByRole('button', { name: /copy prompt/i })
    await userEvent.click(button)
    await waitFor(() => expect(button.textContent).toMatch(/copied ✓|selected/i))
  })

  it('renders live activity entries from the controller', async () => {
    const store = createProjectStore(createSeedProject())
    const captured: { name: string; execute: (input: unknown) => unknown }[] = []
    const detection = {
      available: true as const,
      surface: 'document' as const,
      registerTool: (tool: { name: string; execute: (input: unknown) => unknown }) => {
        captured.push(tool)
        return Promise.resolve(undefined)
      },
    }
    const controller = createWebMcpController({ store, getFacade: () => getWorkspaceFacade(store), detect: () => detection })
    await controller.register()
    const variantId = store.getState().project.activeVariantId
    const previewResult = await captured.find((tool) => tool.name === 'preview_layout_changes')!.execute({
      expectedRevision: store.getState().revision,
      operations: [{ type: 'nudge_components', variantId, componentIds: ['tandoor'], delta: { xMm: 40, yMm: 0 } }],
    }) as { structuredContent: { ok: boolean; previewToken: string } }
    const preview = previewResult.structuredContent
    if (!preview.ok) throw new Error('preview failed')
    await captured.find((tool) => tool.name === 'apply_layout_changes')!.execute({ previewToken: preview.previewToken })

    render(<AgentToolsPanel onClose={() => undefined} controller={controller} />)
    await waitFor(() => expect(screen.getAllByText(/preview_layout_changes/).length).toBeGreaterThan(1))
    expect(screen.getAllByText(/rev 0/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/apply_layout_changes/).length).toBeGreaterThan(1)
  })

  it('closes on close button and Escape key', async () => {
    const controller = await createAvailableController()
    const onClose = vi.fn()
    render(<AgentToolsPanel onClose={onClose} controller={controller} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close AI tools' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
