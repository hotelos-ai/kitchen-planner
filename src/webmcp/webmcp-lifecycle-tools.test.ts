import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/blank-project'
import { createSeedProject } from '../domain/seed-project'
import { emptyMetrics } from '../simulation/metrics'
import type { SimulationResult } from '../simulation/types'
import { exportProject } from '../state/persistence'
import { createProjectStore } from '../state/project-store'
import { createSimulationRunStore } from '../state/simulation-run-store'
import type { WebMcpToolDefinition } from './model-context'
import { createLifecycleTools } from './webmcp-lifecycle-tools'

type Envelope = { ok: boolean; revision: number; code?: string } & Record<string, unknown>

const setup = () => {
  const store = createProjectStore(createSeedProject())
  const runStore = createSimulationRunStore()
  const tools = createLifecycleTools({ store, runStore })
  const call = (name: string, input: unknown) => {
    const tool = tools.find((candidate) => candidate.name === name) as WebMcpToolDefinition | undefined
    if (!tool) throw new Error(`Missing ${name}`)
    return tool.execute(input) as Envelope
  }
  return { store, runStore, call }
}

const simulationResult = (): SimulationResult => {
  const metrics = emptyMetrics()
  Object.assign(metrics, {
    totalOrders: 12,
    completedOrders: 10,
    stationUtilization: { dishwasher: .82 },
    queueSeconds: { dishwasher: 180 },
  })
  return {
    seed: 42,
    durationSeconds: 3600,
    metrics,
    warnings: ['Observed report warning'],
    frames: [],
    events: [],
    taskTimeline: [],
    orders: [],
  }
}

describe('WebMCP project lifecycle tools', () => {
  it('exports project JSON, CSV, HTML, and SVG artifacts', () => {
    const { call } = setup()
    const json = call('export_project', {})
    expect(json).toMatchObject({ ok: true, format: 'project-json', mimeType: expect.stringContaining('application/json'), downloaded: false })
    expect(JSON.parse(json.contents as string)).toMatchObject({ name: expect.any(String) })

    const csv = call('export_project', { format: 'equipment-schedule-csv' })
    expect(csv.contents).toMatch(/^ID,Item,Category,/)
    expect(csv.mimeType).toContain('text/csv')

    const html = call('export_project', { format: 'report-html' })
    expect(html.contents).toMatch(/<!doctype html>/)
    expect(html.contents).toMatch(/Professional review required/)
    expect(html.contents).toMatch(/<svg/)

    const svg = call('export_project', { format: 'plan-svg' })
    expect(svg.contents).toMatch(/^<svg/)
    expect(svg.contents).toContain('kitchen plan')
  })

  it('includes revision-matched retained simulation evidence in report HTML', () => {
    const { store, runStore, call } = setup()
    const project = store.getState().project
    const result = simulationResult()
    runStore.getState().storeRun({
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      result,
      seed: result.seed,
      ranAtRevision: store.getState().revision,
    })

    const report = call('export_project', { format: 'report-html' })

    expect(report.contents).toMatch(/Completed orders<\/th><td>10 of 12/)
    expect(report.contents).toMatch(/Station utilization and queues[\s\S]*Dishwasher[\s\S]*82%[\s\S]*3\.0 min/)
    expect(report.contents).toMatch(/Ranked findings[\s\S]*Reduce pressure at Dishwasher/)
    expect(report.contents).toContain('Observed report warning')
  })

  it('excludes retained simulation evidence from an older revision', () => {
    const { store, runStore, call } = setup()
    const project = store.getState().project
    const result = simulationResult()
    runStore.getState().storeRun({
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      result,
      seed: result.seed,
      ranAtRevision: store.getState().revision,
    })
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })

    const report = call('export_project', { format: 'report-html' })

    expect(report.contents).toContain('No current simulation result was included.')
    expect(report.contents).toContain('No findings are available without a current simulation result.')
    expect(report.contents).not.toContain('Observed report warning')
  })

  it('imports a replacement atomically with stale-revision protection', () => {
    const { store, call } = setup()
    const replacement = createBlankProject()
    replacement.name = 'Imported blank'
    expect(call('import_project', { projectJson: exportProject(replacement), expectedRevision: 1 })).toMatchObject({ ok: false, code: 'stale-revision' })
    const imported = call('import_project', { projectJson: exportProject(replacement), expectedRevision: 0 })
    expect(imported).toMatchObject({ ok: true, revision: 1, mode: 'replace' })
    expect(store.getState().project.name).toBe('Imported blank')
    expect(store.getState().past).toHaveLength(1)
  })

  it('adds an imported layout without replacing the current project', () => {
    const { store, call } = setup()
    const originalId = store.getState().project.id
    const imported = call('import_project', {
      projectJson: exportProject(createSeedProject()),
      expectedRevision: 0,
      mode: 'add-as-variant',
    })
    expect(imported).toMatchObject({ ok: true, revision: 1, mode: 'add-as-variant', variantCount: 2 })
    expect(store.getState().project.id).toBe(originalId)
    expect(store.getState().project.variants[1].name).toMatch(/imported/i)
  })

  it('creates, lists, and restores named checkpoints', () => {
    const { store, call } = setup()
    const created = call('manage_checkpoints', { action: 'create', label: 'Before agent redesign', expectedRevision: 0 })
    expect(created).toMatchObject({ ok: true, action: 'created', checkpointId: expect.any(String) })
    const listed = call('manage_checkpoints', { action: 'list' })
    expect(listed).toMatchObject({ ok: true, checkpoints: [expect.objectContaining({ label: 'Before agent redesign' })] })
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    expect(call('manage_checkpoints', { action: 'restore', checkpointId: created.checkpointId, expectedRevision: 1 })).toMatchObject({ ok: false, code: 'stale-revision' })
    const restored = call('manage_checkpoints', { action: 'restore', checkpointId: created.checkpointId, expectedRevision: store.getState().revision })
    expect(restored).toMatchObject({ ok: true, action: 'restored' })
    expect(store.getState().past.length).toBeGreaterThanOrEqual(3)
  })
})
