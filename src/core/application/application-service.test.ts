import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { createProjectStore } from '../../state/project-store'
import { createApplicationService } from './application-service'

describe('ApplicationService', () => {
  it('validates project replacement and exposes deterministic scenario runs', () => {
    const project = createSeedProject()
    const service = createApplicationService({ store: createProjectStore(project), runSimulation })
    expect(service.replaceProject({ project, expectedRevision: 0, dryRun: true })).toMatchObject({ ok: true, revision: 0, dryRun: true })
    const result = service.runScenario({ scenarioId: 'dinner-peak', expectedRevision: 0 })
    expect(result).toMatchObject({ ok: true, revision: 0 })
    if (result.ok) expect(result.data.metrics.totalOrders).toBeGreaterThan(0)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('updates scenarios with stale-write protection and dry-run support', () => {
    const service = createApplicationService({ store: createProjectStore(createSeedProject()), runSimulation })
    expect(service.updateScenario({ scenarioId: 'dinner-peak', patch: { covers: 40 }, dryRun: true })).toMatchObject({ ok: true, revision: 0, dryRun: true })
    expect(service.updateScenario({ scenarioId: 'dinner-peak', patch: { covers: 40 }, expectedRevision: 8 })).toMatchObject({ ok: false, code: 'stale-revision' })
    expect(service.updateScenario({ scenarioId: 'dinner-peak', patch: { covers: 40 }, expectedRevision: 0 })).toMatchObject({ ok: true, revision: 1 })
  })

  it('exposes a JSON-safe live simulation query after a deterministic run', () => {
    const service = createApplicationService({ store: createProjectStore(createSeedProject()), runSimulation })
    expect(service.querySimulation({ scenarioId: 'dinner-peak', elapsedSeconds: 900 })).toMatchObject({ ok: false, code: 'missing-run' })
    expect(service.runScenario({ scenarioId: 'dinner-peak' })).toMatchObject({ ok: true })
    const result = service.querySimulation({ scenarioId: 'dinner-peak', elapsedSeconds: 900 })
    expect(result).toMatchObject({ ok: true, revision: 0, data: { progress: { elapsedSeconds: 900 }, assumptions: { covers: 50 } } })
    expect(JSON.stringify(result)).toContain('stationQueues')
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})
