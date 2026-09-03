/**
 * Minimal, dependency-free surface for the WebMCP imperative browser API.
 *
 * The current proposal exposes tool registration on `document.modelContext`
 * (with `navigator.modelContext` as a deprecated alias). Registration is only
 * available to top-level pages in secure contexts and tools are unregistered
 * by aborting the signal passed at registration time — there is no
 * unregisterTool in the shipping surface. This module feature-detects both
 * surfaces without polyfilling anything: unsupported browsers are a normal,
 * non-error state.
 */

export type JsonSchemaObject = {
  type: 'object'
  additionalProperties: false
  properties: Record<string, unknown>
  required?: readonly string[]
  description?: string
}

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
}

export type WebMcpToolExecutionContext = {
  signal?: AbortSignal
}

export type WebMcpToolDefinition = {
  name: string
  title?: string
  description: string
  inputSchema: JsonSchemaObject
  annotations?: WebMcpToolAnnotations
  execute: (input: unknown, context?: WebMcpToolExecutionContext) => unknown
}

export type RegisterModelTool = (tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => Promise<unknown>
export type RegisteredModelTool = { name: string }
export type GetModelTools = () => Promise<readonly RegisteredModelTool[]>
export type SubscribeModelToolChanges = (listener: () => void) => () => void

export type ModelContextDetection =
  | {
    available: true
    surface: 'document' | 'navigator'
    registerTool: RegisterModelTool
    getTools?: GetModelTools
    subscribeToolChanges?: SubscribeModelToolChanges
  }
  | { available: false; reason: string }

export type ModelContextEnvironment = {
  document?: { modelContext?: unknown }
  navigator?: { modelContext?: unknown }
  isTopLevel?: boolean
  isSecureContext?: boolean
}

type RawRegisterTool = (tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => unknown
type RawGetTools = () => unknown

const asRegisterTool = (modelContext: object, value: unknown): RegisterModelTool | null => {
  if (typeof value !== 'function') return null
  const raw = value as RawRegisterTool
  return (tool, options) => Promise.resolve().then(() => raw.call(modelContext, tool, options))
}

const getToolsOf = (modelContext: object): GetModelTools | undefined => {
  const value = (modelContext as { getTools?: unknown }).getTools
  if (typeof value !== 'function') return undefined
  const raw = value as RawGetTools
  return async () => {
    const result = await raw.call(modelContext)
    if (!Array.isArray(result)) return []
    return result.filter((tool): tool is RegisteredModelTool => (
      tool !== null && typeof tool === 'object' && typeof (tool as { name?: unknown }).name === 'string'
    ))
  }
}

const toolChangesOf = (modelContext: object): SubscribeModelToolChanges | undefined => {
  const target = modelContext as {
    addEventListener?: unknown
    removeEventListener?: unknown
  }
  if (typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') return undefined
  const addEventListener = target.addEventListener as (type: string, listener: () => void) => void
  const removeEventListener = target.removeEventListener as (type: string, listener: () => void) => void
  return (listener) => {
    const eventListener = () => listener()
    addEventListener.call(modelContext, 'toolchange', eventListener)
    return () => removeEventListener.call(modelContext, 'toolchange', eventListener)
  }
}

const surfaceOf = (modelContext: unknown): Omit<Extract<ModelContextDetection, { available: true }>, 'available' | 'surface'> | null => {
  if (modelContext === null || typeof modelContext !== 'object') return null
  const registerTool = asRegisterTool(modelContext, (modelContext as { registerTool?: unknown }).registerTool)
  if (!registerTool) return null
  const getTools = getToolsOf(modelContext)
  const subscribeToolChanges = toolChangesOf(modelContext)
  return {
    registerTool,
    ...(getTools ? { getTools } : {}),
    ...(subscribeToolChanges ? { subscribeToolChanges } : {}),
  }
}

const readGlobalDocument = (): { modelContext?: unknown } | undefined =>
  typeof document === 'undefined' ? undefined : document as Document & { modelContext?: unknown }

const readGlobalNavigator = (): { modelContext?: unknown } | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator as Navigator & { modelContext?: unknown }

export function detectModelContext(environment: ModelContextEnvironment = {}): ModelContextDetection {
  const isTopLevel = environment.isTopLevel ?? (typeof window === 'undefined' ? true : window.top === window.self)
  if (!isTopLevel) {
    return { available: false, reason: 'Agent tools are registered only in top-level pages, never inside iframes.' }
  }
  const isSecureContext = environment.isSecureContext ?? (typeof window === 'undefined' ? false : window.isSecureContext)
  if (!isSecureContext) {
    return { available: false, reason: 'Agent tools require a secure (HTTPS or localhost) browser context.' }
  }
  const documentSurface = surfaceOf((environment.document ?? readGlobalDocument())?.modelContext)
  if (documentSurface) return { available: true, surface: 'document', ...documentSurface }
  const navigatorSurface = surfaceOf((environment.navigator ?? readGlobalNavigator())?.modelContext)
  if (navigatorSurface) return { available: true, surface: 'navigator', ...navigatorSurface }
  return {
    available: false,
    reason: 'This browser does not expose document.modelContext or navigator.modelContext (WebMCP) yet.',
  }
}
