import type { Architecture, EquipmentItem, PointMm, SimulationScenario, StaffRole, StationCapability } from '../domain/project'
import type { SpatialAgentFrame } from '../core/agents/types'

export interface SimulationInput {
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  scenario: SimulationScenario
}

export interface SimTask {
  id: string
  orderId?: string
  dishBatchId?: string
  predecessorId?: string
  capability: StationCapability
  stationId: string
  durationSeconds: number
  readyAtSeconds: number
  flow: 'clean' | 'dirty'
  preferredRoles: readonly StaffRole[]
}

export type AgentFrame = SpatialAgentFrame<StaffRole>

export interface SimulationFrame {
  elapsedSeconds: number
  agents: readonly AgentFrame[]
}

export type SimulationEvent =
  | { type: 'travel'; agentId: string; role: StaffRole; distanceMm: number }
  | { type: 'state-time'; role: StaffRole; state: 'walking' | 'working' | 'waiting'; durationSeconds: number }
  | { type: 'station-work'; stationId: string; durationSeconds: number }
  | { type: 'queue'; stationId: string; durationSeconds: number }
  | { type: 'congestion'; hotLine: boolean }
  | { type: 'opposing-flow' }
  | { type: 'door-conflict' }
  | { type: 'dirty-clean-crossing' }
  | { type: 'unreachable'; taskId: string }
  | { type: 'path-metric'; kind: 'finish-to-pass' | 'dirty-to-wash'; distanceMm: number }
  | { type: 'order-arrived'; orderId: string; atSeconds: number }
  | { type: 'order-completed'; orderId: string; arrivedAtSeconds: number; completedAtSeconds: number; durationSeconds: number }
  | { type: 'traffic'; xMm: number; yMm: number; visits: number }

export interface TaskTimelineEntry {
  taskId: string
  orderId?: string
  dishBatchId?: string
  stationId: string
  capability: StationCapability
  agentId: string
  eligibleAtSeconds: number
  travelStartSeconds: number
  arrivedAtSeconds: number
  workStartSeconds: number
  workEndSeconds: number
  queueSeconds: number
}

export interface OrderTimeline {
  id: string
  arrivedAtSeconds: number
  completedAtSeconds?: number
  stages: readonly TaskTimelineEntry[]
}

export interface SimulationMetrics {
  totalTravelMm: number
  travelByRoleMm: Record<StaffRole, number>
  timeByRoleSeconds: Record<StaffRole, { walking: number; working: number; waiting: number }>
  stationUtilization: Record<string, number>
  queueSeconds: Record<string, number>
  congestionEvents: number
  hotLineCongestionEvents: number
  opposingFlowEvents: number
  doorConflictEvents: number
  dirtyCleanCrossings: number
  unreachableTasks: number
  finishToPassTravelMm: number
  dirtyToWashTravelMm: number
  completedOrders: number
  totalOrders: number
  unfinishedOrders: number
  averageOrderWaitSeconds: number
  orderCompletionP50Seconds: number
  orderCompletionP90Seconds: number
  ordersWithin15MinutesPct: number
  ordersWithin20MinutesPct: number
  peakOrderBacklog: number
  throughputPerHour: number
  orderWaitSamplesSeconds: readonly number[]
  trafficCells: readonly { xMm: number; yMm: number; visits: number }[]
}

export interface SimulationResult {
  seed: number
  durationSeconds: number
  frames: readonly SimulationFrame[]
  events: readonly SimulationEvent[]
  taskTimeline: readonly TaskTimelineEntry[]
  orders: readonly OrderTimeline[]
  metrics: SimulationMetrics
  warnings: readonly string[]
}

export interface NavCell { x: number; y: number }

export interface NavGrid {
  readonly cellSizeMm: number
  readonly widthCells: number
  readonly heightCells: number
  toCell(point: PointMm): NavCell
  toPointMm(cell: NavCell): PointMm
  key(cell: NavCell): string
  isWalkable(point: PointMm): boolean
  nearestWalkable(cell: NavCell): NavCell
  walkableNeighbours(cell: NavCell): NavCell[]
}
