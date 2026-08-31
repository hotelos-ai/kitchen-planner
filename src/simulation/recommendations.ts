import type { EquipmentItem } from '../domain/project'
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

type Context = { baseline: SimulationResult; candidate: SimulationResult; candidateEquipment?: readonly EquipmentItem[] }

const METRICS: { key: keyof SimulationMetrics; label: string; lowerIsBetter: boolean }[] = [
  { key: 'totalTravelMm', label: 'Total travel', lowerIsBetter: true },
  { key: 'orderCompletionP90Seconds', label: 'Order completion P90', lowerIsBetter: true },
  { key: 'hotLineCongestionEvents', label: 'Hot-line congestion', lowerIsBetter: true },
  { key: 'dirtyCleanCrossings', label: 'Dirty-clean crossings', lowerIsBetter: true },
  { key: 'doorConflictEvents', label: 'D2 door conflicts', lowerIsBetter: true },
  { key: 'unreachableTasks', label: 'Unreachable tasks', lowerIsBetter: true },
  { key: 'completedOrders', label: 'Completed orders', lowerIsBetter: false },
]

export function compareResults(baseline: SimulationResult, candidate: SimulationResult): MetricDelta[] {
  return METRICS.map(({ key, label, lowerIsBetter }) => {
    const baselineValue = Number(baseline.metrics[key])
    const candidateValue = Number(candidate.metrics[key])
    return { key, label, lowerIsBetter, baseline: baselineValue, candidate: candidateValue, delta: candidateValue - baselineValue }
  })
}

const direction = (value: number, lowerIsBetter = true) => ({ direction: value === 0 ? 'unchanged' : (lowerIsBetter ? value < 0 : value > 0) ? 'improved' : 'worsened', value }) as LayoutFinding['delta']

export function buildFindings({ baseline, candidate, candidateEquipment }: Context): LayoutFinding[] {
  const findings: LayoutFinding[] = []
  const hotDelta = candidate.metrics.hotLineCongestionEvents - baseline.metrics.hotLineCongestionEvents
  if (baseline.metrics.hotLineCongestionEvents >= 5 && hotDelta < 0) findings.push({
    ruleId: 'hot-line-pinch-point', severity: 'high', title: 'Candidate relieves the hot-line pinch point',
    explanation: 'The candidate performs better under this scenario because fewer staff enter overlapping cooking work zones.',
    evidence: [`Hot-line congestion events: ${baseline.metrics.hotLineCongestionEvents} → ${candidate.metrics.hotLineCongestionEvents}`],
    affectedItemIds: ['flat-top-fryer', 'six-burner', 'tandoor'], delta: direction(hotDelta),
  })
  else if (candidate.metrics.hotLineCongestionEvents >= 20) findings.push({
    ruleId: 'hot-line-pressure-current', severity: 'high', title: 'Hot-line working space remains under pressure',
    explanation: 'Concurrent range, fryer, and tandoor work repeatedly places cooks within the same narrow work zone.',
    evidence: [`${candidate.metrics.hotLineCongestionEvents} hot-line congestion events in this run`],
    affectedItemIds: ['flat-top-fryer', 'six-burner', 'tandoor'],
  })
  if (candidate.metrics.unreachableTasks > 0) findings.push({
    ruleId: 'station-access-failure', severity: 'high', title: 'Restore an unobstructed station approach',
    explanation: 'At least one required task cannot reach its assigned station on the 100 mm circulation grid. Verify the upright freezer approach first, then rerun.',
    evidence: [`${candidate.metrics.unreachableTasks} unreachable task legs`, ...candidate.warnings.slice(0, 2)],
    affectedItemIds: ['upright-freezer', 'fridge-clean-prep', 'tandoor'],
    delta: direction(candidate.metrics.unreachableTasks - baseline.metrics.unreachableTasks),
  })
  const crossingDelta = candidate.metrics.dirtyCleanCrossings - baseline.metrics.dirtyCleanCrossings
  if (candidate.metrics.dirtyCleanCrossings > 0) findings.push({
    ruleId: 'dirty-clean-crossing', severity: 'medium', title: crossingDelta < 0 ? 'Candidate reduces dirty/clean crossings' : 'Separate dirty return from clean plating',
    explanation: crossingDelta < 0 ? 'The candidate performs better under this scenario, though crossings remain.' : 'The service-window and wash-up routes still place dirty returns across clean production traffic.',
    evidence: [`Dirty-clean crossings: ${baseline.metrics.dirtyCleanCrossings} → ${candidate.metrics.dirtyCleanCrossings}`],
    affectedItemIds: ['dirty-landing', 'pre-rinse-sink', 'fridge-clean-prep'], delta: direction(crossingDelta),
  })
  if (candidate.metrics.doorConflictEvents > 0) findings.push({
    ruleId: 'd2-door-conflicts', severity: 'medium', title: 'Keep the D2 entry buffer clear',
    explanation: 'Staff entry and receiving share D2; floor storage or a landing zone inside its swing/approach would amplify conflicts.',
    evidence: [`${candidate.metrics.doorConflictEvents} door-zone conflicts`], affectedItemIds: ['handwash', 'two-door-fridge'],
  })
  if (candidate.metrics.finishToPassTravelMm > 30000) findings.push({
    ruleId: 'finish-to-pass-distance', severity: 'medium', title: 'Shorten the finish-to-clean-window handoff',
    explanation: 'Repeated plating-to-pass travel adds motion through the central circulation lane.',
    evidence: [`${Math.round(candidate.metrics.finishToPassTravelMm / 1000)} m cumulative finish-to-pass travel`], affectedItemIds: ['fridge-clean-prep'],
  })
  if (candidate.metrics.dirtyToWashTravelMm <= 50000 && candidate.metrics.unreachableTasks === 0) findings.push({
    ruleId: 'wash-route-performing-well', severity: 'positive', title: 'Preserve the wash-up sequence',
    explanation: 'Dirty landing, pre-rinse, dishwasher, and clean landing form a compact progression under this scenario.',
    evidence: [`${Math.round(candidate.metrics.dirtyToWashTravelMm / 1000)} m cumulative dirty-to-wash travel`],
    affectedItemIds: ['dirty-landing', 'pre-rinse-sink', 'dishwasher', 'clean-landing'],
  })
  if (candidateEquipment) {
    const tandoor = candidateEquipment.find((item) => item.id === 'tandoor')
    if (tandoor?.xMm === 2400 && tandoor.yMm === 900) findings.push({
      ruleId: 'confirmed-tandoor-anchor', severity: 'positive', title: 'Confirmed tandoor anchor is preserved',
      explanation: 'The tandoor remains against the shaded pillar as confirmed from the source trace.',
      evidence: ['Tandoor origin remains at 2400 × 900 mm'], affectedItemIds: ['tandoor'],
    })
  }
  return findings.sort((left, right) => ({ high: 0, medium: 1, positive: 2 }[left.severity] - ({ high: 0, medium: 1, positive: 2 }[right.severity])))
}
