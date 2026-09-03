import type { KitchenProject, LayoutVariant, SimulationScenario } from '../domain/project'
import type { LayoutFinding, MetricDelta } from '../simulation/recommendations'
import type { SimulationResultSummary } from '../simulation/types'
import { exportProject } from '../state/persistence'

const escapeText = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const safeNumber = (value: number): string => Number.isFinite(value) ? String(value) : '0'

const csvCell = (value: unknown): string => {
  const raw = String(value ?? '')
  // Leading whitespace does not make spreadsheet formulas safe: Excel and
  // Sheets can still interpret the first formula sigil after trimming it.
  let formulaIndex = 0
  while (formulaIndex < raw.length && (raw.charCodeAt(formulaIndex) <= 0x20 || raw.charCodeAt(formulaIndex) === 0xFEFF)) formulaIndex += 1
  const formulaSigil = raw[formulaIndex]
  const text = formulaSigil !== undefined && '=+-@'.includes(formulaSigil) ? `'${raw}` : raw
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const humanize = (value: string): string => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const seconds = (value: number): string => `${Math.round(value)} s`
const minutes = (value: number): string => `${(value / 60).toFixed(1)} min`
const metres = (value: number): string => `${(value / 1000).toFixed(1)} m`
const percentage = (value: number): string => `${Math.round(value * 100)}%`

export const projectSlug = (project: KitchenProject): string =>
  project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kitchen-plan'

export function equipmentScheduleCsv(variant: LayoutVariant): string {
  const header = ['ID', 'Item', 'Category', 'Width mm', 'Depth mm', 'Height mm', 'X mm', 'Y mm', 'Rotation deg', 'Approximate']
  const rows = variant.equipment.map((item) => [
    item.id, item.label, item.category, item.widthMm, item.depthMm, item.heightMm,
    item.xMm, item.yMm, item.rotationDeg, item.approximate === true ? 'yes' : 'no',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function planSvg(variant: LayoutVariant): string {
  const { architecture } = variant
  const polygon = architecture.roomPolygon
    .map((point) => `${safeNumber(point.x)},${safeNumber(point.y)}`)
    .join(' ')
  const equipment = variant.equipment.map((item) => {
    const centreX = item.xMm + item.widthMm / 2
    const centreY = item.yMm + item.depthMm / 2
    return `<g transform="rotate(${safeNumber(item.rotationDeg)} ${safeNumber(centreX)} ${safeNumber(centreY)})"><rect x="${safeNumber(item.xMm)}" y="${safeNumber(item.yMm)}" width="${safeNumber(item.widthMm)}" height="${safeNumber(item.depthMm)}" rx="40"/><text x="${safeNumber(centreX)}" y="${safeNumber(centreY)}" text-anchor="middle" dominant-baseline="middle">${escapeText(item.label)}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeText(variant.name)} kitchen plan" viewBox="0 0 ${safeNumber(architecture.widthMm)} ${safeNumber(architecture.depthMm)}"><style>polygon{fill:#f7f4ea;stroke:#22281f;stroke-width:35}rect{fill:#b1d15b;stroke:#34412d;stroke-width:18}text{font:120px system-ui,sans-serif;fill:#1f241d}</style><polygon points="${polygon}"/>${equipment}</svg>`
}

type ReportFinding = Pick<LayoutFinding, 'severity' | 'title' | 'explanation' | 'evidence'>

const currentRunFindings = (simulation: SimulationResultSummary, variant: LayoutVariant): ReportFinding[] => {
  const { metrics } = simulation
  const completionRate = metrics.totalOrders > 0 ? metrics.completedOrders / metrics.totalOrders : 0
  const queueLeader = Object.entries(metrics.queueSeconds).sort((left, right) => right[1] - left[1])[0]
  const findings: ReportFinding[] = []
  if (metrics.unreachableTasks > 0) findings.push({
    severity: 'high', title: 'Restore unobstructed station access',
    explanation: 'Required task legs could not reach their assigned station on the modeled circulation grid.',
    evidence: [`${metrics.unreachableTasks} unreachable task legs`, ...simulation.warnings.slice(0, 2)],
  })
  if (metrics.totalOrders > 0 && completionRate < .75) findings.push({
    severity: 'high', title: 'Modeled demand exceeds this service setup',
    explanation: 'Fewer than three quarters of modeled orders completed within the selected service window.',
    evidence: [`${metrics.completedOrders} of ${metrics.totalOrders} orders completed (${Math.round(completionRate * 100)}%)`, `Peak backlog: ${metrics.peakOrderBacklog}`],
  })
  if (metrics.hotLineCongestionEvents > 20) findings.push({
    severity: metrics.hotLineCongestionEvents > 100 ? 'high' : 'medium', title: 'Review hot-line working space',
    explanation: 'The run recorded repeated close-proximity samples around cooking stations.',
    evidence: [`${metrics.hotLineCongestionEvents} hot-line congestion samples`],
  })
  if (queueLeader && queueLeader[1] > 0) findings.push({
    severity: 'medium', title: `Reduce pressure at ${variant.equipment.find((item) => item.id === queueLeader[0])?.label ?? humanize(queueLeader[0])}`,
    explanation: 'This station accumulated the most modeled task waiting during the run.',
    evidence: [`${minutes(queueLeader[1])} cumulative queue time`, `${percentage(metrics.stationUtilization[queueLeader[0]] ?? 0)} utilization`],
  })
  if (metrics.dirtyCleanCrossings > 0) findings.push({
    severity: 'medium', title: 'Separate dirty return from clean production',
    explanation: 'Modeled dirty-return and wash-up routes crossed clean production traffic.',
    evidence: [`${metrics.dirtyCleanCrossings} dirty-clean crossings`],
  })
  if (metrics.doorConflictEvents > 0) findings.push({
    severity: 'medium', title: 'Keep the entry approach clear',
    explanation: 'Concurrent modeled traffic entered the door conflict zone.',
    evidence: [`${metrics.doorConflictEvents} door-zone conflicts`],
  })
  if (findings.length === 0) findings.push({
    severity: 'positive', title: 'No priority operational signal detected',
    explanation: 'This run completed without the report thresholds identifying an access, queue, crossing, or congestion concern.',
    evidence: [`${metrics.completedOrders} of ${metrics.totalOrders} orders completed`, `P90 ticket time: ${minutes(metrics.orderCompletionP90Seconds)}`],
  })
  const severityRank = { high: 0, medium: 1, positive: 2 }
  return findings.sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
}

const scenarioSection = (scenario: SimulationScenario | undefined, variant: LayoutVariant): string => {
  if (!scenario) return '<section><h2>Scenario and menu assumptions</h2><p>No scenario configured.</p></section>'
  const staff = scenario.staff.map((entry) => `${entry.count} × ${humanize(entry.role)}`).join(', ')
  const checks = Object.entries(scenario.checks).filter(([, enabled]) => enabled).map(([name]) => humanize(name)).join(', ') || 'None'
  const menuRows = scenario.menuItems?.map((item) => `<tr><th>${escapeText(item.name)}</th><td>${escapeText(`${item.sharePct}%`)}</td><td>${escapeText(humanize(item.source))}</td><td>${escapeText(item.steps.map((step) => `${step.label} (${humanize(step.capability)}, ${seconds(step.activeSeconds)} active${step.passiveSeconds ? `, ${step.passiveSeconds.minSeconds}–${step.passiveSeconds.maxSeconds} s passive` : ''})`).join(' → '))}</td></tr>`).join('') ?? ''
  const durationRows = Object.entries(scenario.taskDurations ?? {}).map(([capability, range]) => `<tr><th>${escapeText(humanize(capability))}</th><td>${escapeText(`${range.minSeconds}–${range.maxSeconds} s`)}</td></tr>`).join('')
  const labels = new Map(variant.equipment.map((item) => [item.id, item.label]))
  const capacityRows = Object.entries(scenario.stationCapacities ?? {}).map(([stationId, capacity]) => `<tr><th>${escapeText(labels.get(stationId) ?? humanize(stationId))}</th><td>${escapeText(capacity)}</td></tr>`).join('')
  const profileAssumptions = variant.operationalProfile?.menuAssumptions ?? []
  return `<section><h2>Scenario and menu assumptions</h2><dl class="assumptions"><div><dt>Scenario</dt><dd>${escapeText(scenario.name)}</dd></div><div><dt>Demand</dt><dd>${escapeText(`${scenario.covers} covers over ${scenario.durationMinutes} minutes · ${humanize(scenario.arrivalPattern)}`)}</dd></div><div><dt>Service</dt><dd>${escapeText(`${Math.round(scenario.cookToOrderRatio * 100)}% cooked to order${scenario.serviceStyle ? ` · ${scenario.serviceStyle}` : ''}${scenario.variability ? ` · ${scenario.variability} variability` : ''}`)}</dd></div><div><dt>Staff</dt><dd>${escapeText(staff)}</dd></div><div><dt>Deterministic seed</dt><dd>${escapeText(scenario.seed)}</dd></div><div><dt>Enabled checks</dt><dd>${escapeText(checks)}</dd></div></dl>${menuRows ? `<h3>Representative menu</h3><table><thead><tr><th>Item</th><th>Mix</th><th>Source</th><th>Modeled station route and timing</th></tr></thead><tbody>${menuRows}</tbody></table>` : '<p>No structured menu items were supplied; the simulation used its compatibility demand model and configured task durations.</p>'}${durationRows ? `<h3>Default task timings</h3><table><thead><tr><th>Capability</th><th>Range</th></tr></thead><tbody>${durationRows}</tbody></table>` : ''}${capacityRows ? `<h3>Station capacities</h3><table><thead><tr><th>Station</th><th>Concurrent tasks</th></tr></thead><tbody>${capacityRows}</tbody></table>` : ''}${profileAssumptions.length ? `<h3>Layout menu notes</h3><ul>${profileAssumptions.map((assumption) => `<li>${escapeText(assumption)}</li>`).join('')}</ul>` : ''}</section>`
}

const simulationSection = (simulation: SimulationResultSummary | null | undefined, variant: LayoutVariant): string => {
  if (!simulation) return '<section><h2>Simulation evidence</h2><p>No current simulation result was included. Run the selected scenario after the latest project change to include measured model output.</p></section>'
  const metricRows: [string, string | number][] = [
    ['Run seed', simulation.seed],
    ['Completed orders', `${simulation.metrics.completedOrders} of ${simulation.metrics.totalOrders}`],
    ['P50 ticket time', seconds(simulation.metrics.orderCompletionP50Seconds)],
    ['P90 ticket time', seconds(simulation.metrics.orderCompletionP90Seconds)],
    ['Throughput / hour', Math.round(simulation.metrics.throughputPerHour * 10) / 10],
    ['Total staff travel', metres(simulation.metrics.totalTravelMm)],
    ['Peak backlog', simulation.metrics.peakOrderBacklog],
    ['Dirty-clean crossings', simulation.metrics.dirtyCleanCrossings],
    ['Door conflicts', simulation.metrics.doorConflictEvents],
    ['Unreachable tasks', simulation.metrics.unreachableTasks],
  ]
  const stationIds = [...new Set([...Object.keys(simulation.metrics.stationUtilization), ...Object.keys(simulation.metrics.queueSeconds)])]
    .sort((left, right) => (simulation.metrics.queueSeconds[right] ?? 0) - (simulation.metrics.queueSeconds[left] ?? 0)
      || (simulation.metrics.stationUtilization[right] ?? 0) - (simulation.metrics.stationUtilization[left] ?? 0)
      || left.localeCompare(right))
  const labels = new Map(variant.equipment.map((item) => [item.id, item.label]))
  const stationRows = stationIds.map((stationId) => `<tr><th>${escapeText(labels.get(stationId) ?? humanize(stationId))}</th><td>${escapeText(stationId)}</td><td>${escapeText(percentage(simulation.metrics.stationUtilization[stationId] ?? 0))}</td><td>${escapeText(minutes(simulation.metrics.queueSeconds[stationId] ?? 0))}</td></tr>`).join('')
  return `<section><h2>Simulation evidence</h2><table><tbody>${metricRows.map(([label, value]) => `<tr><th>${escapeText(label)}</th><td>${escapeText(value)}</td></tr>`).join('')}</tbody></table><h3>Station utilization and queues</h3>${stationRows ? `<table><thead><tr><th>Station</th><th>ID</th><th>Utilization</th><th>Cumulative queue</th></tr></thead><tbody>${stationRows}</tbody></table>` : '<p>No station activity was recorded.</p>'}${simulation.warnings.length ? `<h3>Model warnings</h3><ul>${simulation.warnings.map((warning) => `<li>${escapeText(warning)}</li>`).join('')}</ul>` : ''}</section>`
}

const comparisonSection = (comparison: { baselineLabel: string; candidateLabel: string; deltas: readonly MetricDelta[] } | undefined): string => {
  if (!comparison) return ''
  const rows = comparison.deltas.map((delta) => `<tr><th>${escapeText(delta.label)}</th><td>${escapeText(Math.round(delta.baseline * 10) / 10)}</td><td>${escapeText(Math.round(delta.candidate * 10) / 10)}</td><td>${escapeText(`${delta.delta > 0 ? '+' : ''}${Math.round(delta.delta * 10) / 10}`)}</td></tr>`).join('')
  return `<section><h2>Comparison</h2><table><thead><tr><th>Measure</th><th>${escapeText(comparison.baselineLabel)}</th><th>${escapeText(comparison.candidateLabel)}</th><th>Delta</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

export function buildReportHtml(input: {
  project: KitchenProject
  variant: LayoutVariant
  scenario?: SimulationScenario
  simulation?: SimulationResultSummary | null
  findings?: readonly ReportFinding[]
  comparison?: { baselineLabel: string; candidateLabel: string; deltas: readonly MetricDelta[] }
  generatedAt?: string
}): string {
  const { project, variant, simulation } = input
  const scenario = input.scenario ?? project.scenarios.find((candidate) => candidate.id === project.activeScenarioId) ?? project.scenarios[0]
  const severityRank = { high: 0, medium: 1, positive: 2 }
  const findings = [...(input.findings ?? (simulation ? currentRunFindings(simulation, variant) : []))]
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
  const findingMarkup = findings.length
    ? findings.map((finding, index) => `<article class="finding ${escapeText(finding.severity)}"><p class="rank">Priority ${index + 1} · ${escapeText(finding.severity)}</p><h3>${escapeText(finding.title)}</h3><p>${escapeText(finding.explanation)}</p><ul>${finding.evidence.map((evidence) => `<li>${escapeText(evidence)}</li>`).join('')}</ul></article>`).join('')
    : '<p>No findings are available without a current simulation result.</p>'
  const equipmentRows = variant.equipment.map((item) => `<tr><td>${escapeText(item.label)}</td><td>${escapeText(item.category)}</td><td>${escapeText(`${item.widthMm} × ${item.depthMm}`)}</td><td>${escapeText(`${item.xMm}, ${item.yMm}`)}</td></tr>`).join('')
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeText(project.name)} planning report</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{font:15px/1.5 system-ui,sans-serif;color:#20251e;max-width:980px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.15}h2{margin-top:32px}svg{width:100%;max-height:560px;border:1px solid #ccd2c6;background:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dfe3da;padding:8px}.assumptions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 24px}.assumptions div{border-bottom:1px solid #dfe3da;padding:6px 0}.assumptions dt,.rank{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#596253}.assumptions dd{margin:2px 0}.finding{border-left:5px solid #d59d3d;padding:2px 16px;margin:16px 0;background:#faf8f1}.finding.high{border-color:#b24c3f}.finding.positive{border-color:#668f40}.disclaimer{margin-top:32px;padding:14px;background:#f3f5ef}@media(max-width:640px){.assumptions{grid-template-columns:1fr}}@media print{body{margin:0;max-width:none}.finding,table,svg{break-inside:avoid}}</style></head><body><header><p>CalmKitchen Designer · planning report</p><h1>${escapeText(project.name)}</h1><p>${escapeText(variant.name)} · generated ${escapeText(generatedAt)}</p></header><section><h2>Plan</h2>${planSvg(variant)}</section>${scenarioSection(scenario, variant)}${simulationSection(simulation, variant)}${comparisonSection(input.comparison)}<section><h2>Ranked findings</h2>${findingMarkup}</section><section><h2>Equipment schedule</h2><table><thead><tr><th>Item</th><th>Category</th><th>Size (mm)</th><th>Position (mm)</th></tr></thead><tbody>${equipmentRows}</tbody></table></section><p class="disclaimer"><strong>Professional review required.</strong> This comparative planning report does not certify architectural, fire, ventilation, food-safety, accessibility, structural, utility, or occupational-safety compliance.</p></body></html>`
}

export function buildResultsReportHtml(input: {
  project: KitchenProject
  reports: readonly {
    variant: LayoutVariant
    scenario?: SimulationScenario
    simulation?: SimulationResultSummary | null
  }[]
  generatedAt?: string
}): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const layouts = input.reports.map(({ variant, scenario, simulation }) => {
    const report = buildReportHtml({
      project: input.project,
      variant,
      scenario,
      simulation,
      generatedAt,
    })
    const body = report.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? report
    const withoutHeaderAndDisclaimer = body
      .replace(/^<header>[\s\S]*?<\/header>/, '')
      .replace(/<p class="disclaimer">[\s\S]*?<\/p>$/, '')
    return `<article class="layout-report" data-variant-id="${escapeText(variant.id)}"><header><p>Layout result</p><h2>${escapeText(variant.name)}</h2><p>Layout ID: ${escapeText(variant.id)}</p></header>${withoutHeaderAndDisclaimer}</article>`
  }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeText(input.project.name)} shared planning results</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{font:15px/1.5 system-ui,sans-serif;color:#20251e;max-width:980px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.15}h2{margin-top:32px}svg{width:100%;max-height:560px;border:1px solid #ccd2c6;background:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dfe3da;padding:8px}.assumptions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 24px}.assumptions div{border-bottom:1px solid #dfe3da;padding:6px 0}.assumptions dt,.rank{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#596253}.assumptions dd{margin:2px 0}.finding{border-left:5px solid #d59d3d;padding:2px 16px;margin:16px 0;background:#faf8f1}.finding.high{border-color:#b24c3f}.finding.positive{border-color:#668f40}.layout-report{border-top:3px solid #34412d;margin-top:40px;padding-top:8px}.disclaimer{margin-top:32px;padding:14px;background:#f3f5ef}@media(max-width:640px){.assumptions{grid-template-columns:1fr}}@media print{body{margin:0;max-width:none}.layout-report{break-before:page}.layout-report:first-of-type{break-before:auto}.finding,table,svg{break-inside:avoid}}</style></head><body><header><p>CalmKitchen Designer · shared planning results</p><h1>${escapeText(input.project.name)}</h1><p>${escapeText(`${input.reports.length} layout${input.reports.length === 1 ? '' : 's'} · generated ${generatedAt}`)}</p></header>${layouts}<p class="disclaimer"><strong>Professional review required.</strong> This comparative planning report does not certify architectural, fire, ventilation, food-safety, accessibility, structural, utility, or occupational-safety compliance.</p></body></html>`
}

export function resultsReportArtifact(input: {
  project: KitchenProject
  revision: number
  reports: readonly {
    variant: LayoutVariant
    scenario?: SimulationScenario
    simulation?: SimulationResultSummary | null
  }[]
}): { filename: string; mimeType: string; contents: string } {
  return {
    filename: `${projectSlug(input.project)}-results-rev-${input.revision}.html`,
    mimeType: 'text/html;charset=utf-8',
    contents: buildResultsReportHtml(input),
  }
}

export function projectArtifact(input: {
  project: KitchenProject
  variant: LayoutVariant
  revision: number
  format: 'project-json' | 'equipment-schedule-csv' | 'report-html' | 'plan-svg'
  scenario?: SimulationScenario
  simulation?: SimulationResultSummary | null
}): { filename: string; mimeType: string; contents: string } {
  const slug = projectSlug(input.project)
  if (input.format === 'equipment-schedule-csv') return {
    filename: `${slug}-${projectSlug({ ...input.project, name: input.variant.name })}-equipment.csv`,
    mimeType: 'text/csv;charset=utf-8', contents: equipmentScheduleCsv(input.variant),
  }
  if (input.format === 'report-html') return {
    filename: `${slug}-report.html`, mimeType: 'text/html;charset=utf-8',
    contents: buildReportHtml({ project: input.project, variant: input.variant, scenario: input.scenario, simulation: input.simulation }),
  }
  if (input.format === 'plan-svg') return {
    filename: `${slug}-${projectSlug({ ...input.project, name: input.variant.name })}-plan.svg`,
    mimeType: 'image/svg+xml;charset=utf-8', contents: planSvg(input.variant),
  }
  return { filename: `${slug}-rev-${input.revision}.json`, mimeType: 'application/json;charset=utf-8', contents: exportProject(input.project) }
}

export function downloadArtifact(artifact: { filename: string; mimeType: string; contents: string }): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  const url = URL.createObjectURL(new Blob([artifact.contents], { type: artifact.mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = artifact.filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}
