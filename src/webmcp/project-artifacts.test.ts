import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { emptyMetrics } from '../simulation/metrics'
import type { SimulationResultSummary } from '../simulation/types'
import { buildReportHtml, buildResultsReportHtml, equipmentScheduleCsv } from './project-artifacts'

describe('project artifacts', () => {
  it('neutralizes formula-like CSV fields, including formulas hidden by whitespace', () => {
    const project = createSeedProject()
    const variant = structuredClone(project.variants[0])
    variant.equipment[0].id = '=2+3'
    variant.equipment[0].label = ' \t=HYPERLINK("https://malicious.test")'
    variant.equipment[0].xMm = -100

    const csv = equipmentScheduleCsv(variant)

    expect(csv).toContain("'=2+3")
    expect(csv).toContain("\"' \t=HYPERLINK(\"\"https://malicious.test\"\")\"")
    expect(csv).toContain("'-100")
    expect(csv).not.toContain('\n=2+3')
  })

  it('builds one self-contained evidence report and escapes every untrusted surface', () => {
    const project = createSeedProject()
    project.name = '</title><script>alert("project")</script>'
    const variant = project.variants[0]
    variant.name = 'Layout <img src=x onerror=alert(1)>'
    variant.equipment[0].label = '</text><script>alert("equipment")</script>'
    variant.operationalProfile = { menuAssumptions: ['<b onmouseover="bad">raw menu note</b>'] }
    const scenario = project.scenarios[0]
    scenario.name = '<img src=x onerror=alert("scenario")>'
    scenario.menuItems = [{
      id: 'menu-unsafe',
      name: '<script>alert("dish")</script>',
      sharePct: 100,
      source: 'user-provided',
      steps: [{ label: '<svg onload=alert(1)>', capability: 'food-prep', activeSeconds: 30 }],
    }]
    const metrics = emptyMetrics()
    Object.assign(metrics, {
      totalOrders: 10,
      completedOrders: 5,
      peakOrderBacklog: 7,
      orderCompletionP90Seconds: 900,
      unreachableTasks: 2,
      stationUtilization: { 'flat-top-fryer': .91, '<station onmouseover=bad>': .5 },
      queueSeconds: { 'flat-top-fryer': 150, '<station onmouseover=bad>': 30 },
    })
    const simulation: SimulationResultSummary = {
      seed: scenario.seed,
      durationSeconds: 3600,
      metrics,
      warnings: ['<img src=x onerror=alert("warning")>'],
    }

    const html = buildReportHtml({ project, variant, scenario, simulation, generatedAt: '2026-09-03T00:00:00.000Z' })

    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;alert(&quot;project&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;station onmouseover=bad&gt;')
    expect(html).toMatch(/Station utilization and queues[\s\S]*flat-top-fryer[\s\S]*91%[\s\S]*2\.5 min/)
    expect(html).toMatch(/Ranked findings[\s\S]*Priority 1 · high[\s\S]*unreachable task legs/)
    expect(html).toMatch(/Representative menu[\s\S]*User Provided[\s\S]*Food Prep/)
    expect(html).not.toMatch(/<link|<script/)
  })

  it('builds one self-contained report containing each requested layout once', () => {
    const project = createSeedProject()
    const second = structuredClone(project.variants[0])
    second.id = 'second-layout'
    second.name = 'Second layout'
    project.variants.push(second)

    const html = buildResultsReportHtml({
      project,
      reports: [
        { variant: project.variants[0], scenario: project.scenarios[0] },
        { variant: second, scenario: project.scenarios[0] },
      ],
      generatedAt: '2026-09-03T00:00:00.000Z',
    })

    expect(html.match(/<!doctype html>/g)).toHaveLength(1)
    expect(html.match(/Professional review required/g)).toHaveLength(1)
    expect(html).toMatch(/data-variant-id="baseline-trace"[\s\S]*data-variant-id="second-layout"/)
    expect(html).not.toMatch(/<link|<script|<iframe/)
  })
})
