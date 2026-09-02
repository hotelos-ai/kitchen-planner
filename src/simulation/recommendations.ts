import type { Architecture, EquipmentItem, Opening, PointMm, StationCapability } from '../domain/project'
import type { SimulationMetrics, SimulationResult } from './types'

export type MetricDelta = { key: keyof SimulationMetrics; label: string; baseline: number; candidate: number; delta: number; lowerIsBetter: boolean }
export type LayoutFinding = {
  ruleId: string
  severity: 'high' | 'medium' | 'positive'
  title: string
  explanation: string
  evidence: string[]
  affectedItemIds: string[]
  delta?: { direction: 'improved' | 'worsened' | 'unchanged'; value: number }
}

type Context = {
  baseline: SimulationResult
  candidate: SimulationResult
  candidateEquipment?: readonly EquipmentItem[]
  candidateArchitecture?: Architecture
}

const METRICS: { key: keyof SimulationMetrics; label: string; lowerIsBetter: boolean }[] = [
  { key: 'totalTravelMm', label: 'Total travel', lowerIsBetter: true },
  { key: 'orderCompletionP90Seconds', label: 'Order completion P90', lowerIsBetter: true },
  { key: 'hotLineCongestionEvents', label: 'Hot-line congestion', lowerIsBetter: true },
  { key: 'dirtyCleanCrossings', label: 'Dirty-clean crossings', lowerIsBetter: true },
  { key: 'doorConflictEvents', label: 'Entry door conflicts', lowerIsBetter: true },
  { key: 'unreachableTasks', label: 'Unreachable tasks', lowerIsBetter: true },
  { key: 'completedOrders', label: 'Completed orders', lowerIsBetter: false },
]

const DIRTY_FLOW_CAPABILITIES = new Set<StationCapability>(['dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash'])
const CLEAN_FLOW_CAPABILITIES = new Set<StationCapability>(['food-prep', 'finish-plate', 'clean-window', 'clean-landing'])
const WASH_SEQUENCE_CAPABILITIES = new Set<StationCapability>(['dirty-landing', 'dish-pre-rinse', 'dish-wash', 'clean-landing'])
const FINISH_CAPABILITIES = new Set<StationCapability>(['finish-plate'])

export function compareResults(baseline: SimulationResult, candidate: SimulationResult): MetricDelta[] {
  return METRICS.map(({ key, label, lowerIsBetter }) => {
    const baselineValue = Number(baseline.metrics[key])
    const candidateValue = Number(candidate.metrics[key])
    return { key, label, lowerIsBetter, baseline: baselineValue, candidate: candidateValue, delta: candidateValue - baselineValue }
  })
}

const direction = (value: number, lowerIsBetter = true) => ({ direction: value === 0 ? 'unchanged' : (lowerIsBetter ? value < 0 : value > 0) ? 'improved' : 'worsened', value }) as LayoutFinding['delta']

const itemsWithCapabilities = (equipment: readonly EquipmentItem[] | undefined, capabilities: ReadonlySet<StationCapability>) =>
  equipment?.filter((item) => item.capabilities.some((capability) => capabilities.has(capability))) ?? []

const itemCenter = (item: EquipmentItem): PointMm => ({ x: item.xMm + item.widthMm / 2, y: item.yMm + item.depthMm / 2 })

const openingEdgePoint = (architecture: Architecture, opening: Opening): PointMm => {
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.segmentIndex !== undefined) {
    const start = architecture.roomPolygon[opening.segmentIndex]
    const end = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
    if (start && end) {
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      if (length > 0) return {
        x: start.x + (end.x - start.x) * middle / length,
        y: start.y + (end.y - start.y) * middle / length,
      }
    }
  }
  if (opening.wall === 'top') return { x: middle, y: 0 }
  if (opening.wall === 'bottom') return { x: middle, y: architecture.depthMm }
  if (opening.wall === 'left') return { x: 0, y: middle }
  return { x: architecture.widthMm, y: middle }
}

const entryContext = (architecture: Architecture | undefined, equipment: readonly EquipmentItem[] | undefined) => {
  const opening = architecture?.openings.find((candidate) => candidate.kind === 'door' && candidate.flow === 'entry')
  if (!architecture || !opening) return { opening: undefined, affectedItemIds: [] as string[] }
  const edge = openingEdgePoint(architecture, opening)
  const bufferMm = Math.max(1200, (opening.swingDepthMm ?? 0) + opening.widthMm)
  const affectedItemIds = equipment
    ?.filter((item) => {
      const center = itemCenter(item)
      return item.category !== 'hood' && Math.hypot(center.x - edge.x, center.y - edge.y) <= bufferMm
    })
    .map((item) => item.id) ?? []
  return { opening, affectedItemIds }
}

const warningMatchedItems = (equipment: readonly EquipmentItem[] | undefined, warnings: readonly string[]) => equipment
  ?.filter((item) => warnings.some((warning) => warning.toLowerCase().includes(item.label.toLowerCase())))
  .map((item) => item.id) ?? []

