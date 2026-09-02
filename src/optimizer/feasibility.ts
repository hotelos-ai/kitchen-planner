import { pointInPolygon, polygonsOverlap, rotatedFootprint } from '../domain/geometry'
import { isFloorObstacle } from '../domain/catalog/floor-obstacle'
import { analyzeLayout, doorSwingEnvelopes } from '../domain/layout-diagnostics'
import type { Architecture, EquipmentItem, LayoutVariant, Opening, PointMm, RectMm, StationCapability } from '../domain/project'
import { buildNavGrid, navigationApproachOffsetMm, stationApproachPoints } from '../simulation/nav-grid'
import { physicalStationCapacity } from '../simulation/validation'
import type { OptimizerManifest } from './types'

export interface FeasibilityResult { feasible: boolean; codes: string[]; reasons: string[] }

const rectPolygon = (rect: Pick<RectMm, 'xMm' | 'yMm' | 'widthMm' | 'depthMm'>): PointMm[] => [
  { x: rect.xMm, y: rect.yMm }, { x: rect.xMm + rect.widthMm, y: rect.yMm },
  { x: rect.xMm + rect.widthMm, y: rect.yMm + rect.depthMm }, { x: rect.xMm, y: rect.yMm + rect.depthMm },
]

const onSegment = (point: PointMm, start: PointMm, end: PointMm) => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y)
  return Math.abs(cross) < .01
    && point.x >= Math.min(start.x, end.x) - .01 && point.x <= Math.max(start.x, end.x) + .01
    && point.y >= Math.min(start.y, end.y) - .01 && point.y <= Math.max(start.y, end.y) + .01
}

const insideOrBoundary = (point: PointMm, polygon: readonly PointMm[]) => pointInPolygon(point, [...polygon])
  || polygon.some((start, index) => onSegment(point, start, polygon[(index + 1) % polygon.length]))

const stableItem = (item: EquipmentItem) => JSON.stringify(item)
const architecturePhysical = (variant: LayoutVariant) => JSON.stringify(variant.architecture)
const dimensionsChanged = (left: EquipmentItem, right: EquipmentItem) =>
  left.catalogId !== right.catalogId || left.widthMm !== right.widthMm || left.depthMm !== right.depthMm
  || left.heightMm !== right.heightMm || left.configurationPreset !== right.configurationPreset
  || JSON.stringify([...left.capabilities].sort()) !== JSON.stringify([...right.capabilities].sort())

const dimensionValuesChanged = (left: EquipmentItem, right: EquipmentItem) =>
  left.widthMm !== right.widthMm || left.depthMm !== right.depthMm || left.heightMm !== right.heightMm

const positionChanged = (left: EquipmentItem, right: EquipmentItem) =>
  left.xMm !== right.xMm || left.yMm !== right.yMm || left.rotationDeg !== right.rotationDeg

const architectureRoom = (architecture: Architecture) => JSON.stringify({
  widthMm: architecture.widthMm,
  depthMm: architecture.depthMm,
  wallHeightMm: architecture.wallHeightMm,
  roomPolygon: architecture.roomPolygon,
})

const architectureElement = (architecture: Architecture, id: string): unknown => {
  if (id === 'room') return architectureRoom(architecture)
  return architecture.openings.find((value) => value.id === id)
    ?? architecture.pillars.find((value) => value.id === id)
    ?? architecture.storageZones.find((value) => value.id === id)
}

const openingInteriorPoint = (architecture: Architecture, opening: Opening, insetMm: number): PointMm => {
  if (opening.segmentIndex !== undefined) {
    const start = architecture.roomPolygon[opening.segmentIndex]
    const end = architecture.roomPolygon[(opening.segmentIndex + 1) % architecture.roomPolygon.length]
    if (start && end) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
      const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
      const edge = { x: start.x + unit.x * (opening.offsetMm + opening.widthMm / 2), y: start.y + unit.y * (opening.offsetMm + opening.widthMm / 2) }
      const normals = [{ x: -unit.y, y: unit.x }, { x: unit.y, y: -unit.x }]
      const inside = normals.map((normal) => ({ x: edge.x + normal.x * insetMm, y: edge.y + normal.y * insetMm }))
        .find((point) => pointInPolygon(point, architecture.roomPolygon))
      if (inside) return inside
    }
  }
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.wall === 'top') return { x: middle, y: insetMm }
  if (opening.wall === 'bottom') return { x: middle, y: architecture.depthMm - insetMm }
  if (opening.wall === 'left') return { x: insetMm, y: middle }
  return { x: architecture.widthMm - insetMm, y: middle }
}

const clearanceIssueIds = (variant: LayoutVariant, manifest: OptimizerManifest) => new Set(analyzeLayout(
  variant.architecture,
  variant.equipment,
  { layoutConstraints: { noGoZones: manifest.hardRules.noGoZones } },
).filter((issue) => issue.code === 'clearance-obstructed').map((issue) => issue.id))

