import { pointInPolygon, polygonsOverlap, rotatedFootprint } from '../geometry'
import { isFloorObstacle } from '../catalog/floor-obstacle'
import { analyzeLayout } from '../layout-diagnostics'
import type {
  Architecture,
  EquipmentItem,
  LayoutConstraints,
  PointMm,
  SimulationScenario,
  StaffRole,
  StationCapability,
} from '../project'
import { buildNavGrid, findRoute, stationApproachPoints } from '../../simulation/nav-grid'

export type OperationalRequirementSeverity = 'blocker' | 'warning' | 'professional-review'

export type OperationalRequirementSource =
  | 'modeled-task-chain'
  | 'modeled-flow'
  | 'scenario-staffing'
  | 'scenario-capacity'
  | 'modeled-circulation'
  | 'modeled-clearance'
  | 'user-constraint'
  | 'professional-judgment'

export type OperationalRequirementScope = 'architecture' | 'equipment' | 'scenario' | 'staff' | 'layout' | 'professional'

export interface OperationalRequirementInput {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  scenario: SimulationScenario
  layoutConstraints?: LayoutConstraints
}

export interface OperationalRequirementResult {
  code: string
  severity: OperationalRequirementSeverity
  reason: string
  /** Compatibility alias for simulation consumers that display validation messages. */
  message: string
  source: OperationalRequirementSource
  scope: OperationalRequirementScope
  itemIds: string[]
  recommendedCatalogIds: string[]
  capability?: StationCapability | 'cooking'
  requiredCount?: number
  actualCount?: number
  requiredCapacity?: number
  actualCapacity?: number
}

type RequirementEvidence = Omit<OperationalRequirementResult, 'code' | 'severity' | 'source' | 'scope' | 'reason' | 'message' | 'recommendedCatalogIds'> & {
  reason?: string
  recommendedCatalogIds?: string[]
}

export interface OperationalRequirementDefinition {
  readonly code: string
  readonly severity: OperationalRequirementSeverity
  readonly reason: string
  readonly source: OperationalRequirementSource
  readonly scope: OperationalRequirementScope
  readonly recommendedCatalogIds: readonly string[]
  readonly evaluate: (input: OperationalRequirementInput) => readonly RequirementEvidence[]
}

const cookingCapabilities: readonly StationCapability[] = ['flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook']

const stationRequirements: readonly {
  code: string
  capability: StationCapability | 'cooking'
  reason: string
  recommendedCatalogIds: readonly string[]
}[] = [
  { code: 'station-cooking', capability: 'cooking', reason: 'At least one cooking station is required for the modeled production task chain.', recommendedCatalogIds: ['hot-six-burner-range', 'hot-griddle'] },
  { code: 'station-cold-retrieval', capability: 'cold-retrieval', reason: 'At least one cold-retrieval station is required for the modeled production task chain.', recommendedCatalogIds: ['cold-upright-refrigerator'] },
  { code: 'station-food-prep', capability: 'food-prep', reason: 'At least one food-prep station is required for the modeled production task chain.', recommendedCatalogIds: ['prep-work-table'] },
  { code: 'station-finish-plate', capability: 'finish-plate', reason: 'At least one finishing and plating station is required before clean service.', recommendedCatalogIds: ['service-hot-pass'] },
  { code: 'station-dirty-landing', capability: 'dirty-landing', reason: 'A dirty landing station is required to receive and sort returned ware.', recommendedCatalogIds: ['wash-dirty-landing'] },
  { code: 'station-dish-pre-rinse', capability: 'dish-pre-rinse', reason: 'A pre-rinse station is required in the modeled dirty-to-clean warewashing chain.', recommendedCatalogIds: ['wash-pre-rinse-sink'] },
  { code: 'station-dish-wash', capability: 'dish-wash', reason: 'A dishwashing station is required in the modeled dirty-to-clean warewashing chain.', recommendedCatalogIds: ['wash-hood-dishwasher'] },
  { code: 'station-clean-landing', capability: 'clean-landing', reason: 'A clean landing station is required after dishwashing.', recommendedCatalogIds: ['wash-clean-landing'] },
  { code: 'station-hand-wash', capability: 'hand-wash', reason: 'A dedicated handwashing station is required by the operational hygiene model.', recommendedCatalogIds: ['sanitation-hand-sink'] },
]

