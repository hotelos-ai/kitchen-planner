import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStateStore } from './app-state-store'

describe('app state store', () => {
  const store = createAppStateStore()

  beforeEach(() => store.getState().reset())

  it('owns app navigation independently from project state', () => {
    expect(store.getState()).toMatchObject({
      stage: 'space',
      view: 'plan',
      overlay: null,
      walkView: 'first-person',
      showClearances: false,
      wallsTransparent: true,
      showLabels: false,
      simulationView: 'operations-2d',
      panels: { catalog: true, inspector: true, essentials: false, revisions: false },
      showReference: false,
      dialogsOpen: [],
    })

    store.getState().setStage('equipment')
    store.getState().setView('split')
    store.getState().setOverlay('compare')

    expect(store.getState()).toMatchObject({ stage: 'equipment', view: 'split', overlay: 'compare' })
    store.getState().toggleOverlay('compare')
    expect(store.getState().overlay).toBeNull()
    store.getState().toggleOverlay('auto-layout')
    expect(store.getState().overlay).toBe('auto-layout')
  })

  it('owns visible simulation, panel, reference, and dialog state', () => {
    store.getState().setSimulationView('walk')
    store.getState().setPanels({ catalog: false, essentials: true })
    store.getState().setShowReference(true)
    store.getState().setDialogOpen('help', true)
    store.getState().setDialogOpen('layout-wizard', true)
    store.getState().setDialogOpen('help', true)

    expect(store.getState()).toMatchObject({
      simulationView: 'walk',
      panels: { catalog: false, inspector: true, essentials: true, revisions: false },
      showReference: true,
      dialogsOpen: ['layout-wizard', 'help'],
    })

    store.getState().setDialogOpen('layout-wizard', false)
    expect(store.getState().dialogsOpen).toEqual(['help'])
  })

  it('coordinates shared 3D controls and one-shot focus state', () => {
    store.getState().setWalkMode(true)
    store.getState().setWalkView('third-person')
    store.getState().setCameraMode('top')
    store.getState().setShowClearances(true)
    store.getState().setWallsTransparent(true)
    store.getState().setShowLabels(false)
    const request = store.getState().requestCameraFocus({ target: 'point', point: { x: 1200, y: 800 } })

    expect(store.getState()).toMatchObject({
      walkMode: true,
      walkView: 'third-person',
      cameraMode: 'top',
      showClearances: true,
      wallsTransparent: true,
      showLabels: false,
      cameraFocusRequest: request,
    })
    expect(store.getState().consumeCameraFocus(request.id)).toEqual(request)
    expect(store.getState().cameraFocusRequest).toBeNull()
  })

  it('publishes and consumes deterministic simulation run requests', () => {
    const observed: Array<string | null> = []
    const unsubscribe = store.subscribe((state) => observed.push(state.requestedSimulationRun?.id ?? null))

    const request = store.getState().requestSimulationRun({
      scenarioId: 'dinner-peak',
      variantId: 'baseline',
      seed: 47,
    })

    expect(store.getState().requestedSimulationRun).toEqual(request)
    expect(request).toMatchObject({ scenarioId: 'dinner-peak', variantId: 'baseline', seed: 47, playback: true })
    expect(store.getState().consumeSimulationRun('another-request')).toBeNull()
    expect(store.getState().requestedSimulationRun).toEqual(request)
    expect(store.getState().consumeSimulationRun(request.id)).toEqual(request)
    expect(store.getState().requestedSimulationRun).toBeNull()
    expect(observed).toEqual([request.id, null])
    unsubscribe()
  })

  it('records agent intent and the latest action', () => {
    store.getState().setAgentIntent('Compare dinner service layouts')
    const action = {
      id: 'agent-action-1',
      documentId: 'document-1',
      intent: 'Measure ticket time',
      changedIds: ['tandoor'],
      revision: 3,
    }
    store.getState().setLastAgentAction(action)

    expect(store.getState().agentIntent).toBe('Compare dinner service layouts')
    expect(store.getState().lastAgentAction).toEqual(action)
    expect(store.getState().agentActionHistory).toEqual([action])
    store.getState().clearLastAgentAction('another-action')
    expect(store.getState().lastAgentAction).toEqual(action)
    store.getState().clearLastAgentAction(action.id)
    expect(store.getState().lastAgentAction).toBeNull()
    expect(store.getState().agentActionHistory).toEqual([action])
  })
})
