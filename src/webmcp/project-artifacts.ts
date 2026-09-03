import type { KitchenProject, LayoutVariant } from '../domain/project'
import type { SimulationResultSummary } from '../simulation/types'
import { exportProject } from '../state/persistence'

const escapeText = (value: unknown): string => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const csvCell = (value: unknown): string => {
  const raw = String(value ?? '')
  // Prevent labels imported from untrusted project files from becoming
  // spreadsheet formulas when the schedule is opened in Excel/Sheets.
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

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
  const polygon = architecture.roomPolygon.map((point) => `${point.x},${point.y}`).join(' ')
  const equipment = variant.equipment.map((item) => {
    const centreX = item.xMm + item.widthMm / 2
    const centreY = item.yMm + item.depthMm / 2
    return `<g transform="rotate(${item.rotationDeg} ${centreX} ${centreY})"><rect x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.depthMm}" rx="40"/><text x="${centreX}" y="${centreY}" text-anchor="middle" dominant-baseline="middle">${escapeText(item.label)}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeText(variant.name)} kitchen plan" viewBox="0 0 ${architecture.widthMm} ${architecture.depthMm}"><style>polygon{fill:#f7f4ea;stroke:#22281f;stroke-width:35}rect{fill:#b1d15b;stroke:#34412d;stroke-width:18}text{font:120px system-ui,sans-serif;fill:#1f241d}</style><polygon points="${polygon}"/>${equipment}</svg>`
}

export function buildReportHtml(input: {
  project: KitchenProject
  variant: LayoutVariant
  simulation?: SimulationResultSummary | null
}): string {
  const { project, variant, simulation } = input
  const scenario = project.scenarios.find((candidate) => candidate.id === project.activeScenarioId) ?? project.scenarios[0]
  const metricRows = simulation ? [
    ['Completed orders', simulation.metrics.completedOrders],
    ['Total orders', simulation.metrics.totalOrders],
    ['P50 ticket time (seconds)', Math.round(simulation.metrics.orderCompletionP50Seconds)],
    ['P90 ticket time (seconds)', Math.round(simulation.metrics.orderCompletionP90Seconds)],
    ['Throughput / hour', Math.round(simulation.metrics.throughputPerHour * 10) / 10],
    ['Total staff travel (m)', Math.round(simulation.metrics.totalTravelMm / 100) / 10],
    ['Peak backlog', simulation.metrics.peakOrderBacklog],
  ] : []
  const metrics = metricRows.length
    ? `<section><h2>Simulation metrics</h2><table><tbody>${metricRows.map(([label, value]) => `<tr><th>${escapeText(label)}</th><td>${escapeText(value)}</td></tr>`).join('')}</tbody></table>${simulation!.warnings.length ? `<h3>Model warnings</h3><ul>${simulation!.warnings.map((warning) => `<li>${escapeText(warning)}</li>`).join('')}</ul>` : ''}</section>`
    : '<section><h2>Simulation metrics</h2><p>No simulation result was included. Run the active scenario before exporting to include measured model output.</p></section>'
  const equipmentRows = variant.equipment.map((item) => `<tr><td>${escapeText(item.label)}</td><td>${escapeText(item.category)}</td><td>${item.widthMm} × ${item.depthMm}</td><td>${item.xMm}, ${item.yMm}</td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeText(project.name)} planning report</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#20251e;max-width:980px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.15}svg{width:100%;max-height:560px;border:1px solid #ccd2c6;background:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dfe3da;padding:8px}.disclaimer{margin-top:32px;padding:14px;background:#f3f5ef}@media print{body{margin:0}.no-print{display:none}}</style></head><body><header><p>CalmKitchen Designer · planning report</p><h1>${escapeText(project.name)}</h1><p>${escapeText(variant.name)} · generated ${escapeText(new Date().toISOString())}</p></header><section><h2>Plan</h2>${planSvg(variant)}</section><section><h2>Scenario assumptions</h2>${scenario ? `<p>${scenario.covers} covers over ${scenario.durationMinutes} minutes · ${scenario.staff.reduce((sum, entry) => sum + entry.count, 0)} staff · seed ${scenario.seed}</p>` : '<p>No scenario configured.</p>'}</section>${metrics}<section><h2>Equipment schedule</h2><table><thead><tr><th>Item</th><th>Category</th><th>Size (mm)</th><th>Position (mm)</th></tr></thead><tbody>${equipmentRows}</tbody></table></section><p class="disclaimer"><strong>Professional review required.</strong> This comparative planning report does not certify architectural, fire, ventilation, food-safety, accessibility, structural, utility, or occupational-safety compliance.</p></body></html>`
}

export function projectArtifact(input: {
  project: KitchenProject
  variant: LayoutVariant
  revision: number
  format: 'project-json' | 'equipment-schedule-csv' | 'report-html' | 'plan-svg'
  simulation?: SimulationResultSummary | null
}): { filename: string; mimeType: string; contents: string } {
  const slug = projectSlug(input.project)
  if (input.format === 'equipment-schedule-csv') return {
    filename: `${slug}-${projectSlug({ ...input.project, name: input.variant.name })}-equipment.csv`,
    mimeType: 'text/csv;charset=utf-8',
    contents: equipmentScheduleCsv(input.variant),
  }
  if (input.format === 'report-html') return {
    filename: `${slug}-report.html`,
    mimeType: 'text/html;charset=utf-8',
    contents: buildReportHtml({ project: input.project, variant: input.variant, simulation: input.simulation }),
  }
  if (input.format === 'plan-svg') return {
    filename: `${slug}-${projectSlug({ ...input.project, name: input.variant.name })}-plan.svg`,
    mimeType: 'image/svg+xml;charset=utf-8',
    contents: planSvg(input.variant),
  }
  return {
    filename: `${slug}-rev-${input.revision}.json`,
    mimeType: 'application/json;charset=utf-8',
    contents: exportProject(input.project),
  }
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
