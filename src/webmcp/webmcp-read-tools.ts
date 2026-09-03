import { z } from 'zod'
import type { WorkspaceFacade } from '../core/workspace/workspace-facade'
import { WORKSPACE_OPERATION_TYPES } from '../core/workspace/workspace-operation'
import { analyzeLayout, type LayoutIssue } from '../domain/layout-diagnostics'
import type { CapabilityManifest } from './capability-manifest'
import type { JsonSchemaObject, WebMcpToolDefinition } from './model-context'
import { workspaceOperationJsonSchema } from './webmcp-write-tools'
import {
  currentRevision,
  failure,
  parseInput,
  resolveVariant,
  success,
  unknownErrorMessage,
  variantSummary,
  type ToolDependencies,
} from './webmcp-tool-utils'

export type ReadToolDependencies = ToolDependencies & {
  getFacade: () => WorkspaceFacade
  manifest: CapabilityManifest
  getToolSummaries: () => { name: string; description: string; readOnly: boolean }[]
}

const emptyInput = z.object({}).strict()

const catalogInput = z.object({
  query: z.string().trim().max(200).optional(),
  category: z.string().trim().max(60).optional(),
  capability: z.string().trim().max(60).optional(),
}).strict()

const layoutInput = z.object({
  view: z.enum(['summary', 'architecture', 'components', 'full']).optional(),
  variantId: z.string().min(1).max(128).optional(),
  componentIds: z.array(z.string().min(1).max(128)).min(1).max(500).optional(),
}).strict()

const placementInput = z.object({
  catalogId: z.string().min(1).max(128),
  variantId: z.string().min(1).max(128).optional(),
  preferredPoint: z.object({ xMm: z.number().finite(), yMm: z.number().finite() }).strict().optional(),
}).strict()

const remediationByCode: Record<LayoutIssue['code'], string> = {
  'outside-room': 'Move or resize the component so its footprint stays inside the room polygon.',
  'equipment-overlap': 'Separate the overlapping components or remove one of them.',
  'pillar-overlap': 'Reposition the component so it does not intersect the structural pillar.',
  'clearance-obstructed': 'Clear the required front clearance by moving the obstruction or the component.',
}

