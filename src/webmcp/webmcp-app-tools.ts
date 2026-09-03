import { z } from 'zod'
import { appStateStore } from '../state/app-state-store'
import { selectSimulationRun, simulationRunStore, type SimulationRunStore } from '../state/simulation-run-store'
import type { JsonSchemaObject, WebMcpToolDefinition } from './model-context'
import {
  currentRevision,
  failure,
  parseInput,
  success,
  unknownErrorMessage,
  type ToolDependencies,
} from './webmcp-tool-utils'

const emptyInput = z.object({}).strict()

const setAppViewInput = z.object({
  stage: z.enum(['space', 'equipment', 'simulate']).optional(),
  view: z.enum(['plan', 'scene', 'split']).optional(),
  overlay: z.enum(['compare', 'auto-layout']).nullable().optional(),
  walkMode: z.boolean().optional(),
  walkView: z.enum(['first-person', 'third-person']).optional(),
  cameraMode: z.enum(['perspective', 'top']).optional(),
  showClearances: z.boolean().optional(),
  wallsTransparent: z.boolean().optional(),
  showLabels: z.boolean().optional(),
  simulationView: z.enum(['operations-2d', 'overview-3d', 'walk']).optional(),
  panels: z.object({
    catalog: z.boolean().optional(),
    inspector: z.boolean().optional(),
    essentials: z.boolean().optional(),
    revisions: z.boolean().optional(),
  }).strict().refine((panels) => Object.keys(panels).length > 0, { message: 'Provide at least one panel field.' }).optional(),
  showReference: z.boolean().optional(),
}).strict().refine(
  ({ stage, view, overlay, walkMode, walkView, cameraMode, showClearances, wallsTransparent, showLabels, simulationView, panels, showReference }) => (
    stage !== undefined
    || view !== undefined
    || overlay !== undefined
    || walkMode !== undefined
    || walkView !== undefined
    || cameraMode !== undefined
    || showClearances !== undefined
    || wallsTransparent !== undefined
    || showLabels !== undefined
    || simulationView !== undefined
    || panels !== undefined
    || showReference !== undefined
  ),
  { message: 'Provide at least one view field.' },
)

const selectComponentsInput = z.object({
  componentIds: z.array(z.string().min(1).max(128)).max(500).optional(),
  mode: z.enum(['replace', 'add', 'toggle', 'clear']).default('replace'),
  reveal: z.enum(['plan', 'scene', 'both']).optional(),
}).strict().superRefine((input, context) => {
  if (input.mode !== 'clear' && (!input.componentIds || input.componentIds.length === 0)) {
    context.addIssue({ code: 'custom', path: ['componentIds'], message: `componentIds must contain at least one ID when mode is ${input.mode}.` })
  }
})

const focusCameraInput = z.object({
  target: z.enum(['fit', 'component', 'point']),
  componentId: z.string().min(1).max(128).optional(),
  point: z.object({ xMm: z.number().finite(), yMm: z.number().finite() }).strict().optional(),
  cameraMode: z.enum(['perspective', 'top']).optional(),
}).strict().superRefine((input, context) => {
  if (input.target === 'component' && !input.componentId) context.addIssue({ code: 'custom', path: ['componentId'], message: 'componentId is required for component focus.' })
  if (input.target === 'point' && !input.point) context.addIssue({ code: 'custom', path: ['point'], message: 'point is required for point focus.' })
})

type AppToolDependencies = ToolDependencies & { runStore?: SimulationRunStore }

const appStatePayload = (deps: AppToolDependencies) => {
  const projectState = deps.store.getState()
  const appState = appStateStore.getState()
  const variantId = appState.simulationViewTarget?.variantId ?? projectState.project.activeVariantId
  const scenarioId = appState.simulationViewTarget?.scenarioId ?? projectState.project.activeScenarioId
  const runStore = deps.runStore ?? simulationRunStore
  return {
    documentId: projectState.documentId,
    stage: appState.stage,
    view: appState.view,
    overlay: appState.overlay,
    walkMode: appState.walkMode,
    walkView: appState.walkView,
    cameraMode: appState.cameraMode,
    showClearances: appState.showClearances,
    wallsTransparent: appState.wallsTransparent,
    showLabels: appState.showLabels,
    simulationView: appState.simulationView,
    panels: { ...appState.panels },
    showReference: appState.showReference,
    dialogsOpen: [...appState.dialogsOpen],
    activeVariantId: projectState.project.activeVariantId,
    activeScenarioId: projectState.project.activeScenarioId,
    selectedIds: [...projectState.selectedIds],
    hasSimulationResult: selectSimulationRun(runStore.getState(), variantId, scenarioId) !== null,
    canUndo: projectState.past.length > 0,
    canRedo: projectState.future.length > 0,
  }
}

const setAppViewSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stage: { type: 'string', enum: ['space', 'equipment', 'simulate'], description: 'Optional workflow stage to display.' },
    view: { type: 'string', enum: ['plan', 'scene', 'split'], description: 'Optional workspace view to display.' },
    overlay: {
      type: ['string', 'null'],
      enum: ['compare', 'auto-layout', null],
      description: 'Optional workspace overlay. Pass null to close the active overlay.',
    },
    walkMode: { type: 'boolean', description: 'Enter or exit kitchen walk mode.' },
    walkView: { type: 'string', enum: ['first-person', 'third-person'], description: 'Set the kitchen walk camera to first-person or third-person.' },
    cameraMode: { type: 'string', enum: ['perspective', 'top'], description: 'Set the 3D camera projection preset.' },
    showClearances: { type: 'boolean', description: 'Show or hide equipment and opening clearance overlays in the 3D scene.' },
    wallsTransparent: { type: 'boolean', description: 'Render the 3D room walls as transparent or opaque.' },
    showLabels: { type: 'boolean', description: 'Show or hide labels in the 3D scene.' },
    simulationView: {
      type: 'string',
      enum: ['operations-2d', 'overview-3d', 'walk'],
      description: 'Set the simulation result view to 2D operations, 3D overview, or first-person walk mode.',
    },
    panels: {
      type: 'object',
      additionalProperties: false,
      properties: {
        catalog: { type: 'boolean', description: 'Show or hide the component catalog.' },
        inspector: { type: 'boolean', description: 'Show or hide the inspector.' },
        essentials: { type: 'boolean', description: 'Show or hide operational essentials in the inspector.' },
        revisions: { type: 'boolean', description: 'Show or hide revision history in the inspector.' },
      },
      description: 'Patch one or more panel visibility flags. Omitted flags remain unchanged.',
    },
    showReference: { type: 'boolean', description: 'Show or hide the source reference overlay in the plan.' },
  },
  description: 'Provide at least one field. Omitted fields keep their current values.',
}