export function buildFindings({ baseline, candidate, candidateEquipment, candidateArchitecture }: Context): LayoutFinding[] {
  const findings: LayoutFinding[] = []
  const hotLineIds = candidateEquipment
    ?.filter((item) => item.category === 'cooking')
    .map((item) => item.id) ?? []
  const hotDelta = candidate.metrics.hotLineCongestionEvents - baseline.metrics.hotLineCongestionEvents
  if (baseline.metrics.hotLineCongestionEvents >= 5 && hotDelta < 0) findings.push({
    ruleId: 'hot-line-pinch-point', severity: 'high', title: 'Candidate relieves the hot-line pinch point',
    explanation: 'The candidate performs better under this scenario because fewer staff enter overlapping cooking work zones.',
    evidence: [`Hot-line congestion events: ${baseline.metrics.hotLineCongestionEvents} → ${candidate.metrics.hotLineCongestionEvents}`],
    affectedItemIds: hotLineIds, delta: direction(hotDelta),
  })
  else if (candidate.metrics.hotLineCongestionEvents >= 20) findings.push({
    ruleId: 'hot-line-pressure-current', severity: 'high', title: 'Hot-line working space remains under pressure',
    explanation: 'Concurrent cooking work repeatedly places staff within the same narrow work zone.',
    evidence: [`${candidate.metrics.hotLineCongestionEvents} hot-line congestion events in this run`],
    affectedItemIds: hotLineIds,
  })
  if (candidate.metrics.unreachableTasks > 0) findings.push({
    ruleId: 'station-access-failure', severity: 'high', title: 'Restore an unobstructed station approach',
    explanation: 'At least one required task cannot reach its assigned station on the circulation grid. Clear the named station approach, then rerun.',
    evidence: [`${candidate.metrics.unreachableTasks} unreachable task legs`, ...candidate.warnings.slice(0, 2)],
    affectedItemIds: warningMatchedItems(candidateEquipment, candidate.warnings),
    delta: direction(candidate.metrics.unreachableTasks - baseline.metrics.unreachableTasks),
  })
  const crossingDelta = candidate.metrics.dirtyCleanCrossings - baseline.metrics.dirtyCleanCrossings
  if (candidate.metrics.dirtyCleanCrossings > 0) findings.push({
    ruleId: 'dirty-clean-crossing', severity: 'medium', title: crossingDelta < 0 ? 'Candidate reduces dirty/clean crossings' : 'Separate dirty return from clean plating',
    explanation: crossingDelta < 0 ? 'The candidate performs better under this scenario, though crossings remain.' : 'Modeled dirty-return and wash-up routes still cross clean production traffic.',
    evidence: [`Dirty-clean crossings: ${baseline.metrics.dirtyCleanCrossings} → ${candidate.metrics.dirtyCleanCrossings}`],
    affectedItemIds: [...new Set([
      ...itemsWithCapabilities(candidateEquipment, DIRTY_FLOW_CAPABILITIES),
      ...itemsWithCapabilities(candidateEquipment, CLEAN_FLOW_CAPABILITIES),
    ].map((item) => item.id))], delta: direction(crossingDelta),
  })
  const entry = entryContext(candidateArchitecture, candidateEquipment)
  if (candidate.metrics.doorConflictEvents > 0) findings.push({
    ruleId: 'entry-door-conflicts', severity: 'medium', title: `Keep the ${entry.opening?.label ?? 'staff entry'} buffer clear`,
    explanation: 'Concurrent traffic at the modeled staff entry creates conflicts; keep equipment and landing zones outside its swing and approach.',
    evidence: [`${candidate.metrics.doorConflictEvents} door-zone conflicts`], affectedItemIds: entry.affectedItemIds,
  })
  if (candidate.metrics.finishToPassTravelMm > 30000) findings.push({
    ruleId: 'finish-to-pass-distance', severity: 'medium', title: 'Shorten the finish-to-clean-window handoff',
    explanation: 'Repeated plating-to-pass travel adds motion through the central circulation lane.',
    evidence: [`${Math.round(candidate.metrics.finishToPassTravelMm / 1000)} m cumulative finish-to-pass travel`],
    affectedItemIds: itemsWithCapabilities(candidateEquipment, FINISH_CAPABILITIES).map((item) => item.id),
  })
  if (candidate.metrics.dirtyToWashTravelMm <= 50000 && candidate.metrics.unreachableTasks === 0) findings.push({
    ruleId: 'wash-route-performing-well', severity: 'positive', title: 'Preserve the wash-up sequence',
    explanation: 'Dirty landing, pre-rinse, dishwasher, and clean landing form a compact progression under this scenario.',
    evidence: [`${Math.round(candidate.metrics.dirtyToWashTravelMm / 1000)} m cumulative dirty-to-wash travel`],
    affectedItemIds: itemsWithCapabilities(candidateEquipment, WASH_SEQUENCE_CAPABILITIES).map((item) => item.id),
  })
  const severityRank = { high: 0, medium: 1, positive: 2 }
  return findings.sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
}