const doorOverlapIds = (variant: LayoutVariant) => new Set(doorSwingEnvelopes(variant.architecture).flatMap(({ opening, polygon }) =>
  variant.equipment.filter((item) => isFloorObstacle(item) && polygonsOverlap(rotatedFootprint(item), polygon))
    .map((item) => `${opening.id}:${item.id}`)))

const reachabilityCache = new WeakMap<LayoutVariant, Map<string, Set<string>>>()

const reachableStationIds = (variant: LayoutVariant, manifest: OptimizerManifest): Set<string> => {
  const cacheKey = JSON.stringify({
    minimumAisleMm: manifest.hardRules.minimumAisleMm,
    bodyRadiusMm: manifest.hardRules.bodyRadiusMm,
    noGoZones: manifest.hardRules.noGoZones,
  })
  const existing = reachabilityCache.get(variant)?.get(cacheKey)
  if (existing) return existing
  const clearanceMm = Math.max(manifest.hardRules.bodyRadiusMm ?? 50, manifest.hardRules.minimumAisleMm / 2)
  const approachOffsetMm = navigationApproachOffsetMm({
    bodyRadiusMm: manifest.hardRules.bodyRadiusMm,
    minimumAisleMm: manifest.hardRules.minimumAisleMm,
  }, manifest.hardRules.minimumAisleMm, 100)
  const stations = variant.equipment.filter((item) => item.capabilities.length > 0 && stationApproachPoints(item, undefined, approachOffsetMm).length > 0)
  if (!stations.length) return new Set()
  const entry = variant.architecture.openings.find((opening) => opening.kind === 'door' && opening.flow === 'entry')
  const start = entry ? openingInteriorPoint(variant.architecture, entry, clearanceMm + 50) : {
    x: variant.architecture.roomPolygon.reduce((sum, point) => sum + point.x, 0) / variant.architecture.roomPolygon.length,
    y: variant.architecture.roomPolygon.reduce((sum, point) => sum + point.y, 0) / variant.architecture.roomPolygon.length,
  }
  const reachable = new Set<string>()
  try {
    const grid = buildNavGrid({
      architecture: variant.architecture,
      equipment: variant.equipment,
      layoutConstraints: { minimumAisleMm: manifest.hardRules.minimumAisleMm, noGoZones: manifest.hardRules.noGoZones },
    }, 100, { bodyRadiusMm: manifest.hardRules.bodyRadiusMm, minimumAisleMm: manifest.hardRules.minimumAisleMm })
    const startCell = grid.nearestWalkable(grid.toCell(start))
    const pending = [startCell]
    const connected = new Set<string>([grid.key(startCell)])
    while (pending.length) {
      const current = pending.shift()!
      grid.walkableNeighbours(current).forEach((next) => {
        const key = grid.key(next)
        if (connected.has(key)) return
        connected.add(key)
        pending.push(next)
      })
    }
    stations.forEach((station) => {
      const canReach = stationApproachPoints(station, undefined, approachOffsetMm)
        .some((goal) => grid.isWalkable(goal) && connected.has(grid.key(grid.toCell(goal))))
      if (canReach) reachable.add(station.id)
    })
  } catch { /* No station is reachable on an unusable grid. */ }
  const byRules = reachabilityCache.get(variant) ?? new Map<string, Set<string>>()
  byRules.set(cacheKey, reachable)
  reachabilityCache.set(variant, byRules)
  return reachable
}

const capabilityCapacity = (equipment: readonly EquipmentItem[], capability: StationCapability) => equipment
  .filter((item) => item.capabilities.includes(capability))
  .reduce((sum, item) => sum + physicalStationCapacity(item), 0)

export function layoutDiff(baseline: LayoutVariant, candidate: LayoutVariant) {
  const baselineById = new Map(baseline.equipment.map((item) => [item.id, item]))
  const candidateById = new Map(candidate.equipment.map((item) => [item.id, item]))
  const common = candidate.equipment.filter((item) => baselineById.has(item.id))
  return {
    moved: common.filter((item) => { const source = baselineById.get(item.id)!; return item.xMm !== source.xMm || item.yMm !== source.yMm }).map((item) => item.id),
    rotated: common.filter((item) => item.rotationDeg !== baselineById.get(item.id)!.rotationDeg).map((item) => item.id),
    resized: common.filter((item) => dimensionsChanged(baselineById.get(item.id)!, item)).map((item) => item.id),
    substituted: common.filter((item) => { const source = baselineById.get(item.id)!; return item.catalogId !== source.catalogId || item.configurationPreset !== source.configurationPreset }).map((item) => item.id),
    added: candidate.equipment.filter((item) => !baselineById.has(item.id)).map((item) => item.id),
    removed: baseline.equipment.filter((item) => !candidateById.has(item.id)).map((item) => item.id),
    architectureChanged: architecturePhysical(baseline) !== architecturePhysical(candidate),
  }
}

export const layoutChangeCost = (baseline: LayoutVariant, candidate: LayoutVariant) => {
  const diff = layoutDiff(baseline, candidate)
  return diff.moved.length + diff.rotated.length + diff.resized.length * 3 + (diff.added.length + diff.removed.length) * 5 + (diff.architectureChanged ? 20 : 0)
}

