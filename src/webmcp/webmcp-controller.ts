import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import type { ProjectStore } from '../state/project-store'
import { appStateStore } from '../state/app-state-store'
import { kitchenCapabilityManifest, type CapabilityManifest } from './capability-manifest'
import {
  detectModelContext,
  type ModelContextDetection,
  type WebMcpToolDefinition,
  type WebMcpToolExecutionContext,
} from './model-context'
import { toWebMcpToolResult } from './tool-result'
import { createWebMcpTools } from './webmcp-tools'

export type WebMcpStatus = 'idle' | 'unavailable' | 'available' | 'partial' | 'error'

export type WebMcpActivityEntry = {
  id: string
  tool: string
  ok: boolean
  at: string
  revision?: number
  summary: string
}

export type WebMcpToolSummary = {
  name: string
  description: string
  readOnly: boolean
  untrustedContentHint: boolean
}

export type WebMcpController = {
  getStatus(): WebMcpStatus
  getStatusMessage(): string
  getTools(): WebMcpToolSummary[]
  getActivity(): WebMcpActivityEntry[]
  getStarterPrompt(): string
  register(): Promise<void>
  dispose(): void
  subscribe(listener: () => void): () => void
}

export type WebMcpControllerDependencies = {
  store: ProjectStore
  getFacade: () => WorkspaceFacade
  manifest?: CapabilityManifest
  detect?: () => ModelContextDetection
  now?: () => string
}

const ACTIVITY_LIMIT = 30
const SUMMARY_LIMIT = 200
export const REGISTRATION_RETRY_DELAYS_MS = [0, 250, 750, 2_000, 5_000] as const

const UNTRUSTED_CONTENT_TOOLS = new Set([
  'get_app_state',
  'select_components',
  'get_component_catalog',
  'get_layout',
  'analyze_layout',
  'get_simulation_guide',
  'get_simulation_result',
  'export_project',
  'import_project',
  'manage_checkpoints',
  'share_results',
  'compare_layouts',
  'get_auto_layout_run',
  'adopt_auto_layout_candidate',
  'edit_architecture',
  'check_operational_essentials',
  'preview_layout_changes',
  'apply_layout_changes',
  'run_simulation',
  'focus_camera',
])

const withConformantAnnotations = (tool: WebMcpToolDefinition): WebMcpToolDefinition => {
  const readOnlyHint = tool.annotations?.readOnlyHint
  const untrustedContentHint = tool.annotations?.untrustedContentHint === true || UNTRUSTED_CONTENT_TOOLS.has(tool.name)
  const annotations = {
    ...(readOnlyHint === undefined ? {} : { readOnlyHint }),
    ...(untrustedContentHint ? { untrustedContentHint: true } : {}),
  }
  return {
    ...tool,
    ...(Object.keys(annotations).length === 0 ? { annotations: undefined } : { annotations }),
  }
}

const starterPromptFor = (toolNames: readonly string[]) => {
  const tool = (name: string) => toolNames.find((candidate) => candidate === name) ?? 'the site tools'
  return [
    'Use this page\'s site tools to improve the live commercial-kitchen workspace from my goal or attached reference, and leave me with a verified, saved plan.',
    `Interpret any attached reference yourself—the page does not receive it. Read ${tool('get_workspace_guide')} for coordinates and units, then use ${tool('get_app_state')}, a filtered ${tool('get_component_catalog')} query, and ${tool('get_layout')} for only the current state and stable IDs the task needs.`,
    'Choose a focused tool sequence for the task. Translate the goal or reference into explicit millimetre coordinates, dimensions, rotations, and component IDs.',
    `For plan edits, use ${tool('preview_layout_changes')} with the current revision and an ordered operation batch, then commit its single-use token with ${tool('apply_layout_changes')}.`,
    `Confirm the visible result with the relevant combination of ${tool('analyze_layout')}, ${tool('check_operational_essentials')}, and ${tool('get_layout')}. For follow-up edits such as "move the fryer beside the range", re-read the revision and apply only the requested delta.`,
    `Use ${tool('set_app_view')} to show Space, Fit-out, 2D/3D, or Simulate and ${tool('select_components')} to reveal the equipment being discussed.`,
    `For operational questions, use ${tool('get_simulation_guide')} and ${tool('run_simulation')}; report model assumptions separately from results. Prefer focused preview/apply edits and ${tool('compare_layouts')} for saved variants. Use ${tool('run_auto_layout')} only when I explicitly request an automated multi-candidate search.`,
    `Save or download the finished plan with ${tool('export_project')}, or create a deep-linked handoff with ${tool('share_results')}. Treat unscaled measurements as approximate and ask me only when an ambiguity would materially change the plan.`,
  ].join(' ')
}

