import { createCatalogEquipmentItem, getCatalogEntry } from '../../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import { polygonsOverlap, rotatedFootprint } from '../../domain/geometry'
import { analyzeLayout, doorSwingEnvelopes } from '../../domain/layout-diagnostics'
import type { Architecture, EquipmentItem, KitchenProject, LayoutVariant, Opening, SimulationScenario, StaffRole, StationCapability } from '../../domain/project'
import { evaluateOperationalRequirements } from '../../domain/requirements/operational-requirements'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { physicalStationCapacity, validateSimulationInput } from '../../simulation/validation'

type AddOperation = {
  type: 'add_component'
  variantId: string
  componentId: string
  catalogId: string
  position: { xMm: number; yMm: number }
  configurationId?: string
  skinId?: string
}

type MoveOperation = {
  type: 'update_component'
  variantId: string
  componentId: string
  patch: { xMm: number; yMm: number }
}

type ScenarioOperation = {
  type: 'update_scenario'
  variantId: string
  scenarioId: string
  patch: Partial<SimulationScenario>
}

type AddOpeningOperation = {
  type: 'add_opening'
  variantId: string
  opening: Opening
}

export type AutomaticPlanFixStatus = 'success' | 'partial' | 'failure'

export type AutomaticPlanFixSummary = {
  blockers: number
  layoutErrors: number
  layoutWarnings: number
}

export type AutomaticPlanFixResult = {
  status: AutomaticPlanFixStatus
  applied: boolean
  message: string
  addedCount: number
  movedCount: number
  architectureAdjusted: boolean
  scenarioAdjusted: boolean
  before: AutomaticPlanFixSummary
  after: AutomaticPlanFixSummary
  remaining: string[]
}