const equipmentForCapability = (input: OperationalRequirementInput, capability: StationCapability | 'cooking') =>
  input.equipment.filter((item) => capability === 'cooking'
    ? item.capabilities.some((value) => cookingCapabilities.includes(value))
    : item.capabilities.includes(capability))

const stationCapacity = (input: OperationalRequirementInput, stations: readonly EquipmentItem[]) => stations.reduce(
  (sum, station) => sum + (input.scenario.stationCapacities?.[station.id] ?? 1),
  0,
)

const stationDefinitions: OperationalRequirementDefinition[] = stationRequirements.map((requirement) => ({
  ...requirement,
  severity: 'blocker',
  source: 'modeled-task-chain',
  scope: 'equipment',
  evaluate: (input) => {
    const stations = equipmentForCapability(input, requirement.capability)
    return stations.length ? [] : [{
      reason: requirement.reason,
      itemIds: [],
      capability: requirement.capability,
      requiredCount: 1,
      actualCount: 0,
      requiredCapacity: 1,
      actualCapacity: stationCapacity(input, stations),
    }]
  },
}))

const openingDefinition = (
  code: string,
  flow: NonNullable<Architecture['openings'][number]['flow']>,
  kind: Architecture['openings'][number]['kind'],
  reason: string,
): OperationalRequirementDefinition => ({
  code,
  severity: 'blocker',
  reason,
  source: 'modeled-flow',
  scope: 'architecture',
  recommendedCatalogIds: [],
  evaluate: (input) => {
    const matches = input.architecture.openings.filter((opening) => opening.flow === flow && opening.kind === kind)
    return matches.length ? [] : [{ itemIds: [], requiredCount: 1, actualCount: 0 }]
  },
})

const staffCount = (input: OperationalRequirementInput, roles: readonly StaffRole[]) => input.scenario.staff
  .filter((assignment) => roles.includes(assignment.role) && Number.isFinite(assignment.count) && assignment.count > 0)
  .reduce((sum, assignment) => sum + Math.floor(assignment.count), 0)

const staffDefinition = (code: string, roles: readonly StaffRole[], reason: string): OperationalRequirementDefinition => ({
  code,
  severity: 'blocker',
  reason,
  source: 'scenario-staffing',
  scope: 'staff',
  recommendedCatalogIds: [],
  evaluate: (input) => {
    const actualCount = staffCount(input, roles)
    return actualCount >= 1 ? [] : [{ itemIds: [], requiredCount: 1, actualCount }]
  },
})

const openingPoint = (architecture: Architecture, opening: Architecture['openings'][number]): PointMm => {
  if (opening.segmentIndex !== undefined) {
    const start = architecture.roomPolygon[opening.segmentIndex]
    const end = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
    if (start && end) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
      const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
      const edge = { x: start.x + unit.x * (opening.offsetMm + opening.widthMm / 2), y: start.y + unit.y * (opening.offsetMm + opening.widthMm / 2) }
      const normals = [{ x: -unit.y, y: unit.x }, { x: unit.y, y: -unit.x }]
      const inside = normals.map((normal) => ({ x: edge.x + normal.x * 150, y: edge.y + normal.y * 150 }))
        .find((point) => pointInPolygon(point, architecture.roomPolygon))
      if (inside) return inside
    }
  }
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.wall === 'left') return { x: 150, y: middle }
  if (opening.wall === 'right') return { x: architecture.widthMm - 150, y: middle }
  if (opening.wall === 'top') return { x: middle, y: 150 }
  return { x: middle, y: architecture.depthMm - 150 }
}

