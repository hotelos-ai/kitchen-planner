import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import type { WebMcpToolDefinition } from './model-context'
import { createWebMcpTools } from './webmcp-tools'

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const tools = createWebMcpTools({ store, getFacade: () => getWorkspaceFacade(store) })
  const tool = (name: string): WebMcpToolDefinition => {
    const found = tools.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`Missing tool ${name}`)
    return found
  }
  return { store, tool }
}

describe('visible WebMCP actions', () => {
  beforeEach(() => appStateStore.getState().reset())

  it('navigates to Simulate and requests playback for an agent-run simulation', async () => {
    const { store, tool } = setup()
    const result = await tool('run_simulation').execute({ seed: 4242 }) as { ok: boolean }

    expect(result.ok).toBe(true)
    expect(appStateStore.getState()).toMatchObject({
      stage: 'simulate',
      overlay: null,
      requestedSimulationRun: {
        scenarioId: store.getState().project.activeScenarioId,
        variantId: store.getState().project.activeVariantId,
        seed: 4242,
        playback: true,
      },
    })
  })

  it('surfaces the committed agent intent as one undoable action', async () => {
    const { store, tool } = setup()
    const revision = store.getState().revision
    const preview = await tool('preview_layout_changes').execute({
      expectedRevision: revision,
      operations: [{
        type: 'nudge_components',
        variantId: store.getState().project.activeVariantId,
        componentIds: ['tandoor'],
        delta: { xMm: 50, yMm: 0 },
      }],
      intent: 'Cleared the tandoor aisle',
    }) as { ok: boolean; previewToken: string }
    expect(preview.ok).toBe(true)

    const applied = await tool('apply_layout_changes').execute({ previewToken: preview.previewToken }) as { ok: boolean }
    expect(applied.ok).toBe(true)
    expect(appStateStore.getState().lastAgentAction).toMatchObject({
      intent: 'Cleared the tandoor aisle',
      changedIds: ['tandoor'],
      revision: revision + 1,
    })
    expect(store.getState().past).toHaveLength(1)
  })
})