const makeComponentId = (catalogId: string) =>
  `${catalogId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

// Keep the synchronous toolbar action responsive even on a dense plan. Nearest
// positions are tried first, so this still covers a 2 m radius at 100 mm snap.
const MAX_PLACEMENT_ATTEMPTS_PER_ITEM = 500

const rectPolygon = (rect: { xMm: number; yMm: number; widthMm: number; depthMm: number }) => [
  { x: rect.xMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm },
  { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const scenarioFor = (store: ProjectStore) => {
  const project = store.getState().project
  return project.scenarios.find((candidate) => candidate.id === project.activeScenarioId) ?? project.scenarios[0]
}

const summarize = (variant: LayoutVariant, scenario: SimulationScenario | undefined): AutomaticPlanFixSummary => {
  const layout = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  const blockers = scenario ? validateSimulationInput({
    architecture: variant.architecture,
    equipment: variant.equipment,
    layoutConstraints: variant.layoutConstraints,
    scenario,
  }) : []
  return {
    blockers: blockers.length,
    layoutErrors: layout.filter((issue) => issue.severity === 'error').length,
    layoutWarnings: layout.filter((issue) => issue.severity === 'warning').length,
  }
}

const remainingMessages = (variant: LayoutVariant, scenario: SimulationScenario | undefined) => {
  const layout = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  const blockers = scenario ? validateSimulationInput({
    architecture: variant.architecture,
    equipment: variant.equipment,
    layoutConstraints: variant.layoutConstraints,
    scenario,
  }) : []
  return [...new Set([
    ...blockers.map((issue) => issue.message),
    ...layout.map((issue) => issue.title),
  ])]
}

const recommendedCatalogIds = (variant: LayoutVariant, scenario: SimulationScenario | undefined) => {
  if (!scenario) return []
  const requirements = evaluateOperationalRequirements({
    architecture: variant.architecture,
    equipment: variant.equipment,
    scenario,
    layoutConstraints: variant.layoutConstraints,
  })
  return [...new Set(requirements
    .filter((result) => result.severity === 'blocker' && result.scope === 'equipment')
    .map((result) => result.recommendedCatalogIds.find((catalogId) => getCatalogEntry(catalogId)))
    .filter((catalogId): catalogId is string => Boolean(catalogId)))]
}

function planEssentialAdditions(
  variant: LayoutVariant,
  scenario: SimulationScenario | undefined,
  snapMm: number,
): { operations: AddOperation[]; equipment: EquipmentItem[] } {
  const equipment = [...variant.equipment]
  const operations: AddOperation[] = []
  for (const catalogId of recommendedCatalogIds(variant, scenario)) {
    const entry = getCatalogEntry(catalogId)
    if (!entry) continue
    const placement = suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment,
      entry,
      snapMm,
      layoutConstraints: variant.layoutConstraints,
    })
    if (!placement) continue
    const componentId = makeComponentId(catalogId)
    const configurationId = entry.configurationIds[0]
    const skinId = entry.appearanceSkinIds[0]
    const operation: AddOperation = {
      type: 'add_component',
      variantId: variant.id,
      componentId,
      catalogId,
      position: { xMm: placement.xMm, yMm: placement.yMm },
      ...(configurationId ? { configurationId } : {}),
      ...(skinId ? { skinId } : {}),
    }
    operations.push(operation)
    equipment.push(createCatalogEquipmentItem({
      catalogId,
      componentId,
      position: operation.position,
      ...(configurationId ? { configurationId } : {}),
      ...(skinId ? { skinId } : {}),
    }))
  }
  return { operations, equipment }
}

const segmentLength = (architecture: Architecture, segmentIndex: number) => {
  const start = architecture.roomPolygon[segmentIndex]
  const end = architecture.roomPolygon[(segmentIndex + 1) % architecture.roomPolygon.length]
  return start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0
}

const openingOverlaps = (architecture: Architecture, opening: Opening) => architecture.openings.some((existing) => {
  if (existing.segmentIndex !== opening.segmentIndex) return false
  const existingEnd = existing.offsetMm + existing.widthMm
  const candidateEnd = opening.offsetMm + opening.widthMm
  return existing.offsetMm < candidateEnd + 200 && opening.offsetMm < existingEnd + 200
})

const openingKeepClear = (variant: LayoutVariant, opening: Opening) => {
  // A temporary swing envelope gives windows the same 900 mm inward keep-clear
  // area as doors, without persisting a door swing on a service window.
  const clearanceOpening: Opening = { ...opening, kind: 'door', swingDepthMm: 900 }
  const architecture = { ...variant.architecture, openings: [...variant.architecture.openings, clearanceOpening] }
  const envelope = doorSwingEnvelopes(architecture).find(({ opening: candidate }) => candidate.id === opening.id)?.polygon
  if (!envelope) return false
  return variant.equipment.every((item) => !polygonsOverlap(rotatedFootprint(item), envelope))
    && variant.architecture.pillars.every((pillar) => !polygonsOverlap(rectPolygon(pillar), envelope))
    && (variant.layoutConstraints?.noGoZones ?? []).every((zone) => !polygonsOverlap(rectPolygon(zone), envelope))
}

const OPENING_SPECS: readonly Pick<Opening, 'label' | 'kind' | 'flow' | 'widthMm'>[] = [
  { label: 'Staff entry', kind: 'door', flow: 'entry', widthMm: 900 },
  { label: 'Clean service window', kind: 'service-window', flow: 'clean-out', widthMm: 900 },
  { label: 'Dirty return window', kind: 'service-window', flow: 'dirty-in', widthMm: 900 },
]

function planArchitectureAdditions(project: KitchenProject, active: LayoutVariant, snapMm: number) {
  const missing = OPENING_SPECS.filter((spec) => !active.architecture.openings.some((opening) =>
    opening.kind === spec.kind && opening.flow === spec.flow))
  if (missing.length === 0) return { operations: [] as AddOpeningOperation[], architecture: active.architecture, adjusted: false }
  const architectureEditable = project.variants.every((variant) =>
    !variant.architecture.locked && variant.layoutConstraints?.permissions?.architecture !== false)
  if (!architectureEditable) return { operations: [] as AddOpeningOperation[], architecture: active.architecture, adjusted: false }

  const plannedByVariant = new Map(project.variants.map((variant) => [variant.id, {
    ...variant,
    architecture: { ...variant.architecture, openings: [...variant.architecture.openings] },
  }]))
  const operations: AddOpeningOperation[] = []
  let adjusted = false

  for (const spec of missing) {
    const openingId = `auto-${spec.flow}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
    let selected: Opening | undefined
    for (let segmentIndex = 0; segmentIndex < active.architecture.roomPolygon.length && !selected; segmentIndex += 1) {
      const length = segmentLength(active.architecture, segmentIndex)
      for (let offsetMm = snapMm; !selected && offsetMm + spec.widthMm + snapMm <= length; offsetMm += Math.max(50, snapMm)) {
        const candidate: Opening = {
          id: openingId,
          label: spec.label,
          kind: spec.kind,
          flow: spec.flow,
          wall: 'top',
          segmentIndex,
          offsetMm,
          widthMm: spec.widthMm,
          ...(spec.kind === 'door' ? { swingDepthMm: 900 } : { sillHeightMm: 950, heightMm: 900 }),
        }
        const layoutsNeedingOpening = [...plannedByVariant.values()].filter((variant) =>
          !variant.architecture.openings.some((opening) => opening.kind === spec.kind && opening.flow === spec.flow))
        const safeInEveryLayout = layoutsNeedingOpening.every((variant) =>
          segmentLength(variant.architecture, segmentIndex) >= offsetMm + spec.widthMm + snapMm
            && !openingOverlaps(variant.architecture, candidate)
            && openingKeepClear(variant, candidate))
        if (safeInEveryLayout) selected = candidate
      }
    }
    if (!selected) continue
    for (const variant of plannedByVariant.values()) {
      if (variant.architecture.openings.some((opening) => opening.kind === spec.kind && opening.flow === spec.flow)) continue
      operations.push({ type: 'add_opening', variantId: variant.id, opening: selected })
      variant.architecture.openings.push(selected)
    }
    adjusted = true
  }

  return {
    operations,
    architecture: plannedByVariant.get(active.id)?.architecture ?? active.architecture,
    adjusted,
  }
}

