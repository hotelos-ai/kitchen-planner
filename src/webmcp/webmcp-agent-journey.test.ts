import { beforeEach, describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/blank-project'
import { projectSchema } from '../domain/project-schema'
import { appStateStore } from '../state/app-state-store'
import { createProjectStore, getWorkspaceFacade } from '../state/project-store'
import { simulationRunStore } from '../state/simulation-run-store'
import type { WebMcpToolDefinition } from './model-context'
import type { WebMcpToolResult } from './tool-result'
import { createWebMcpController } from './webmcp-controller'

type Envelope = { ok: boolean; revision: number; code?: string } & Record<string, unknown>

describe('canonical WebMCP agent journey', () => {
  beforeEach(() => {
    appStateStore.getState().reset()
    simulationRunStore.getState().clear()
  })

  it('plans, evaluates, compares, and exports a kitchen in at most 15 tool calls', async () => {
    const store = createProjectStore(createBlankProject('Canonical agent kitchen'))
    const registered = new Map<string, WebMcpToolDefinition>()
    const controller = createWebMcpController({
      store,
      getFacade: () => getWorkspaceFacade(store),
      detect: () => ({
        available: true,
        surface: 'document',
        registerTool: (tool) => {
          registered.set(tool.name, tool)
          return Promise.resolve()
        },
      }),
    })
    await controller.register()

    let toolCalls = 0
    const call = async (name: string, input: unknown): Promise<Envelope> => {
      toolCalls += 1
      const tool = registered.get(name)
      if (!tool) throw new Error(`Tool ${name} was not registered`)
      const result = await tool.execute(input) as WebMcpToolResult
      expect(result.content[0]?.type, `${name} MCP content`).toBe('text')
      expect(JSON.parse(result.content[0].text), `${name} JSON content`).toEqual(result.structuredContent)
      return result.structuredContent as Envelope
    }

    const guide = await call('get_workspace_guide', { detail: 'full' })
    expect(guide).toMatchObject({ ok: true, operationSchema: expect.any(Object), errorCodeTaxonomy: expect.any(Array) })

    const catalog = await call('get_component_catalog', { limit: 100 })
    const entries = catalog.entries as { catalogId: string }[]
    const equipmentCatalogIds = [
      'hot-six-burner-range',
      'cold-upright-refrigerator',
      'prep-work-table',
      'wash-dirty-landing',
      'wash-pre-rinse-sink',
      'wash-undercounter-dishwasher',
      'wash-clean-landing',
      'sanitation-hand-sink',
    ]
    expect(entries.map((entry) => entry.catalogId)).toEqual(expect.arrayContaining(equipmentCatalogIds))

    const initial = await call('get_layout', { view: 'summary' })
    const baselineVariantId = initial.activeVariantId as string
    const scenarioId = store.getState().project.activeScenarioId
    const positions = [
      { xMm: 100, yMm: 100 },
      { xMm: 100, yMm: 100 },
      { xMm: 2400, yMm: 100 },
      { xMm: 100, yMm: 2500 },
      { xMm: 1100, yMm: 2500 },
      { xMm: 2100, yMm: 2500 },
      { xMm: 3000, yMm: 2500 },
      { xMm: 100, yMm: 4000 },
    ]
    const equipmentOperations = equipmentCatalogIds.map((catalogId, index) => ({
      type: 'add_component',
      variantId: baselineVariantId,
      componentId: `journey-item-${index + 1}`,
      catalogId,
      position: positions[index],
    }))
    const fitted = await call('apply_layout_changes', {
      expectedRevision: initial.revision,
      idempotencyKey: 'canonical-room-and-equipment-v1',
      intent: 'Draw a four-by-six-metre room and place eight essential items',
      operations: [
        {
          type: 'update_architecture',
          variantId: baselineVariantId,
          patch: {
            locked: false,
            widthMm: 4_000,
            depthMm: 6_000,
            roomPolygon: [
              { xMm: 0, yMm: 0 },
              { xMm: 4_000, yMm: 0 },
              { xMm: 4_000, yMm: 6_000 },
              { xMm: 0, yMm: 6_000 },
            ],
            openings: [
              { id: 'main-entry', label: 'Staff entrance', kind: 'door', wall: 'bottom', segmentIndex: 2, offsetMm: 1_550, widthMm: 900, flow: 'entry', swingDepthMm: 900 },
              { id: 'clean-pass', label: 'Clean service pass', kind: 'service-window', wall: 'right', segmentIndex: 1, offsetMm: 1_000, widthMm: 900, flow: 'clean-out' },
              { id: 'dirty-return', label: 'Dirty return', kind: 'service-window', wall: 'right', segmentIndex: 1, offsetMm: 3_500, widthMm: 900, flow: 'dirty-in' },
            ],
          },
        },
        ...equipmentOperations,
      ],
    })
    expect(fitted).toMatchObject({ ok: true, revision: 1, changedIds: expect.arrayContaining(['architecture', 'journey-item-8']) })

    const diagnostics = await call('analyze_layout', { variantId: baselineVariantId })
    expect(diagnostics).toMatchObject({ ok: true, findings: expect.any(Array) })
    expect((diagnostics.findings as unknown[]).length).toBeGreaterThan(0)
    const fixed = await call('apply_layout_changes', {
      expectedRevision: fitted.revision,
      idempotencyKey: 'canonical-diagnostic-fix-v1',
      intent: 'Resolve the intentionally detected equipment overlap',
      operations: [{
        type: 'move_components',
        variantId: baselineVariantId,
        componentIds: ['journey-item-2'],
        anchor: { xMm: 1_500, yMm: 100 },
      }],
    })
    expect(fixed).toMatchObject({ ok: true, revision: 2, changedIds: ['journey-item-2'] })
    const essentials = await call('check_operational_essentials', { variantId: baselineVariantId, scenarioId })
    expect(essentials).toMatchObject({ ok: true, status: expect.stringMatching(/^(blocked|ready|ready-with-warnings)$/) })

    const menuItems = [
      ['menu-cold', 'Cold starter', 'cold-retrieval'],
      ['menu-prep', 'Prepared salad', 'food-prep'],
      ['menu-range', 'Range main', 'range-cook'],
      ['menu-finish', 'Finished plate', 'finish-plate'],
      ['menu-dessert', 'Plated dessert', 'finish-plate'],
    ].map(([id, name, capability]) => ({
      id,
      name,
      sharePct: 20,
      source: 'user-provided',
      steps: [{ label: name, capability, activeSeconds: 30 }],
    }))
    const candidateVariantId = 'canonical-candidate'
    const scenarioAndCandidate = await call('apply_layout_changes', {
      expectedRevision: fixed.revision,
      idempotencyKey: 'canonical-menu-and-candidate-v1',
      intent: 'Add the service menu and a comparison layout',
      operations: [
        { type: 'update_scenario', variantId: baselineVariantId, scenarioId, patch: { menuItems } },
        { type: 'create_layout', variantId: candidateVariantId, parentVariantId: baselineVariantId, name: 'Candidate layout', equipmentMode: 'duplicate' },
        { type: 'nudge_components', variantId: candidateVariantId, componentIds: ['journey-item-1'], delta: { xMm: 100, yMm: 0 } },
      ],
    })
    expect(scenarioAndCandidate).toMatchObject({ ok: true, revision: 3, changedIds: expect.arrayContaining([scenarioId, candidateVariantId, 'journey-item-1']) })

    const simulation = await call('run_simulation', {
      variantId: baselineVariantId,
      scenarioId,
      seed: 4242,
      playback: 'pause',
      navigateTo: true,
    })
    expect(simulation, JSON.stringify(simulation)).toMatchObject({ ok: true, revision: 3, scenario: { id: scenarioId, seed: 4242 } })

    const comparison = await call('compare_layouts', {
      baselineVariantId,
      candidateVariantId,
      scenarioId,
      openOverlay: true,
    })
    expect(comparison).toMatchObject({
      ok: true,
      revision: 3,
      baseline: { variantId: baselineVariantId },
      candidate: { variantId: candidateVariantId },
      metricDeltas: expect.any(Object),
      overlayOpened: true,
    })

    const exported = await call('export_project', { format: 'project-json' })
    expect(exported.ok).toBe(true)
    const parsedProject = projectSchema.parse(JSON.parse(exported.projectJson as string))
    expect(parsedProject.variants).toHaveLength(2)
    expect(parsedProject.scenarios[0].menuItems).toHaveLength(5)
    expect(parsedProject.variants[0].equipment.filter((item) => item.id.startsWith('journey-item-'))).toHaveLength(8)
    expect(parsedProject.variants[0].architecture).toMatchObject({ widthMm: 4_000, depthMm: 6_000 })

    const visibleState = await call('get_app_state', {})
    expect(visibleState).toMatchObject({ ok: true, revision: 3, stage: 'simulate', overlay: 'compare' })
    expect(store.getState()).toMatchObject({ revision: 3 })
    expect(toolCalls).toBeLessThanOrEqual(15)
    expect(toolCalls).toBe(12)
    controller.dispose()
  })
})
