import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { kitchenCapabilityManifest, type CapabilityManifest } from './capability-manifest'
import type { WebMcpToolDefinition } from './model-context'
import { createAnalysisTools } from './webmcp-analysis-tools'
import { createAppTools } from './webmcp-app-tools'
import { createArchitectureTools } from './webmcp-architecture-tools'
import { createReadTools } from './webmcp-read-tools'
import { createLifecycleTools } from './webmcp-lifecycle-tools'
import { createLayoutIntelligenceTools } from './webmcp-layout-intelligence-tools'
import { createRunTools } from './webmcp-run-tools'
import { createSharingTools } from './webmcp-sharing-tools'
import type { ToolDependencies } from './webmcp-tool-utils'
import { createWriteTools } from './webmcp-write-tools'
import type { SimulationRunStore } from '../state/simulation-run-store'

export type WebMcpToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
  manifest?: CapabilityManifest
  runStore?: SimulationRunStore
}

/**
 * Assembles the full agent toolset for a workspace store. Read tools receive
 * a tool-summary callback so get_workspace_guide can list every registered
 * tool without a circular dependency.
 */
export function createWebMcpTools(deps: WebMcpToolDependencies): WebMcpToolDefinition[] {
  const manifest = deps.manifest ?? kitchenCapabilityManifest
  const readTools = createReadTools({ store: deps.store, getFacade: deps.getFacade, manifest, getToolSummaries: () => [] })
  const appTools = createAppTools({ store: deps.store })
  const analysisTools = createAnalysisTools({ store: deps.store, getFacade: deps.getFacade })
  const writeTools = createWriteTools({ store: deps.store, getFacade: deps.getFacade })
  const runTools = createRunTools({ store: deps.store, getFacade: deps.getFacade, runStore: deps.runStore })
  const lifecycleTools = createLifecycleTools({ store: deps.store })
  const sharingTools = createSharingTools({ store: deps.store, runStore: deps.runStore })
  const layoutIntelligenceTools = createLayoutIntelligenceTools({ store: deps.store, getFacade: deps.getFacade })
  const architectureTools = createArchitectureTools({ store: deps.store, getFacade: deps.getFacade })
  const tools = [...readTools, ...appTools, ...analysisTools, ...writeTools, ...runTools, ...lifecycleTools, ...sharingTools, ...layoutIntelligenceTools, ...architectureTools]
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