const candidatePositions = (item: EquipmentItem, variant: LayoutVariant, snapMm: number) => {
  const polygon = variant.architecture.roomPolygon
  const minimumX = Math.min(...polygon.map((point) => point.x))
  const maximumX = Math.max(...polygon.map((point) => point.x))
  const minimumY = Math.min(...polygon.map((point) => point.y))
  const maximumY = Math.max(...polygon.map((point) => point.y))
  const step = Math.max(50, snapMm)
  const positions: { xMm: number; yMm: number; distance: number }[] = []
  for (let yMm = minimumY; yMm <= maximumY; yMm += step) {
    for (let xMm = minimumX; xMm <= maximumX; xMm += step) {
      positions.push({ xMm, yMm, distance: Math.hypot(xMm - item.xMm, yMm - item.yMm) })
    }
  }
  return positions.sort((left, right) => left.distance - right.distance || left.yMm - right.yMm || left.xMm - right.xMm)
}

const hardConstraintsAllow = (item: EquipmentItem, variant: LayoutVariant) => {
  const footprint = rotatedFootprint(item)
  if ((variant.layoutConstraints?.noGoZones ?? []).some((zone) => polygonsOverlap(footprint, rectPolygon(zone)))) return false
  if (doorSwingEnvelopes(variant.architecture).some(({ polygon }) => polygonsOverlap(footprint, polygon))) return false
  return true
}

/**
 * Plans moves with the same top-left coordinate model used by rotatedFootprint.
 * A candidate is accepted only when the production diagnostics report no issue
 * involving the item and it avoids explicit no-go zones and door swings.
 */