export function createWebMcpController(deps: WebMcpControllerDependencies): WebMcpController {
  const manifest = deps.manifest ?? kitchenCapabilityManifest
  const now = deps.now ?? (() => new Date().toISOString())
  const baseTools = createWebMcpTools({ store: deps.store, getFacade: deps.getFacade, manifest })
    .map(withConformantAnnotations)
  const toolSummaries: WebMcpToolSummary[] = baseTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    readOnly: tool.annotations?.readOnlyHint === true,
    untrustedContentHint: tool.annotations?.untrustedContentHint === true,
  }))
  const starterPrompt = starterPromptFor(baseTools.map((tool) => tool.name))

  let status: WebMcpStatus = 'idle'
  let statusMessage = 'Agent tools are not registered yet.'
  let activity: WebMcpActivityEntry[] = []
  let activitySequence = 0
  let registrationControllers = new Map<string, AbortController>()
  const pendingRegistrationControllers = new Set<AbortController>()
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryCycle = 0
  let registrationInFlightCycle: number | null = null
  let reconcileAfterRegistration = false
  let reconcileQueued = false
  let disposed = false
  let removeToolChangeListener: (() => void) | null = null
  let getRegisteredTools: Extract<ModelContextDetection, { available: true }>['getTools']
  let lifecycleListening = false
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((listener) => listener())

  const summarizeResult = (tool: string, result: unknown): { ok: boolean; revision?: number; summary: string } => {
    if (result !== null && typeof result === 'object' && 'ok' in result) {
      const record = result as { ok?: unknown; revision?: unknown; changedIds?: unknown; count?: unknown; code?: unknown }
      const ok = record.ok === true
      const parts: string[] = []
      if (Array.isArray(record.changedIds)) parts.push(`${record.changedIds.length} changed`)
      if (typeof record.count === 'number') parts.push(`${record.count} entries`)
      if (typeof record.code === 'string') parts.push(record.code)
      const summary = parts.length > 0 ? `${tool}: ${parts.join(', ')}` : `${tool} ${ok ? 'succeeded' : 'failed'}`
      return {
        ok,
        ...(typeof record.revision === 'number' ? { revision: record.revision } : {}),
        summary: summary.slice(0, SUMMARY_LIMIT),
      }
    }
    return { ok: true, summary: `${tool} completed`.slice(0, SUMMARY_LIMIT) }
  }

  const wrappedTools = baseTools.map((tool) => ({
    ...tool,
    execute: async (input: unknown, context?: WebMcpToolExecutionContext) => {
      let result: unknown
      const requestedIntent = input !== null && typeof input === 'object' && 'intent' in input
        && typeof (input as { intent?: unknown }).intent === 'string'
        ? (input as { intent: string }).intent.trim()
        : ''
      appStateStore.getState().beginAgentActivity()
      appStateStore.getState().setAgentIntent(requestedIntent || tool.title || tool.name.replaceAll('_', ' '))
      try {
        result = await tool.execute(input, context)
      } catch (error) {
        result = {
          ok: false,
          code: 'internal-error',
          message: error instanceof Error ? error.message : 'Tool execution failed.',
        }
      } finally {
        appStateStore.getState().setAgentIntent(null)
      }
      const toolResult = toWebMcpToolResult(result)
      const summary = summarizeResult(tool.name, toolResult.structuredContent)
      activitySequence += 1
      const entry: WebMcpActivityEntry = {
        id: `activity-${activitySequence}`,
        tool: tool.name,
        ok: summary.ok,
        at: now(),
        ...(summary.revision === undefined ? {} : { revision: summary.revision }),
        summary: summary.summary,
      }
      activity = [entry, ...activity].slice(0, ACTIVITY_LIMIT)
      notify()
      return toolResult
    },
  }))

  const detect = (): ModelContextDetection => (deps.detect ? deps.detect() : detectModelContext())

  const clearRetryTimer = (): void => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const unbindToolChanges = (): void => {
    removeToolChangeListener?.()
    removeToolChangeListener = null
    getRegisteredTools = undefined
  }

  const abortRegistrations = (): void => {
    for (const controller of registrationControllers.values()) controller.abort()
    for (const controller of pendingRegistrationControllers) controller.abort()
    registrationControllers = new Map()
    pendingRegistrationControllers.clear()
  }

  let retryTargets = new Set(wrappedTools.map((tool) => tool.name))

  const updateRegistrationStatus = (surface: 'document' | 'navigator', failures: readonly string[]): void => {
    const registeredCount = registrationControllers.size
    if (registeredCount === wrappedTools.length) {
      status = 'available'
      statusMessage = `Registered ${wrappedTools.length} agent tools via ${surface}.modelContext.`
    } else if (registeredCount === 0) {
      status = 'error'
      statusMessage = `Tool registration failed for all ${wrappedTools.length} tools${failures.length > 0 ? `: ${failures.join(', ')}` : '.'}`.slice(0, 400)
    } else {
      status = 'partial'
      statusMessage = `Registered ${registeredCount} of ${wrappedTools.length} tools; retrying: ${failures.join(', ')}.`.slice(0, 400)
    }
    notify()
  }

  const scheduleRetry = (cycle: number, attemptIndex: number, runAttempt: (cycle: number, attemptIndex: number) => Promise<void>): void => {
    const nextIndex = attemptIndex + 1
    if (nextIndex >= REGISTRATION_RETRY_DELAYS_MS.length || disposed || cycle !== retryCycle) return
    const delay = REGISTRATION_RETRY_DELAYS_MS[nextIndex] - REGISTRATION_RETRY_DELAYS_MS[attemptIndex]
    clearRetryTimer()
    retryTimer = setTimeout(() => {
      retryTimer = null
      void runAttempt(cycle, nextIndex)
    }, delay)
    // Node timers should not keep focused test runs alive; browsers return a number.
    const timerWithUnref = retryTimer as unknown as { unref?: () => void }
    timerWithUnref.unref?.()
  }

  const onToolChange = (): void => {
    if (disposed) return
    if (registrationInFlightCycle !== null) {
      reconcileAfterRegistration = true
      return
    }
    if (reconcileQueued) return
    reconcileQueued = true
    queueMicrotask(() => {
      reconcileQueued = false
      void reconcileTools()
    })
  }

  const bindToolChanges = (detection: Extract<ModelContextDetection, { available: true }>): void => {
    unbindToolChanges()
    getRegisteredTools = detection.getTools
    removeToolChangeListener = detection.subscribeToolChanges?.(onToolChange) ?? null
  }

  async function runRegistrationAttempt(cycle: number, attemptIndex: number): Promise<void> {
    if (disposed || cycle !== retryCycle) return
    const detection = detect()
    if (!detection.available) {
      status = registrationControllers.size === 0 ? 'unavailable' : 'partial'
      statusMessage = detection.reason
      notify()
      scheduleRetry(cycle, attemptIndex, runRegistrationAttempt)
      return
    }

    bindToolChanges(detection)
    const targets = wrappedTools.filter((tool) => retryTargets.has(tool.name) && !registrationControllers.has(tool.name))
    if (targets.length === 0) {
      updateRegistrationStatus(detection.surface, [])
      return
    }

    registrationInFlightCycle = cycle
    const attempts = targets.map(async (tool) => {
      const controller = new AbortController()
      pendingRegistrationControllers.add(controller)
      try {
        await detection.registerTool(tool, { signal: controller.signal })
        return { tool: tool.name, controller }
      } catch (error) {
        controller.abort()
        throw error
      } finally {
        pendingRegistrationControllers.delete(controller)
      }
    })
    const results = await Promise.allSettled(
      attempts,
    )
    if (registrationInFlightCycle === cycle) registrationInFlightCycle = null
    if (disposed || cycle !== retryCycle) {
      for (const result of results) {
        if (result.status === 'fulfilled') result.value.controller.abort()
      }
      return
    }

    const failures: string[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') registrationControllers.set(result.value.tool, result.value.controller)
      else failures.push(targets[index].name)
    })
    retryTargets = new Set(failures)
    updateRegistrationStatus(detection.surface, failures)
    if (failures.length > 0) scheduleRetry(cycle, attemptIndex, runRegistrationAttempt)
    if (reconcileAfterRegistration) {
      reconcileAfterRegistration = false
      onToolChange()
    }
  }

  async function reconcileTools(): Promise<void> {
    if (disposed || registrationInFlightCycle !== null || !getRegisteredTools) return
    let registered: readonly { name: string }[]
    try {
      registered = await getRegisteredTools()
    } catch {
      return
    }
    if (disposed || registrationInFlightCycle !== null) return
    const listedNames = new Set(registered.map((tool) => tool.name))
    const missing = wrappedTools.filter((tool) => (
      registrationControllers.has(tool.name) && !listedNames.has(tool.name)
    ))
    if (missing.length === 0) return

    for (const tool of missing) {
      registrationControllers.get(tool.name)?.abort()
      registrationControllers.delete(tool.name)
    }
    clearRetryTimer()
    retryCycle += 1
    retryTargets = new Set(wrappedTools.filter((tool) => !registrationControllers.has(tool.name)).map((tool) => tool.name))
    await runRegistrationAttempt(retryCycle, 0)
  }

  const onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) void register()
  }

  const ensureLifecycleListener = (): void => {
    if (lifecycleListening || typeof window === 'undefined') return
    window.addEventListener('pageshow', onPageShow)
    lifecycleListening = true
  }

  const register = async (): Promise<void> => {
    disposed = false
    ensureLifecycleListener()
    clearRetryTimer()
    retryCycle += 1
    unbindToolChanges()
    abortRegistrations()
    retryTargets = new Set(wrappedTools.map((tool) => tool.name))
    await runRegistrationAttempt(retryCycle, 0)
  }

  const dispose = (): void => {
    disposed = true
    retryCycle += 1
    clearRetryTimer()
    unbindToolChanges()
    abortRegistrations()
    if (lifecycleListening && typeof window !== 'undefined') {
      window.removeEventListener('pageshow', onPageShow)
      lifecycleListening = false
    }
    status = 'idle'
    statusMessage = 'Agent tools were unregistered.'
    notify()
  }

  return {
    getStatus: () => status,
    getStatusMessage: () => statusMessage,
    getTools: () => toolSummaries.map((summary) => ({ ...summary })),
    getActivity: () => activity.map((entry) => ({ ...entry })),
    getStarterPrompt: () => starterPrompt,
    register,
    dispose,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
