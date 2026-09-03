import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import type { ProjectStore } from '../state/project-store'
import { appStateStore } from '../state/app-state-store'
import { kitchenCapabilityManifest, type CapabilityManifest } from './capability-manifest'
import { detectModelContext, type ModelContextDetection } from './model-context'
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

const starterPromptFor = (toolNames: readonly string[]) => {
  const tool = (name: string) => toolNames.find((candidate) => candidate === name) ?? 'the site tools'
  return [
    'Inspect my attached reference image — you interpret it; this page never receives it.',
    `Call ${tool('get_workspace_guide')} to learn the coordinate system and units, then ${tool('get_app_state')}, ${tool('get_component_catalog')}, and ${tool('get_layout')} to read the visible workspace, catalog, and current plan.`,
    'Translate the sketch into explicit millimetre coordinates, dimensions, rotations, and component IDs.',
    `Call ${tool('preview_layout_changes')} with the current revision and a complete operation batch, then ${tool('apply_layout_changes')} with the returned preview token.`,
    `Verify with ${tool('analyze_layout')}, ${tool('check_operational_essentials')}, and ${tool('get_layout')}. For follow-up edits such as "move the fryer beside the range", re-read the revision, preview only the delta, apply, and verify.`,
    `Use ${tool('set_app_view')} to move between Space, Fit-out, 2D/3D, and Simulate, and ${tool('select_components')} to reveal the equipment you are discussing.`,
    `For operational questions, read ${tool('get_simulation_guide')}, adjust scenario parameters through preview/apply, then ${tool('run_simulation')} with visible playback and report assumptions separately from results.`,
    `Save or download the finished plan with ${tool('export_project')}.`,
    'Never invent measurements: mark uncertain components approximate and ask me when scale is unclear.',
  ].join(' ')
}

export function createWebMcpController(deps: WebMcpControllerDependencies): WebMcpController {
  const manifest = deps.manifest ?? kitchenCapabilityManifest
  const now = deps.now ?? (() => new Date().toISOString())
  const baseTools = createWebMcpTools({ store: deps.store, getFacade: deps.getFacade, manifest })
  const toolSummaries: WebMcpToolSummary[] = baseTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    readOnly: tool.annotations?.readOnlyHint === true,
  }))
  const starterPrompt = starterPromptFor(baseTools.map((tool) => tool.name))

  let status: WebMcpStatus = 'idle'
  let statusMessage = 'Agent tools are not registered yet.'
  let activity: WebMcpActivityEntry[] = []
  let activitySequence = 0
  let registration: AbortController | null = null
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
    execute: async (input: unknown) => {
      let result: unknown
      appStateStore.getState().setAgentIntent(tool.title ?? tool.name.replaceAll('_', ' '))
      try {
        result = await tool.execute(input)
      } catch (error) {
        result = {
          ok: false,
          code: 'internal-error',
          message: error instanceof Error ? error.message : 'Tool execution failed.',
        }
      } finally {
        appStateStore.getState().setAgentIntent(null)
      }
      const summary = summarizeResult(tool.name, result)
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
      return result
    },
  }))

  const detect = (): ModelContextDetection => (deps.detect ? deps.detect() : detectModelContext())

  const register = async (): Promise<void> => {
    dispose()
    const detection = detect()
    if (!detection.available) {
      status = 'unavailable'
      statusMessage = detection.reason
      notify()
      return
    }
    const controller = new AbortController()
    registration = controller
    const results = await Promise.allSettled(
      wrappedTools.map((tool) => detection.registerTool(tool, { signal: controller.signal })),
    )
    if (controller.signal.aborted) return
    const failures = results
      .map((result, index) => ({ result, tool: wrappedTools[index].name }))
      .filter((entry): entry is { result: PromiseRejectedResult; tool: string } => entry.result.status === 'rejected')
    if (failures.length === 0) {
      status = 'available'
      statusMessage = `Registered ${wrappedTools.length} agent tools via ${detection.surface}.modelContext.`
    } else if (failures.length === wrappedTools.length) {
      status = 'error'
      statusMessage = `Tool registration failed: ${failures.map((failure) => String(failure.result.reason ?? 'unknown error')).join('; ')}`.slice(0, 400)
    } else {
      status = 'partial'
      statusMessage = `Registered ${wrappedTools.length - failures.length} of ${wrappedTools.length} tools; failed: ${failures.map((failure) => failure.tool).join(', ')}.`
    }
    notify()
  }

  const dispose = (): void => {
    if (registration) {
      registration.abort()
      registration = null
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
