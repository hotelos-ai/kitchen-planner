import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStateStore } from './app-state-store'

describe('app state store', () => {
  const store = createAppStateStore()

  beforeEach(() => store.getState().reset())

  it('owns app navigation independently from project state', () => {
    expect(store.getState()).toMatchObject({ stage: 'space', view: 'plan', overlay: null })

    store.getState().setStage('equipment')
    store.getState().setView('split')
    store.getState().setOverlay('compare')

    expect(store.getState()).toMatchObject({ stage: 'equipment', view: 'split', overlay: 'compare' })
    store.getState().toggleOverlay('compare')
    expect(store.getState().overlay).toBeNull()
    store.getState().toggleOverlay('auto-layout')
    expect(store.getState().overlay).toBe('auto-layout')
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
      intent: 'Measure ticket time',
      changedIds: ['tandoor'],
      revision: 3,
    }
    store.getState().setLastAgentAction(action)

    expect(store.getState().agentIntent).toBe('Compare dinner service layouts')
    expect(store.getState().lastAgentAction).toEqual(action)
    store.getState().clearLastAgentAction('another-action')
    expect(store.getState().lastAgentAction).toEqual(action)
    store.getState().clearLastAgentAction(action.id)
    expect(store.getState().lastAgentAction).toBeNull()
  })
})