function planSafeMoves(variant: LayoutVariant, equipment: readonly EquipmentItem[], snapMm: number) {
  let planned = [...equipment]
  const moves: MoveOperation[] = []
  const lockedIds = new Set(variant.layoutConstraints?.lockedComponentIds ?? [])
  const initialIssues = analyzeLayout(variant.architecture, planned, { layoutConstraints: variant.layoutConstraints })
  const issueCount = new Map<string, number>()
  initialIssues.forEach((issue) => issue.itemIds.forEach((id) => issueCount.set(id, (issueCount.get(id) ?? 0) + 1)))
  planned.forEach((item) => {
    if (!hardConstraintsAllow(item, variant)) issueCount.set(item.id, (issueCount.get(item.id) ?? 0) + 1)
  })
  const candidates = planned
    .filter((item) => (issueCount.get(item.id) ?? 0) > 0 && item.movable && !lockedIds.has(item.id))
    .sort((left, right) =>
      (left.widthMm * left.depthMm) - (right.widthMm * right.depthMm)
      || (issueCount.get(right.id) ?? 0) - (issueCount.get(left.id) ?? 0))

  for (const item of candidates) {
    const currentIssues = analyzeLayout(variant.architecture, planned, { layoutConstraints: variant.layoutConstraints })
    const currentItemIssues = currentIssues.filter((issue) => issue.itemIds.includes(item.id))
    if (currentItemIssues.length === 0 && hardConstraintsAllow(item, variant)) continue
    const hasBlockingGeometry = currentItemIssues.some((issue) => issue.severity === 'error') || !hardConstraintsAllow(item, variant)
    const index = planned.findIndex((candidate) => candidate.id === item.id)
    if (index < 0) continue
    for (const position of candidatePositions(planned[index], variant, snapMm).slice(0, MAX_PLACEMENT_ATTEMPTS_PER_ITEM)) {
      const candidate = { ...planned[index], xMm: position.xMm, yMm: position.yMm }
      if (!hardConstraintsAllow(candidate, variant)) continue
      const next = planned.map((entry, candidateIndex) => candidateIndex === index ? candidate : entry)
      const issues = analyzeLayout(variant.architecture, next, { layoutConstraints: variant.layoutConstraints })
      const candidateIssues = issues.filter((issue) => issue.itemIds.includes(candidate.id))
      // Resolve hard geometry first even when a dense plan cannot also eliminate
      // every advisory clearance. Warning-only moves remain strictly zero-issue.
      if (hasBlockingGeometry
        ? candidateIssues.some((issue) => issue.severity === 'error')
        : candidateIssues.length > 0) continue
      planned = next
      if (candidate.xMm !== item.xMm || candidate.yMm !== item.yMm) {
        moves.push({
          type: 'update_component',
          variantId: variant.id,
          componentId: item.id,
          patch: { xMm: candidate.xMm, yMm: candidate.yMm },
        })
      }
      break
    }
  }
  return { moves, equipment: planned }
}

const PRODUCTION_ROLES = new Set<StaffRole>(['head-chef', 'sous-chef', 'cdp'])
const KNOWN_ROLES = new Set<StaffRole>(['head-chef', 'sous-chef', 'cdp', 'busser-washer'])
const KNOWN_CAPABILITIES = new Set<StationCapability>([
  'flat-top-cook', 'fryer-cook', 'range-cook', 'tandoor-cook', 'cold-retrieval', 'food-prep',
  'finish-plate', 'clean-window', 'dirty-window', 'dirty-landing', 'dish-pre-rinse', 'dish-wash',
  'clean-landing', 'hand-wash', 'mix',
])

function planScenarioAdjustment(variant: LayoutVariant, scenario: SimulationScenario | undefined): {
  operation?: ScenarioOperation
  scenario?: SimulationScenario
} {
  if (!scenario) return {}
  const staff = scenario.staff
    .filter((assignment) => KNOWN_ROLES.has(assignment.role))
    .map((assignment) => ({ ...assignment, count: Math.max(1, Math.floor(Number.isFinite(assignment.count) ? assignment.count : 1)) }))
  if (!staff.some((assignment) => PRODUCTION_ROLES.has(assignment.role) && assignment.count > 0)) staff.push({ role: 'head-chef', count: 1 })
  if (!staff.some((assignment) => assignment.role === 'busser-washer' && assignment.count > 0)) staff.push({ role: 'busser-washer', count: 1 })

  const stationCapacities = Object.fromEntries(Object.entries(scenario.stationCapacities ?? {}).flatMap(([itemId, capacity]) => {
    const item = variant.equipment.find((candidate) => candidate.id === itemId)
    if (!item) return []
    const normalized = Math.max(1, Math.min(physicalStationCapacity(item), Math.floor(Number.isFinite(capacity) ? capacity : 1)))
    return [[itemId, normalized]]
  }))
  const taskDurations = Object.fromEntries(Object.entries(scenario.taskDurations ?? {}).filter(([capability, range]) =>
    KNOWN_CAPABILITIES.has(capability as StationCapability)
      && Boolean(range)
      && Number.isFinite(range?.minSeconds)
      && Number.isFinite(range?.maxSeconds)
      && Number(range?.minSeconds) > 0
      && Number(range?.minSeconds) <= Number(range?.maxSeconds))) as SimulationScenario['taskDurations']
  const patch: Partial<SimulationScenario> = {
    covers: Number.isInteger(scenario.covers) && scenario.covers > 0 ? scenario.covers : 1,
    staff,
    stationCapacities,
    taskDurations,
  }
  const changed = JSON.stringify({ covers: scenario.covers, staff: scenario.staff, stationCapacities: scenario.stationCapacities ?? {}, taskDurations: scenario.taskDurations ?? {} })
    !== JSON.stringify(patch)
  if (!changed) return { scenario }
  return {
    operation: { type: 'update_scenario', variantId: variant.id, scenarioId: scenario.id, patch },
    scenario: { ...scenario, ...patch },
  }
}

