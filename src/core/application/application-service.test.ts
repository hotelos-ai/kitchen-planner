import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getWorkspaceFacade } from '../../state/project-store'
import { createApplicationService } from './application-service'

describe('ApplicationService', () => {
  it('validates project replacement and exposes deterministic scenario runs', () => {
    const project = createSeedProject()
    const service = createApplicationService({ store: createProjectStore(project) })
    expect(service.replaceProject({ project, expectedRevision: 0, dryRun: true })).toMatchObject({ ok: true, revision: 0, dryRun: true })
    const result = service.runSimulation({ variantId: 'baseline-trace', scenarioId: 'dinner-peak', seed: 47, outputMode: 'metrics-only' })
    expect(result).toMatchObject({ seed: 47, metrics: { totalOrders: expect.any(Number) } })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('updates scenarios through the same preview/apply operations exposed to agents', () => {
    const service = createApplicationService({ store: createProjectStore(createSeedProject()) })
    const preview = service.previewLayoutChanges({ expectedRevision: 0, operations: [{ type: 'update_scenario', variantId: 'baseline-trace', scenarioId: 'dinner-peak', patch: { covers: 40 } }], intent: 'Change covers' })
    expect(preview).toMatchObject({ ok: true, revision: 0 })
    if (!preview.ok) throw new Error(preview.message)
    expect(service.applyLayoutChanges({ previewToken: preview.previewToken })).toMatchObject({ ok: true, revision: 1 })
  })

  it('exposes catalog, requirements, placement, and JSON-safe live simulation queries', () => {
    const service = createApplicationService({ store: createProjectStore(createSeedProject()) })
    expect(service.getComponentCatalog({ category: 'storage' }).length).toBeGreaterThan(5)
    expect(service.getLayoutRequirements({ variantId: 'baseline-trace', scenarioId: 'dinner-peak' }).length).toBeGreaterThan(0)
    expect(service.suggestPlacement({ variantId: 'baseline-trace', catalogId: 'storage-wall-shelf' })).not.toBeNull()
    expect(service.querySimulation({ scenarioId: 'dinner-peak', elapsedSeconds: 900 })).toMatchObject({ ok: false, code: 'missing-run' })
    service.runSimulation({ variantId: 'baseline-trace', scenarioId: 'dinner-peak', seed: 47 })
    const live = service.querySimulation({ scenarioId: 'dinner-peak', elapsedSeconds: 900 })
    expect(live).toMatchObject({ ok: true, data: { assumptions: { seed: 47 }, progress: { elapsedSeconds: 900 } } })
    expect(JSON.parse(JSON.stringify(live))).toEqual(live)
  })

  it('runs against variant-owned architecture rather than the active compatibility mirror', () => {
    const project = createSeedProject()
    project.variants.push({
      ...structuredClone(project.variants[0]),
      id: 'compact-room',
      name: 'Compact room',
      architecture: { ...structuredClone(project.variants[0].architecture), widthMm: 4_200 },
    })
    const store = createProjectStore(project)
    const service = createApplicationService({ store })

    const request = { variantId: 'compact-room', scenarioId: 'dinner-peak', seed: 7, outputMode: 'metrics-only' as const }

    expect(service.runSimulation(request)).toEqual(getWorkspaceFacade(store).runSimulation(request))
  })
})
