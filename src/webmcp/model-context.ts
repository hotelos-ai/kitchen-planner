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
  destructiveHint?: boolean
  openWorldHint?: boolean
}

export type WebMcpToolDefinition = {
  name: string
  title?: string
  description: string
  inputSchema: JsonSchemaObject
  annotations?: WebMcpToolAnnotations
  execute: (input: unknown) => unknown
}

export type RegisterModelTool = (tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => Promise<unknown>

export type ModelContextDetection =
  | { available: true; surface: 'document' | 'navigator'; registerTool: RegisterModelTool }
  | { available: false; reason: string }

export type ModelContextEnvironment = {
  document?: { modelContext?: unknown }
  navigator?: { modelContext?: unknown }
  isTopLevel?: boolean
  isSecureContext?: boolean
}

type RawRegisterTool = (tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => unknown

const asRegisterTool = (value: unknown): RegisterModelTool | null => {
  if (typeof value !== 'function') return null
  const raw = value as RawRegisterTool
  return (tool, options) => Promise.resolve().then(() => raw(tool, options))
}

const registerToolOf = (modelContext: unknown): RegisterModelTool | null => {
  if (modelContext === null || typeof modelContext !== 'object') return null
  return asRegisterTool((modelContext as { registerTool?: unknown }).registerTool)
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
  const documentTool = registerToolOf((environment.document ?? readGlobalDocument())?.modelContext)
  if (documentTool) return { available: true, surface: 'document', registerTool: documentTool }
  const navigatorTool = registerToolOf((environment.navigator ?? readGlobalNavigator())?.modelContext)
  if (navigatorTool) return { available: true, surface: 'navigator', registerTool: navigatorTool }
  return {
    available: false,
    reason: 'This browser does not expose document.modelContext or navigator.modelContext (WebMCP) yet.',
  }
}