const resultMessage = (status: AutomaticPlanFixStatus, result: Pick<AutomaticPlanFixResult, 'addedCount' | 'movedCount' | 'architectureAdjusted' | 'scenarioAdjusted' | 'after'>) => {
  const changes = [
    result.addedCount ? `${result.addedCount} essential item${result.addedCount === 1 ? '' : 's'} added` : '',
    result.movedCount ? `${result.movedCount} item${result.movedCount === 1 ? '' : 's'} repositioned` : '',
    result.architectureAdjusted ? 'missing room openings added' : '',
    result.scenarioAdjusted ? 'scenario settings repaired' : '',
  ].filter(Boolean)
  if (status === 'success') return changes.length
    ? `Fixed automatically: ${changes.join(', ')}. The plan is ready to simulate.`
    : 'The plan is already ready to simulate.'
  if (status === 'partial') return `Applied the safe fixes${changes.length ? `: ${changes.join(', ')}` : ''}. ${result.after.blockers + result.after.layoutErrors} blocking issue${result.after.blockers + result.after.layoutErrors === 1 ? '' : 's'} still need a decision.`
  return 'No safe automatic fix could be applied. Review the remaining item that needs a decision.'
}

/** Applies every safe automatic repair as one undoable workspace operation. */
export function applyAutomaticPlanFixes(store: ProjectStore): AutomaticPlanFixResult {
  const state = store.getState()
  const variant = getActiveVariant(state)
  const scenario = scenarioFor(store)
  const before = summarize(variant, scenario)
  const architecture = planArchitectureAdditions(state.project, variant, state.project.snapMm)
  const variantWithArchitecture = { ...variant, architecture: architecture.architecture }
  const additions = planEssentialAdditions(variantWithArchitecture, scenario, state.project.snapMm)
  const moves = planSafeMoves(variantWithArchitecture, additions.equipment, state.project.snapMm)
  const plannedVariant = { ...variantWithArchitecture, equipment: moves.equipment }
  const scenarioAdjustment = planScenarioAdjustment(plannedVariant, scenario)
  const operations = [...architecture.operations, ...additions.operations, ...moves.moves, ...(scenarioAdjustment.operation ? [scenarioAdjustment.operation] : [])]

  if (operations.length === 0) {
    const status: AutomaticPlanFixStatus = before.blockers === 0 && before.layoutErrors === 0 ? 'success' : 'failure'
    const result = {
      status,
      applied: false,
      addedCount: 0,
      movedCount: 0,
      architectureAdjusted: false,
      scenarioAdjusted: false,
      before,
      after: before,
      remaining: remainingMessages(variant, scenario).slice(0, 5),
    }
    return { ...result, message: resultMessage(status, result) }
  }

  const applied = store.getState().applyWorkspaceOperations(operations, 'Fix plan automatically')
  if (!applied.ok) return {
    status: 'failure',
    applied: false,
    message: `Automatic fix was not applied: ${applied.message}`,
    addedCount: 0,
    movedCount: 0,
    architectureAdjusted: false,
    scenarioAdjusted: false,
    before,
    after: before,
    remaining: remainingMessages(variant, scenario).slice(0, 5),
  }

  const nextState = store.getState()
  const nextVariant = getActiveVariant(nextState)
  const nextScenario = scenarioFor(store)
  const after = summarize(nextVariant, nextScenario)
  const status: AutomaticPlanFixStatus = after.blockers === 0 && after.layoutErrors === 0 ? 'success' : 'partial'
  const result = {
    status,
    applied: true,
    addedCount: additions.operations.length,
    movedCount: moves.moves.length,
    architectureAdjusted: architecture.adjusted,
    scenarioAdjusted: Boolean(scenarioAdjustment.operation),
    before,
    after,
    remaining: remainingMessages(nextVariant, nextScenario).slice(0, 5),
  }
  return { ...result, message: resultMessage(status, result) }
}
