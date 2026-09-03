import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import { kitchenCapabilityManifest } from './capability-manifest'
import type { WebMcpToolDefinition } from './model-context'
import type { WebMcpToolResult } from './tool-result'
import { createWebMcpController } from './webmcp-controller'

const captureRegisteredTools = async () => {
  const store = createProjectStore(createSeedProject())
  const tools: WebMcpToolDefinition[] = []
  const controller = createWebMcpController({
    store,
    getFacade: () => getWorkspaceFacade(store),
    detect: () => ({
      available: true,
      surface: 'document',
      registerTool: (tool) => {
        tools.push(tool)
        return Promise.resolve()
      },
    }),
  })
  await controller.register()
  return { controller, tools }
}

describe('WebMCP protocol conformance', () => {
  it('wraps every success and failure in a parseable MCP result envelope', async () => {
    const { controller, tools } = await captureRegisteredTools()
    const guide = tools.find((tool) => tool.name === 'get_workspace_guide')!
    const success = await guide.execute({}) as WebMcpToolResult
    expect(success.isError).toBe(false)
    expect(JSON.parse(success.content[0].text)).toEqual(success.structuredContent)

    for (const tool of tools) {
      const result = await tool.execute({ unexpected: true }) as WebMcpToolResult
      expect(Object.keys(result).sort()).toEqual(['content', 'isError', 'structuredContent'])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
      expect(result.isError).toBe(true)
    }
    controller.dispose()
  })

  it('enforces the payload limit centrally after recording activity', async () => {
    const project = createSeedProject()
    project.name = 'x'.repeat(300_000)
    const store = createProjectStore(project)
    const tools: WebMcpToolDefinition[] = []
    const controller = createWebMcpController({
      store,
      getFacade: () => getWorkspaceFacade(store),
      detect: () => ({
        available: true,
        surface: 'document',
        registerTool: (tool) => {
          tools.push(tool)
          return Promise.resolve()
        },
      }),
    })
    await controller.register()

    const result = await tools.find((tool) => tool.name === 'get_layout')!.execute({ view: 'full' }) as WebMcpToolResult
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { ok: false, code: 'result-too-large' },
    })
    expect(controller.getActivity()[0]).toMatchObject({ tool: 'get_layout', ok: false, summary: expect.stringContaining('result-too-large') })
    controller.dispose()
  })

  it('uses only the current annotation vocabulary and marks project-text output untrusted', async () => {
    const { controller, tools } = await captureRegisteredTools()
    const allowed = new Set(['readOnlyHint', 'untrustedContentHint'])
    for (const tool of tools) {
      for (const key of Object.keys(tool.annotations ?? {})) expect(allowed.has(key)).toBe(true)
    }
    for (const name of ['get_layout', 'get_simulation_guide', 'export_project', 'preview_layout_changes', 'apply_layout_changes', 'run_simulation']) {
      expect(tools.find((tool) => tool.name === name)?.annotations?.untrustedContentHint).toBe(true)
    }
    controller.dispose()
  })

  it('keeps tool descriptions below 500 characters and registration manifests below 8 KiB', async () => {
    const { controller, tools } = await captureRegisteredTools()
    const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength

    expect(byteLength(kitchenCapabilityManifest)).toBeLessThan(8 * 1024)
    for (const tool of tools) {
      expect(tool.description.length, tool.name).toBeLessThan(500)
      const registrationManifest = {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }
      expect(byteLength(registrationManifest), tool.name).toBeLessThan(8 * 1024)
    }
    controller.dispose()
  })
})
