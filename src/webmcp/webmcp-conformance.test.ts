import { describe, expect, it } from 'vitest'
import { WORKSPACE_OPERATION_TYPES } from '../core/workspace/workspace-operation'
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

const acceptsRegisteredOperationShape = (schema: Record<string, unknown>, input: Record<string, unknown>) => {
  const branches = schema.oneOf as Array<{
    additionalProperties?: boolean
    required?: string[]
    properties?: Record<string, { const?: string; enum?: string[] }>
  }>
  return branches.filter((branch) => {
    const properties = branch.properties ?? {}
    const discriminator = properties.type
    const typeMatches = discriminator?.const === input.type || discriminator?.enum?.includes(input.type as string)
    const requiredMatch = (branch.required ?? []).every((field) => Object.hasOwn(input, field))
    const propertiesMatch = branch.additionalProperties !== false || Object.keys(input).every((field) => Object.hasOwn(properties, field))
    return typeMatches && requiredMatch && propertiesMatch
  }).length === 1
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
    for (const name of ['get_component_catalog', 'get_layout', 'get_simulation_guide', 'export_project', 'preview_layout_changes', 'apply_layout_changes', 'run_simulation']) {
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

  it('registers strict discriminated operation items for preview and apply', async () => {
    const { controller, tools } = await captureRegisteredTools()
    for (const name of ['preview_layout_changes', 'apply_layout_changes']) {
      const schema = tools.find((tool) => tool.name === name)!.inputSchema
      const operations = schema.properties.operations as { items: Record<string, unknown> }
      expect(operations.items).not.toEqual({})
      const registeredTypes = (operations.items.oneOf as Array<{ properties: { type: { const?: string; enum?: string[] } } }>)
        .flatMap((branch) => branch.properties.type.enum ?? [branch.properties.type.const!])
      expect(registeredTypes.sort()).toEqual([...WORKSPACE_OPERATION_TYPES].sort())
      expect(acceptsRegisteredOperationShape(operations.items, {})).toBe(false)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'activate_layout', variantId: 'layout-a', name: 'not-allowed',
      })).toBe(false)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'rename_layout', variantId: 'layout-a',
      })).toBe(false)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'rename_layout', variantId: 'layout-a', name: 'Updated name',
      })).toBe(true)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'add_opening', variantId: 'layout-a', opening: {},
      })).toBe(true)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'update_pillar', variantId: 'layout-a', id: 'pillar-a', patch: {}, storageZone: {},
      })).toBe(false)
      expect(acceptsRegisteredOperationShape(operations.items, {
        type: 'remove_storage_zone', variantId: 'layout-a', id: 'zone-a',
      })).toBe(true)
    }
    const applySchema = tools.find((tool) => tool.name === 'apply_layout_changes')!.inputSchema as typeof tools[number]['inputSchema'] & {
      oneOf: Array<{ required: string[] }>
    }
    expect(applySchema.oneOf[0].required).toEqual(['previewToken'])
    expect(applySchema.oneOf[1].required).toEqual(['expectedRevision', 'operations'])
    expect(applySchema.oneOf[1].required).not.toContain('idempotencyKey')
    controller.dispose()
  })
})
