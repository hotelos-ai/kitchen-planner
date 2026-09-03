import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { kitchenCapabilityManifest, type CapabilityManifest } from './capability-manifest'
import type { WebMcpToolDefinition } from './model-context'
import { createReadTools } from './webmcp-read-tools'
import type { ToolDependencies } from './webmcp-tool-utils'
import { createWriteTools } from './webmcp-write-tools'

export type WebMcpToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
  manifest?: CapabilityManifest
}

/**
 * Assembles the full agent toolset for a workspace store. Read tools receive
 * a tool-summary callback so get_workspace_guide can list every registered
 * tool without a circular dependency.
 */
export function createWebMcpTools(deps: WebMcpToolDependencies): WebMcpToolDefinition[] {
  const manifest = deps.manifest ?? kitchenCapabilityManifest
  const readTools = createReadTools({ store: deps.store, getFacade: deps.getFacade, manifest, getToolSummaries: () => [] })
  const writeTools = createWriteTools({ store: deps.store, getFacade: deps.getFacade })
  const tools = [...readTools, ...writeTools]
  const summaries = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    readOnly: tool.annotations?.readOnlyHint === true,
  }))
  const guide = tools.find((tool) => tool.name === 'get_workspace_guide')
  if (guide) {
    // Rebuild the guide with the complete tool list now that it exists.
    const withSummaries = createReadTools({
      store: deps.store,
      getFacade: deps.getFacade,
      manifest,
      getToolSummaries: () => summaries.map((summary) => ({ ...summary })),
    })
    const guideWithSummaries = withSummaries.find((tool) => tool.name === 'get_workspace_guide')
    if (guideWithSummaries) return tools.map((tool) => (tool.name === 'get_workspace_guide' ? guideWithSummaries : tool))
  }
  return tools
}
