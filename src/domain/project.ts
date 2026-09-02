export type Millimetres = number
export type DisplayUnit = 'mm' | 'cm' | 'in' | 'ft'
export type PointMm = { x: Millimetres; y: Millimetres }

export type EquipmentCategory =
  | 'cooking'
  | 'cold'
  | 'prep'
  | 'washing'
  | 'landing'
  | 'storage'
  | 'hood'
  | 'custom'

export type StationCapability =
  | 'flat-top-cook'
  | 'fryer-cook'
  | 'range-cook'
  | 'tandoor-cook'
  | 'cold-retrieval'
  | 'food-prep'
  | 'finish-plate'
  | 'clean-window'
  | 'dirty-window'
  | 'dirty-landing'
  | 'dish-pre-rinse'
  | 'dish-wash'
  | 'clean-landing'
  | 'hand-wash'
  | 'mix'

export type StaffRole = 'head-chef' | 'sous-chef' | 'cdp' | 'busser-washer'
export type ArrivalPattern = 'seating-wave' | 'steady' | 'two-waves'

export interface RectMm {
  id: string
  xMm: Millimetres
  yMm: Millimetres
  widthMm: Millimetres
  depthMm: Millimetres
}

export interface Opening {
  id: string
  label: string
  kind: 'door' | 'service-window' | 'sealed-opening'
  wall: 'top' | 'right' | 'bottom' | 'left'
  /** Zero-based roomPolygon edge target; wall remains the rectangular/migration fallback. */
  segmentIndex?: number
  offsetMm: Millimetres
  widthMm: Millimetres
  sillHeightMm?: Millimetres
  heightMm?: Millimetres
  flow?: 'entry' | 'clean-out' | 'dirty-in' | 'closed'
  swingDepthMm?: Millimetres
}

export interface StorageZone extends RectMm {
  label: string
  adjacent: boolean
}

export interface Architecture {
  widthMm: Millimetres
  depthMm: Millimetres
  wallHeightMm: Millimetres
  roomPolygon: PointMm[]
  openings: Opening[]
  pillars: RectMm[]
  storageZones: StorageZone[]
  locked: boolean
}

export interface ClearanceSpec {
  frontMm: Millimetres
  leftMm?: Millimetres
  rightMm?: Millimetres
  backMm?: Millimetres
  kind: 'work' | 'door-swing' | 'heat' | 'service'
}

export interface EquipmentItem {
  id: string
  catalogId?: string
  label: string
  category: EquipmentCategory
  widthMm: Millimetres
  depthMm: Millimetres
  heightMm: Millimetres
  xMm: Millimetres
  yMm: Millimetres
  rotationDeg: number
  dimensionsLocked: boolean
  movable: boolean
  removable: boolean
  capabilities: StationCapability[]
  clearance?: ClearanceSpec
  approximate?: boolean
  notes?: string
  visualPreset?: string
  configurationPreset?: string
  appearanceSkinId?: string
}

export interface OperationalProfile {
  covers?: number
  peakDurationMinutes?: number
  arrivalPattern?: ArrivalPattern
  serviceStyle?: string
  menuAssumptions?: string[]
  staff?: StaffAssignment[]
  targetCapacityPerHour?: number
}

export interface AutoLayoutPermissions {
  placement: boolean
  equipmentRedesign: boolean
  architecture: boolean
}

export interface LayoutConstraints {
  lockedComponentIds?: string[]
  lockedArchitectureElementIds?: string[]
  minimumAisleMm?: Millimetres
  noGoZones?: RectMm[]
  permissions?: AutoLayoutPermissions
}

export interface AdoptedExperimentManifest {
  id: string
  documentId?: string
  revision?: number
  baselineVariantId: string
  finalistId: string
  createdAt: string
  scenarioIds: string[]
  seeds: number[]
  confirmationSeeds: number[]
  permissions: AutoLayoutPermissions
  lockedComponentIds?: string[]
  lockedArchitectureElementIds?: string[]
  hardRules?: {
    minimumAisleMm: number
    bodyRadiusMm?: number
    noGoZones: RectMm[]
    requiredCapacityByCapability?: Partial<Record<StationCapability, number>>
  }
  budget: { maxDurationMs?: number; maxEvaluations?: number }
  priority?: 'balanced' | 'service' | 'travel' | 'minimal-change'
  targetP90WaitSeconds?: number
  objective: string
  resultHash?: string
  resultMetrics?: Record<string, number>
}

export interface LayoutVariant {
  id: string
  name: string
  parentId?: string
  architecture: Architecture
  equipment: EquipmentItem[]
  operationalProfile?: OperationalProfile
  layoutConstraints?: LayoutConstraints
  adoptedExperimentManifest?: AdoptedExperimentManifest
  createdAt: string
  updatedAt: string
}

export interface StaffAssignment {
  role: StaffRole
  count: number
}

export interface ScenarioChecks {
  collisions: boolean
  doorSwings: boolean
  dirtyCleanCrossings: boolean
}

export interface SimulationScenario {
  id: string
  name: string
  covers: number
  durationMinutes: number
  arrivalPattern: ArrivalPattern
  cookToOrderRatio: number
  seed: number
  staff: StaffAssignment[]
  checks: ScenarioChecks
  taskDurations?: Partial<Record<StationCapability, { minSeconds: number; maxSeconds: number }>>
  stationCapacities?: Record<string, number>
}

export interface KitchenProject {
  schemaVersion: 2
  id: string
  name: string
  displayUnit: DisplayUnit
  snapMm: Millimetres
  /** Compatibility mirror of the active variant architecture during the v2 transition. */
  architecture: Architecture
  variants: LayoutVariant[]
  scenarios: SimulationScenario[]
  activeVariantId: string
  activeScenarioId: string
}