export function checkCandidateFeasibility(baseline: LayoutVariant, candidate: LayoutVariant, manifest: OptimizerManifest): FeasibilityResult {
  const codes: string[] = []
  const reasons: string[] = []
  const add = (code: string, reason: string) => { if (!codes.includes(code)) { codes.push(code); reasons.push(reason) } }
  const baselineById = new Map(baseline.equipment.map((item) => [item.id, item]))
  const candidateById = new Map(candidate.equipment.map((item) => [item.id, item]))
  const diff = layoutDiff(baseline, candidate)

  manifest.lockedComponentIds.forEach((id) => {
    const before = baselineById.get(id)
    const after = candidateById.get(id)
    if (!before || !after || stableItem(before) !== stableItem(after)) add('locked-component-changed', `Locked component ${id} changed.`)
  })
  manifest.lockedArchitectureElementIds.forEach((id) => {
    if (JSON.stringify(architectureElement(baseline.architecture, id)) !== JSON.stringify(architectureElement(candidate.architecture, id))) {
      add('locked-architecture-changed', `Locked architecture element ${id} changed.`)
    }
  })
  baseline.equipment.forEach((before) => {
    const after = candidateById.get(before.id)
    if (!after) {
      if (!before.removable) add('nonremovable-component-removed', `${before.label} cannot be removed.`)
      return
    }
    if (!before.movable && positionChanged(before, after)) add('immovable-component-changed', `${before.label} cannot be moved or rotated.`)
    if (before.dimensionsLocked && dimensionValuesChanged(before, after)) add('locked-dimensions-changed', `${before.label} has locked dimensions.`)
  })
  if (baseline.architecture.locked && diff.architectureChanged) add('architecture-locked', 'The baseline architecture is locked.')
  if (!manifest.permissions.placement && (diff.moved.length || diff.rotated.length)) add('placement-change-not-authorized', 'Placement changes were not authorized for this run.')
  if (!manifest.permissions.equipmentRedesign && (diff.resized.length || diff.substituted.length || diff.added.length || diff.removed.length)) add('equipment-redesign-not-authorized', 'Equipment redesign was not authorized for this run.')
  if (!manifest.permissions.architecture && diff.architectureChanged) add('architecture-change-not-authorized', 'Architecture changes were not authorized for this run.')

  const polygon = candidate.architecture.roomPolygon
  const solids = candidate.equipment.filter(isFloorObstacle)
  solids.forEach((item) => {
    const footprint = rotatedFootprint(item)
    if (footprint.some((point) => !insideOrBoundary(point, polygon))) add('outside-room', `${item.label} is outside the room boundary.`)
    manifest.hardRules.noGoZones.forEach((zone) => {
      if (polygonsOverlap(footprint, rectPolygon(zone))) add('no-go-overlap', `${item.label} overlaps no-go zone ${zone.id}.`)
    })
  })
  for (let left = 0; left < solids.length; left += 1) {
    for (let right = left + 1; right < solids.length; right += 1) {
      if (polygonsOverlap(rotatedFootprint(solids[left]), rotatedFootprint(solids[right]))) add('component-overlap', `${solids[left].label} overlaps ${solids[right].label}.`)
    }
  }
  candidate.architecture.pillars.forEach((pillar) => solids.forEach((item) => {
    if (polygonsOverlap(rotatedFootprint(item), rectPolygon(pillar))) add('pillar-overlap', `${item.label} overlaps pillar ${pillar.id}.`)
  }))

  const baselineClearances = clearanceIssueIds(baseline, manifest)
  const candidateClearances = clearanceIssueIds(candidate, manifest)
  if ([...candidateClearances].some((id) => !baselineClearances.has(id))) add('clearance-obstructed', 'A configured equipment clearance is newly obstructed.')

  const baselineDoorOverlaps = doorOverlapIds(baseline)
  const candidateDoorOverlaps = doorOverlapIds(candidate)
  if ([...candidateDoorOverlaps].some((id) => !baselineDoorOverlaps.has(id))) add('door-swing-overlap', 'Equipment newly overlaps a modeled door swing.')

  Object.entries(manifest.hardRules.requiredCapacityByCapability ?? {}).forEach(([capability, required]) => {
    const actual = capabilityCapacity(candidate.equipment, capability as StationCapability)
    if (required !== undefined && actual < required) add('required-capacity-missing', `Capability ${capability} requires capacity ${required}; candidate provides ${actual}.`)
  })

  const baselineReachable = reachableStationIds(baseline, manifest)
  const candidateReachable = reachableStationIds(candidate, manifest)
  candidate.equipment.filter((item) => item.capabilities.length > 0).forEach((station) => {
    if (baselineReachable.has(station.id) && !candidateReachable.has(station.id)) add('station-unreachable', `Station ${station.label} became unreachable with the frozen circulation clearances.`)
  })

  return { feasible: codes.length === 0, codes, reasons }
}