export function createReadTools(deps: ReadToolDependencies): WebMcpToolDefinition[] {
  const guideSchema: JsonSchemaObject = {
    type: 'object',
    additionalProperties: false,
    properties: {},
    description: 'No parameters. Returns the coordinate system, workflow, and conventions agents must follow.',
  }

  const getWorkspaceGuide: WebMcpToolDefinition = {
    name: 'get_workspace_guide',
    title: 'Get workspace guide',
    description:
      'Read the workspace conventions before any other call: coordinate system (origin, axes, millimetre units, rotation, component anchor), current revision, room boundary summary, agent workflow, uncertainty guidance, tool list, and limitations.',
    inputSchema: guideSchema,
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, emptyInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Input must be an empty object.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project)
        if (!variant) return failure(state.revision, 'missing-variant', 'The active layout variant is missing.')
        return success(state.revision, {
          documentId: state.documentId,
          workspace: {
            kind: deps.manifest.workspaceKind,
            displayName: deps.manifest.displayName,
            domainSummary: deps.manifest.domainSummary,
          },
          coordinateSystem: deps.manifest.coordinateSystem,
          supportedDisplayUnits: [...deps.manifest.supportedDisplayUnits],
          room: {
            widthMm: variant.architecture.widthMm,
            depthMm: variant.architecture.depthMm,
            wallHeightMm: variant.architecture.wallHeightMm,
            polygonVertices: variant.architecture.roomPolygon.length,
            openings: variant.architecture.openings.length,
            pillars: variant.architecture.pillars.length,
            storageZones: variant.architecture.storageZones.length,
            architectureLocked: variant.architecture.locked,
          },
          referenceImagePolicy: deps.manifest.referenceImagePolicy,
          agentWorkflow: [...deps.manifest.agentWorkflow],
          uncertaintyGuidance: deps.manifest.uncertaintyGuidance,
          supportedOperations: [...WORKSPACE_OPERATION_TYPES],
          operationSchema: structuredClone(workspaceOperationJsonSchema),
          tools: deps.getToolSummaries(),
          limitations: [...deps.manifest.limitations],
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const getComponentCatalog: WebMcpToolDefinition = {
    name: 'get_component_catalog',
    title: 'Get component catalog',
    description:
      'List catalog components that can be added with add_component operations: stable catalogId, label, category, typical and maximum dimensions in millimetres, station capabilities, clearances, configurations, and tags. Filter by free-text query, category, or capability.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Optional free-text search over catalog names, synonyms, and tags.' },
        category: { type: 'string', description: 'Optional category filter such as cooking, cold, prep, washing, landing, storage, hood.' },
        capability: { type: 'string', description: 'Optional station capability filter such as range-cook or dish-wash.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, catalogInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid catalog filters.', parsed.issues)
        const filters: Record<string, string> = {}
        if (parsed.value.query !== undefined) filters.query = parsed.value.query
        if (parsed.value.category !== undefined) filters.category = parsed.value.category
        if (parsed.value.capability !== undefined) filters.capability = parsed.value.capability
        const entries = deps.getFacade().getComponentCatalog(filters) as unknown[]
        return success(currentRevision(deps), { count: entries.length, entries })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const getLayout: WebMcpToolDefinition = {
    name: 'get_layout',
    title: 'Get current layout',
    description:
      'Read the current plan in exact millimetres — the spatial model agents work with instead of screenshots. Views: summary (room, per-component rects and rotations), architecture (polygon, openings, pillars, zones), components (full equipment records), full (everything incl. scenarios and settings). Defaults to the active variant.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        view: { type: 'string', enum: ['summary', 'architecture', 'components', 'full'], description: 'Detail level; defaults to summary.' },
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        componentIds: { type: 'array', items: { type: 'string' }, description: 'Optional component ID filter for the components view.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, layoutInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid layout query.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const view = parsed.value.view ?? 'summary'
        const base = {
          revision: state.revision,
          activeVariantId: state.project.activeVariantId,
          variants: variantSummary(state.project),
        }
        if (view === 'summary') {
          const components = variant.equipment.map((item) => ({
            id: item.id,
            label: item.label,
            category: item.category,
            xMm: item.xMm,
            yMm: item.yMm,
            widthMm: item.widthMm,
            depthMm: item.depthMm,
            heightMm: item.heightMm,
            rotationDeg: item.rotationDeg,
            approximate: item.approximate === true,
          }))
          const countsByCategory = components.reduce<Record<string, number>>((counts, component) => {
            counts[component.category] = (counts[component.category] ?? 0) + 1
            return counts
          }, {})
          return success(state.revision, {
            ...base,
            view,
            room: {
              widthMm: variant.architecture.widthMm,
              depthMm: variant.architecture.depthMm,
              wallHeightMm: variant.architecture.wallHeightMm,
              polygonVertices: variant.architecture.roomPolygon.length,
              locked: variant.architecture.locked,
            },
            countsByCategory,
            components,
          })
        }
        if (view === 'architecture') {
          return success(state.revision, { ...base, view, architecture: structuredClone(variant.architecture) })
        }
        if (view === 'components') {
          const equipment = parsed.value.componentIds
            ? variant.equipment.filter((item) => parsed.value.componentIds!.includes(item.id))
            : variant.equipment
          return success(state.revision, { ...base, view, equipment: structuredClone(equipment) })
        }
        return success(state.revision, {
          ...base,
          view,
          variant: structuredClone(variant),
          projectSettings: {
            name: state.project.name,
            displayUnit: state.project.displayUnit,
            snapMm: state.project.snapMm,
          },
          scenarios: state.project.scenarios.map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            covers: scenario.covers,
            durationMinutes: scenario.durationMinutes,
            arrivalPattern: scenario.arrivalPattern,
          })),
          activeScenarioId: state.project.activeScenarioId,
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const analyzeLayoutTool: WebMcpToolDefinition = {
    name: 'analyze_layout',
    title: 'Analyze layout diagnostics',
    description:
      'Structured diagnostics for a layout revision: outside-room, equipment-overlap, pillar-overlap, and clearance-obstructed findings with severity, affected component IDs, and remediation. Advisory only — not regulatory certification.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, z.object({ variantId: z.string().min(1).max(128).optional() }).strict(), input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid analysis query.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const findings = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
        return success(state.revision, {
          variantId: variant.id,
          findings: findings.map((issue) => ({
            id: issue.id,
            code: issue.code,
            severity: issue.severity,
            title: issue.title,
            message: issue.message,
            affectedIds: [...issue.itemIds],
            remediation: remediationByCode[issue.code],
          })),
          certification: 'Advisory planning diagnostics only; not a regulatory certification.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const suggestPlacement: WebMcpToolDefinition = {
    name: 'suggest_component_placement',
    title: 'Suggest component placement',
    description:
      'Ask the workspace for a collision-free anchor position for a catalog component, optionally near a preferred millimetre point. Useful before add_component when you do not care to compute free space yourself.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['catalogId'],
      properties: {
        catalogId: { type: 'string', description: 'Catalog entry ID from get_component_catalog.' },
        variantId: { type: 'string', description: 'Optional layout variant ID; defaults to the active variant.' },
        preferredPoint: {
          type: 'object',
          additionalProperties: false,
          required: ['xMm', 'yMm'],
          properties: {
            xMm: { type: 'number', description: 'Millimetres from the room origin along +x.' },
            yMm: { type: 'number', description: 'Millimetres from the room origin along +y.' },
          },
          description: 'Optional preferred millimetre point to place near.',
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, placementInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid placement query.', parsed.issues)
        const state = deps.store.getState()
        const variantId = parsed.value.variantId ?? state.project.activeVariantId
        const suggestion = deps.getFacade().suggestPlacement({
          variantId,
          catalogId: parsed.value.catalogId,
          ...(parsed.value.preferredPoint ? { preferredPoint: parsed.value.preferredPoint } : {}),
        }) as unknown
        if (!suggestion) return failure(state.revision, 'unknown-catalog-entry', `Catalog entry ${parsed.value.catalogId} is unknown.`)
        return success(state.revision, { suggestion })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const getSimulationGuide: WebMcpToolDefinition = {
    name: 'get_simulation_guide',
    title: 'Get simulation guide',
    description:
      'Read the service-simulation contract: scenario list with parameters, editable fields with constraints, staff roles, and the meaning of each result metric. Scenario edits are applied as update_scenario operations through preview_layout_changes; runs execute with run_simulation.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      description: 'No parameters.',
    },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, emptyInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Input must be an empty object.', parsed.issues)
        const state = deps.store.getState()
        return success(state.revision, {
          scenarios: state.project.scenarios.map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            covers: scenario.covers,
            durationMinutes: scenario.durationMinutes,
            arrivalPattern: scenario.arrivalPattern,
            cookToOrderRatio: scenario.cookToOrderRatio,
            seed: scenario.seed,
            staff: scenario.staff.map((assignment) => ({ role: assignment.role, count: assignment.count })),
            menuItems: scenario.menuItems ? structuredClone(scenario.menuItems) : undefined,
          })),
          activeScenarioId: state.project.activeScenarioId,
          editableParameters: [
            { field: 'name', type: 'string', constraints: '1–160 characters.' },
            { field: 'covers', type: 'integer', constraints: '1–100000.' },
            { field: 'durationMinutes', type: 'number', constraints: 'Positive, up to 10080.' },
            { field: 'arrivalPattern', type: 'enum', constraints: 'seating-wave | steady | two-waves.' },
            { field: 'cookToOrderRatio', type: 'number', constraints: '0–1.' },
            { field: 'seed', type: 'integer', constraints: '-2147483648–2147483647; identical seeds reproduce identical runs.' },
            { field: 'staff', type: 'array', constraints: 'Items { role: head-chef | sous-chef | cdp | busser-washer, count: 0–100 }; at least one entry.' },
            { field: 'checks', type: 'object', constraints: 'Optional booleans: collisions, doorSwings, dirtyCleanCrossings.' },
            { field: 'taskDurations', type: 'object', constraints: 'Per-capability { minSeconds, maxSeconds } with min ≤ max; capability names from the station capability enum.' },
            { field: 'stationCapacities', type: 'object', constraints: 'Component ID → positive integer capacity.' },
            { field: 'serviceStyle', type: 'string', constraints: 'Optional label, 1–160 characters.' },
            { field: 'variability', type: 'enum', constraints: 'low | typical | high.' },
            { field: 'menuItems', type: 'array', constraints: 'Up to 200 weighted menu items with sharePct, source, and 1–24 predecessor-linked capability steps. Omit to preserve the legacy deterministic model.' },
          ],
          staffRoles: ['head-chef', 'sous-chef', 'cdp', 'busser-washer'],
          resultDefinitions: {
            throughputPerHour: 'Completed orders per hour.',
            completedOrders: 'Orders fully finished within the simulated duration.',
            backlog: 'Orders still open when service ends.',
            averageWaitSeconds: 'Mean order completion time.',
            waitTimeDistribution: 'Histogram of order wait times.',
            stationUtilization: 'Busy fraction per station over the run.',
            queues: 'Per-station queue depth over time.',
            warnings: 'Model warnings, e.g. unreachable stations or starving roles.',
          },
          assumptions: 'Simulation outputs are deterministic assumptions driven by the scenario and layout, not observed service data.',
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [getWorkspaceGuide, getComponentCatalog, getLayout, analyzeLayoutTool, suggestPlacement, getSimulationGuide]
}
