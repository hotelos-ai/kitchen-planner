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
  kind: 'door' | 'window' | 'service-window' | 'sealed-opening'
  wall: 'top' | 'right' | 'bottom' | 'left'
  /** Zero-based roomPolygon edge target; wall remains the rectangular/migration fallback. */
  segmentIndex?: number
  offsetMm: Millimetres
  widthMm: Millimetres
  sillHeightMm?: Millimetres
  heightMm?: Millimetres
  flow?: 'entry' | 'clean-out' | 'dirty-in' | 'closed'
  /** Defaults to hinged for projects created before configurable door types. */
  doorType?: 'hinged' | 'double-hinged' | 'sliding' | 'double-sliding'
  swingDepthMm?: Millimetres
  swingHinge?: 'start' | 'end'
  swingDirection?: 'inward' | 'outward'
}

export interface StorageZone extends RectMm {
  label: string
  adjacent: boolean
}

export interface Pillar extends RectMm {
  shape?: 'round'
}

export interface Architecture {
  widthMm: Millimetres
  depthMm: Millimetres
  wallHeightMm: Millimetres
  roomPolygon: PointMm[]
  openings: Opening[]
  pillars: Pillar[]
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

export type EquipmentAccessFace = 'front' | 'back' | 'left' | 'right'

export interface EquipmentAccessFlow {
  inputFace: EquipmentAccessFace
  outputFace: EquipmentAccessFace
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
  accessFlow?: EquipmentAccessFlow
  approximate?: boolean
  notes?: string
  visualPreset?: string
  configurationPreset?: string
  appearanceSkinId?: string
  /** Explicit 2D plan draw order. Higher values render above lower values. */
  planLayerOrder?: number
  /** Explicit height of the bottom of a shelf assembly above the finished floor. */
  baseElevationMm?: Millimetres
  /** Custom shelf-deck elevations measured from the floor, ordered bottom to top. */
  shelfElevationsMm?: Millimetres[]
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

export interface LayoutCheckpoint {
  id: string
  revision: number
  label: string
  createdAt: string
  architecture: Architecture
  equipment: EquipmentItem[]
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
  checkpoints?: LayoutCheckpoint[]
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

export type ServiceVariability = 'low' | 'typical' | 'high'

export type MenuItemSource = 'user-provided' | 'imported' | 'template-estimate' | 'system-inferred'

export interface MenuItemStep {
  label: string
  capability: StationCapability
  activeSeconds: number
  passiveSeconds?: { minSeconds: number; maxSeconds: number }
}

export interface SimulationMenuItem {
  id: string
  name: string
  sharePct: number
  source: MenuItemSource
  steps: MenuItemStep[]
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
  serviceStyle?: string
  variability?: ServiceVariability
  menuItems?: SimulationMenuItem[]
}

export interface KitchenProject {
  schemaVersion: 4
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
  /** Last zero-issue snapshot used by Reset to working version. */
  lastWorking?: {
    architecture: Architecture
    equipmentByVariant: Record<string, EquipmentItem[]>
  }
}