const rectPolygon = (rect: { xMm: number; yMm: number; widthMm: number; depthMm: number }): PointMm[] => [
  { x: rect.xMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm },
  { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const routeDefinition: OperationalRequirementDefinition = {
  code: 'route-station-unreachable',
  severity: 'blocker',
  reason: 'Every required work station and service flow must be reachable from the staff entry.',
  source: 'modeled-circulation',
  scope: 'layout',
  recommendedCatalogIds: [],
  evaluate: (input) => {
    const entry = input.architecture.openings.find((opening) => opening.flow === 'entry' && opening.kind === 'door')
    if (!entry || stationRequirements.some((requirement) => equipmentForCapability(input, requirement.capability).length === 0)) return []

    const stations = [...new Map(stationRequirements.flatMap((requirement) => equipmentForCapability(input, requirement.capability)).map((item) => [item.id, item])).values()]
    const openings = input.architecture.openings.filter((opening) => opening.kind === 'service-window' && (opening.flow === 'clean-out' || opening.flow === 'dirty-in'))
    try {
      const grid = buildNavGrid(input, 100)
      const start = openingPoint(input.architecture, entry)
      const evidence: RequirementEvidence[] = []
      stations.forEach((station) => {
        try {
          const goals = stationApproachPoints(station)
          if (!goals.some((goal) => { try { findRoute(grid, start, goal); return true } catch { return false } })) throw new Error('unreachable')
        }
        catch { evidence.push({ reason: `${station.label} cannot be reached from the staff entry on the modeled circulation grid.`, itemIds: [station.id] }) }
      })
      openings.forEach((opening) => {
        try { findRoute(grid, start, openingPoint(input.architecture, opening)) }
        catch { evidence.push({ reason: `${opening.label} cannot be reached from the staff entry on the modeled circulation grid.`, itemIds: [opening.id] }) }
      })
      return evidence
    } catch {
      return [{ reason: 'The modeled circulation grid has no usable route from the staff entry.', itemIds: [] }]
    }
  },
}

const professionalDefinition = (code: string, reason: string, recommendedCatalogIds: readonly string[] = []): OperationalRequirementDefinition => ({
  code,
  severity: 'professional-review',
  reason,
  source: 'professional-judgment',
  scope: 'professional',
  recommendedCatalogIds,
  evaluate: () => [{ itemIds: [] }],
})

export const OPERATIONAL_REQUIREMENTS: readonly OperationalRequirementDefinition[] = Object.freeze([
  ...stationDefinitions,
  openingDefinition('flow-staff-entry', 'entry', 'door', 'A dedicated staff entry is required for the modeled operating flow.'),
  openingDefinition('flow-clean-service', 'clean-out', 'service-window', 'A clean service handoff is required for the modeled operating flow.'),
  openingDefinition('flow-dirty-return', 'dirty-in', 'service-window', 'A separate dirty return is required for the modeled warewashing flow.'),
  staffDefinition('staff-production', ['head-chef', 'sous-chef', 'cdp'], 'At least one production role is required to run the modeled service.'),
  staffDefinition('staff-warewashing', ['busser-washer'], 'At least one warewashing role is required for the modeled dirty-to-clean task chain.'),
  {
    code: 'scenario-staff-count-invalid',
    severity: 'blocker',
    reason: 'Staff counts must be positive whole numbers for each assigned role.',
    source: 'scenario-staffing',
    scope: 'staff',
    recommendedCatalogIds: [],
    evaluate: (input) => input.scenario.staff
      .filter((assignment) => !Number.isInteger(assignment.count) || assignment.count <= 0)
      .map((assignment) => ({ reason: `${assignment.role} has an invalid staff count.`, itemIds: [], requiredCount: 1, actualCount: assignment.count })),
  },
  {
    code: 'station-capacity-invalid',
    severity: 'blocker',
    reason: 'Configured station capacities must be positive whole numbers on existing equipment.',
    source: 'scenario-capacity',
    scope: 'scenario',
    recommendedCatalogIds: [],
    evaluate: (input) => Object.entries(input.scenario.stationCapacities ?? {})
      .filter(([itemId, capacity]) => !input.equipment.some((item) => item.id === itemId) || !Number.isInteger(capacity) || capacity < 1)
      .map(([itemId, capacity]) => ({ itemIds: [itemId], requiredCapacity: 1, actualCapacity: capacity })),
  },
  {
    code: 'scenario-covers-invalid',
    severity: 'blocker',
    reason: 'Scenario covers must be a positive whole number.',
    source: 'scenario-capacity',
    scope: 'scenario',
    recommendedCatalogIds: [],
    evaluate: (input) => Number.isInteger(input.scenario.covers) && input.scenario.covers > 0
      ? []
      : [{ itemIds: [], requiredCapacity: 1, actualCapacity: input.scenario.covers }],
  },
  routeDefinition,
  {
    code: 'clearance-obstructed',
    severity: 'warning',
    reason: 'A modeled equipment work clearance is obstructed.',
    source: 'modeled-clearance',
    scope: 'layout',
    recommendedCatalogIds: [],
    evaluate: (input) => analyzeLayout(input.architecture, input.equipment, { layoutConstraints: input.layoutConstraints })
      .filter((issue) => issue.code === 'clearance-obstructed')
      .map((issue) => ({ reason: issue.message, itemIds: issue.itemIds })),
  },
  {
    code: 'no-go-overlap',
    severity: 'blocker',
    reason: 'Equipment must not overlap an explicit no-go zone.',
    source: 'user-constraint',
    scope: 'layout',
    recommendedCatalogIds: [],
    evaluate: (input) => (input.layoutConstraints?.noGoZones ?? []).flatMap((zone) => input.equipment
      .filter((item) => isFloorObstacle(item) && polygonsOverlap(rotatedFootprint(item), rectPolygon(zone)))
      .map((item) => ({ reason: `${item.label} overlaps the ${zone.id} no-go zone.`, itemIds: [item.id] }))),
  },
  professionalDefinition('professional-fire-review', 'Fire suppression, fuel, and life-safety details require review by a qualified professional.', ['utility-canopy-hood']),
  professionalDefinition('professional-ventilation-review', 'Exhaust, make-up air, and ventilation details require review by a qualified professional.', ['utility-canopy-hood']),
  professionalDefinition('professional-hygiene-review', 'Hygiene, food-safety, and sanitation details require review by a qualified professional.', ['sanitation-hand-sink']),
  professionalDefinition('professional-accessibility-review', 'Accessibility, egress, and workplace accommodation details require review by a qualified professional.'),
  professionalDefinition('professional-gas-review', 'Gas supply, isolation, combustion, and appliance connections require review by a qualified professional.'),
  professionalDefinition('professional-electrical-review', 'Electrical loads, protection, isolation, and connection details require review by a qualified professional.'),
  professionalDefinition('professional-drainage-review', 'Water supply, drainage falls, backflow protection, and floor waste details require review by a qualified professional.'),
  professionalDefinition('professional-grease-review', 'Grease interception and waste handling details require review by a qualified professional.'),
  professionalDefinition('professional-local-authority-review', 'Local planning, building, health, fire, and workplace requirements require qualified professional and authority review.'),
])

export function evaluateOperationalRequirements(input: OperationalRequirementInput): OperationalRequirementResult[] {
  return OPERATIONAL_REQUIREMENTS.flatMap((definition) => definition.evaluate(input).map((evidence) => {
    const reason = evidence.reason ?? definition.reason
    return {
      ...evidence,
      code: definition.code,
      severity: definition.severity,
      reason,
      message: reason,
      source: definition.source,
      scope: definition.scope,
      itemIds: [...evidence.itemIds],
      recommendedCatalogIds: [...(evidence.recommendedCatalogIds ?? definition.recommendedCatalogIds)],
    }
  }))
}