export function createAppTools(deps: AppToolDependencies): WebMcpToolDefinition[] {
  const getAppState: WebMcpToolDefinition = {
    name: 'get_app_state',
    title: 'Get app state',
    description:
      'Read the current visible workflow stage, plan/3D and simulation views, 3D scene controls, overlays, panels, open dialogs, source reference visibility, active layout and scenario, component selection, simulation-result availability, and undo/redo availability. This does not change the workspace.',
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
        return success(currentRevision(deps), appStatePayload(deps))
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const setAppView: WebMcpToolDefinition = {
    name: 'set_app_view',
    title: 'Set app view',
    description:
      'Navigate the visible app by setting its workflow stage, plan/3D or simulation view, 3D scene controls, overlay, panels, or source reference visibility. Omitted fields remain unchanged; pass overlay null to close an overlay. Open dialogs are reported but cannot be controlled by agents. This does not change the document revision.',
    inputSchema: setAppViewSchema,
    execute: (input) => {
      try {
        const parsed = parseInput(deps, setAppViewInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid app view request.', parsed.issues)
        const state = appStateStore.getState()
        if (parsed.value.stage !== undefined) state.setStage(parsed.value.stage)
        if (parsed.value.view !== undefined) appStateStore.getState().setView(parsed.value.view)
        if (parsed.value.overlay !== undefined) appStateStore.getState().setOverlay(parsed.value.overlay)
        if (parsed.value.walkMode !== undefined) appStateStore.getState().setWalkMode(parsed.value.walkMode)
        if (parsed.value.walkView !== undefined) appStateStore.getState().setWalkView(parsed.value.walkView)
        if (parsed.value.cameraMode !== undefined) appStateStore.getState().setCameraMode(parsed.value.cameraMode)
        if (parsed.value.showClearances !== undefined) appStateStore.getState().setShowClearances(parsed.value.showClearances)
        if (parsed.value.wallsTransparent !== undefined) appStateStore.getState().setWallsTransparent(parsed.value.wallsTransparent)
        if (parsed.value.showLabels !== undefined) appStateStore.getState().setShowLabels(parsed.value.showLabels)
        if (parsed.value.simulationView !== undefined) appStateStore.getState().setSimulationView(parsed.value.simulationView)
        if (parsed.value.panels !== undefined) appStateStore.getState().setPanels(parsed.value.panels)
        if (parsed.value.showReference !== undefined) appStateStore.getState().setShowReference(parsed.value.showReference)
        return success(currentRevision(deps), appStatePayload(deps))
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const selectComponents: WebMcpToolDefinition = {
    name: 'select_components',
    title: 'Select components',
    description:
      'Replace, add to, toggle, or clear the current component selection using IDs from the active layout. Optionally reveal the result in the plan, 3D scene, or split view. Selection does not change the document revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        componentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Component IDs in the active layout. Required and non-empty except when mode is clear.',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'add', 'toggle', 'clear'],
          description: 'Selection operation. Defaults to replace.',
        },
        reveal: {
          type: 'string',
          enum: ['plan', 'scene', 'both'],
          description: 'Optionally switch to the equipment stage and reveal the selection in plan, 3D, or split view.',
        },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, selectComponentsInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid component selection request.', parsed.issues)

        const state = deps.store.getState()
        const activeVariant = state.project.variants.find((variant) => variant.id === state.project.activeVariantId)
        if (!activeVariant) return failure(state.revision, 'missing-variant', 'The active layout variant is missing.')
        const componentIds = [...new Set(parsed.value.componentIds ?? [])]
        const availableIds = new Set(activeVariant.equipment.map((component) => component.id))
        const missingComponentIds = componentIds.filter((id) => !availableIds.has(id))
        if (missingComponentIds.length > 0) {
          return failure(
            state.revision,
            'unknown-component',
            `The active layout does not contain ${missingComponentIds.length === 1 ? 'component' : 'components'}: ${missingComponentIds.join(', ')}.`,
            { activeVariantId: activeVariant.id, missingComponentIds },
          )
        }

        if (parsed.value.mode === 'clear') state.clearSelection()
        else if (parsed.value.mode === 'replace') state.selectItems(componentIds)
        else if (parsed.value.mode === 'add') state.selectItems([...state.selectedIds, ...componentIds])
        else {
          const nextIds = new Set(state.selectedIds)
          componentIds.forEach((id) => {
            if (nextIds.has(id)) nextIds.delete(id)
            else nextIds.add(id)
          })
          state.selectItems([...nextIds])
        }

        if (parsed.value.reveal !== undefined) {
          const appState = appStateStore.getState()
          appState.setStage('equipment')
          appStateStore.getState().setView(parsed.value.reveal === 'both' ? 'split' : parsed.value.reveal)
          appStateStore.getState().setOverlay(null)
        }

        return success(currentRevision(deps), {
          activeVariantId: activeVariant.id,
          selectedIds: [...deps.store.getState().selectedIds],
          stage: appStateStore.getState().stage,
          view: appStateStore.getState().view,
          overlay: appStateStore.getState().overlay,
        })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  const focusCamera: WebMcpToolDefinition = {
    name: 'focus_camera',
    title: 'Focus camera',
    description: 'Move the visible 3D camera to fit the room, frame a component, or inspect an exact millimetre point. Optionally switches between perspective and top view without changing the project revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['target'],
      properties: {
        target: { type: 'string', enum: ['fit', 'component', 'point'], description: 'Camera target type.' },
        componentId: { type: 'string', description: 'Required component ID when target is component.' },
        point: {
          type: 'object',
          additionalProperties: false,
          required: ['xMm', 'yMm'],
          properties: {
            xMm: { type: 'number', description: 'Horizontal millimetres from the room origin.' },
            yMm: { type: 'number', description: 'Vertical millimetres from the room origin.' },
          },
          description: 'Required exact plan point when target is point.',
        },
        cameraMode: { type: 'string', enum: ['perspective', 'top'], description: 'Optional camera preset.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, focusCameraInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid camera focus request.', parsed.issues)
        const projectState = deps.store.getState()
        if (parsed.value.target === 'component') {
          const variant = projectState.project.variants.find((candidate) => candidate.id === projectState.project.activeVariantId)
          if (!variant?.equipment.some((item) => item.id === parsed.value.componentId)) {
            return failure(projectState.revision, 'unknown-component', `Component ${parsed.value.componentId} does not exist in the active layout.`)
          }
          projectState.selectItems([parsed.value.componentId!])
        }
        const appState = appStateStore.getState()
        appState.setStage('equipment')
        appStateStore.getState().setView('scene')
        appStateStore.getState().setOverlay(null)
        appStateStore.getState().setWalkMode(false)
        if (parsed.value.cameraMode) appStateStore.getState().setCameraMode(parsed.value.cameraMode)
        const request = appStateStore.getState().requestCameraFocus({
          target: parsed.value.target,
          ...(parsed.value.componentId ? { componentId: parsed.value.componentId } : {}),
          ...(parsed.value.point ? { point: { x: parsed.value.point.xMm, y: parsed.value.point.yMm } } : {}),
          ...(parsed.value.cameraMode ? { cameraMode: parsed.value.cameraMode } : {}),
        })
        return success(projectState.revision, { requestId: request.id, target: request.target, ...appStatePayload(deps) })
      } catch (error) {
        return failure(currentRevision(deps), 'internal-error', unknownErrorMessage(error))
      }
    },
  }

  return [getAppState, setAppView, selectComponents, focusCamera]
}
