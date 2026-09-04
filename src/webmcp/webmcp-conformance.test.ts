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
    propertyNames?: { enum?: string[] }
  }>
  const rootProperties = schema.properties as Record<string, unknown>
  const rootRequired = schema.required as string[]
  if (!rootRequired.every((field) => Object.hasOwn(input, field))) return false
  if (schema.additionalProperties === false && !Object.keys(input).every((field) => Object.hasOwn(rootProperties, field))) return false
  return branches.filter((branch) => {
    const properties = branch.properties ?? {}
    const discriminator = properties.type
    const typeMatches = discriminator?.const === input.type || discriminator?.enum?.includes(input.type as string)
    const requiredMatch = (branch.required ?? []).every((field) => Object.hasOwn(input, field))
    const allowed = branch.propertyNames?.enum
    const propertiesMatch = allowed
      ? Object.keys(input).every((field) => allowed.includes(field))
      : branch.additionalProperties !== false || Object.keys(input).every((field) => Object.hasOwn(properties, field))
    return typeMatches && requiredMatch && propertiesMatch
  }).length === 1
}

const conformsToSchema = (root: Record<string, unknown>, schema: Record<string, unknown>, value: unknown): boolean => {
  if (typeof schema.$ref === 'string') {
    const target = schema.$ref.slice(2).split('/').reduce<unknown>((current, key) => (
      current !== null && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
    ), root)
    return target !== null && typeof target === 'object' && conformsToSchema(root, target as Record<string, unknown>, value)
  }
  if (Array.isArray(schema.allOf) && !schema.allOf.every((branch) => conformsToSchema(root, branch as Record<string, unknown>, value))) return false
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((branch) => conformsToSchema(root, branch as Record<string, unknown>, value))) return false
  if (Array.isArray(schema.oneOf) && schema.oneOf.filter((branch) => conformsToSchema(root, branch as Record<string, unknown>, value)).length !== 1) return false
  if (schema.if && conformsToSchema(root, schema.if as Record<string, unknown>, value) && schema.then && !conformsToSchema(root, schema.then as Record<string, unknown>, value)) return false
  if (schema.const !== undefined && value !== schema.const) return false
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false
  if (schema.type === 'null' && value !== null) return false
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return false
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return false
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) return false
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) return false
    if (typeof schema.minimum === 'number' && value < schema.minimum) return false
    if (typeof schema.maximum === 'number' && value > schema.maximum) return false
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) return false
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') return false
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return false
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) return false
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return false
    if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return false
    if (schema.items && !value.every((item) => conformsToSchema(root, schema.items as Record<string, unknown>, item))) return false
  }
  const objectKeywords = schema.type === 'object' || schema.properties || schema.required || schema.propertyNames || schema.additionalProperties !== undefined
  if (objectKeywords) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
    if (Array.isArray(schema.required) && !schema.required.every((key) => Object.hasOwn(record, key))) return false
    if (typeof schema.minProperties === 'number' && Object.keys(record).length < schema.minProperties) return false
    if (schema.propertyNames && !Object.keys(record).every((key) => conformsToSchema(root, schema.propertyNames as Record<string, unknown>, key))) return false
    for (const [key, child] of Object.entries(record)) {
      if (properties[key] && !conformsToSchema(root, properties[key], child)) return false
      if (!properties[key] && schema.additionalProperties === false) return false
      if (!properties[key] && schema.additionalProperties && typeof schema.additionalProperties === 'object' && !conformsToSchema(root, schema.additionalProperties as Record<string, unknown>, child)) return false
    }
  }
  return true
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

  it('keeps descriptions and registration manifests within explicit byte budgets', async () => {
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
      // The complete 31-operation write union cannot fit the generic 8 KiB budget without
      // unresolved external references, but remains capped at 16 KiB.
      const budget = ['preview_layout_changes', 'apply_layout_changes'].includes(tool.name) ? 16 * 1024 : 8 * 1024
      expect(byteLength(registrationManifest), tool.name).toBeLessThan(budget)
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
    const applyDescription = tools.find((tool) => tool.name === 'apply_layout_changes')!.description
    expect(applyDescription).toMatch(/live workspace/)
    expect(applyDescription).toMatch(/previewToken/)
    expect(applyDescription).toMatch(/expectedRevision/)
    expect(applyDescription).toMatch(/idempotencyKey/)
    expect(applySchema.oneOf[0].required).toEqual(['previewToken'])
    expect(applySchema.oneOf[1].required).toEqual(['expectedRevision', 'operations'])
    expect(applySchema.oneOf[1].required).not.toContain('idempotencyKey')
    controller.dispose()
  })

  it('publishes explicit schemas for every operation field and representative nested values', async () => {
    const { controller, tools } = await captureRegisteredTools()
    for (const name of ['preview_layout_changes', 'apply_layout_changes']) {
      const inputSchema = tools.find((tool) => tool.name === name)!.inputSchema as Record<string, unknown>
      const definitions = inputSchema.$defs as Record<string, Record<string, unknown>>
      const operations = (inputSchema.properties as Record<string, { items?: Record<string, unknown> }>).operations
      const item = operations.items!
      const emptySchemas: string[] = []
      const visit = (value: unknown, path: string): void => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return
        const record = value as Record<string, unknown>
        if (Object.keys(record).length === 0) emptySchemas.push(path)
        for (const [key, child] of Object.entries(record)) {
          if (Array.isArray(child)) child.forEach((entry, index) => visit(entry, `${path}.${key}[${index}]`))
          else visit(child, `${path}.${key}`)
        }
      }
      visit(item, 'operations.items')
      visit(definitions, '$defs')
      expect(emptySchemas).toEqual([])
      expect(item).toMatchObject({ type: 'object', additionalProperties: false, required: ['type', 'variantId'] })
      expect((item.properties as Record<string, unknown>).variantId).toEqual({ $ref: '#/$defs/i' })
      expect((item.properties as Record<string, unknown>).opening).toEqual({ $ref: '#/$defs/o' })
      expect(definitions.o).toMatchObject({
        type: 'object', additionalProperties: false,
        required: ['id', 'label', 'kind', 'wall', 'offsetMm', 'widthMm'],
      })
      expect(definitions.Q).toMatchObject({ type: 'object', additionalProperties: false, required: ['id', 'xMm', 'yMm', 'widthMm', 'depthMm'] })
      expect((definitions.A.properties as Record<string, unknown>).roomPolygon).toMatchObject({ type: 'array', items: { $ref: '#/$defs/p' } })
      expect((definitions.S.properties as Record<string, unknown>).staff).toMatchObject({ type: 'array', items: { $ref: '#/$defs/f' } })
      expect((definitions.e.properties as Record<string, unknown>).steps).toMatchObject({ type: 'array', items: { $ref: '#/$defs/m' } })
      expect((definitions.C.properties as Record<string, unknown>)).toMatchObject({
        planLayerOrder: { type: 'integer' },
        baseElevationMm: { $ref: '#/$defs/h' },
        shelfElevationsMm: { type: 'array', maxItems: 100, items: { $ref: '#/$defs/h' } },
      })
      expect(definitions.h).toEqual({ type: 'number', minimum: 0, maximum: 20_000 })
      const updateOpening = (item.allOf as Array<{ if: { properties: { type: { const: string } } }; then: { properties: { patch: unknown } } }>)
        .find((condition) => condition.if.properties.type.const === 'update_opening')
      expect(updateOpening?.then.properties.patch).toEqual({ $ref: '#/$defs/O' })
      expect(definitions.O).toMatchObject({ type: 'object', additionalProperties: false, minProperties: 1 })

      const validOpening = {
        type: 'add_opening', variantId: 'layout-a',
        opening: { id: 'door-a', label: 'Door A', kind: 'door', wall: 'left', offsetMm: 400, widthMm: 900 },
      }
      expect(conformsToSchema(inputSchema, inputSchema, { expectedRevision: 0, operations: [validOpening] })).toBe(true)
      expect(conformsToSchema(inputSchema, inputSchema, { expectedRevision: 0, operations: [{ ...validOpening, variantId: 4 }] })).toBe(false)
      expect(conformsToSchema(inputSchema, inputSchema, { expectedRevision: 0, operations: [{ ...validOpening, opening: {} }] })).toBe(false)
      expect(conformsToSchema(inputSchema, inputSchema, {
        expectedRevision: 0,
        operations: [{ type: 'update_pillar', variantId: 'layout-a', id: 'pillar-a', patch: { xMm: -1 } }],
      })).toBe(false)
      expect(conformsToSchema(inputSchema, inputSchema, {
        expectedRevision: 0,
        operations: [{ type: 'update_scenario', variantId: 'layout-a', scenarioId: 'dinner', patch: { staff: [{ role: 'head-chef', count: 1, rogue: true }] } }],
      })).toBe(false)
      expect(conformsToSchema(inputSchema, inputSchema, {
        expectedRevision: 0,
        operations: [{
          type: 'update_component', variantId: 'layout-a', componentId: 'rack-a',
          patch: { planLayerOrder: 3, baseElevationMm: 120, shelfElevationsMm: [300, 600, 900] },
        }],
      })).toBe(true)
      expect(conformsToSchema(inputSchema, inputSchema, {
        expectedRevision: 0,
        operations: [{
          type: 'update_component', variantId: 'layout-a', componentId: 'rack-a',
          patch: { shelfElevationsMm: [20_001] },
        }],
      })).toBe(false)
    }
    controller.dispose()
  })
})
