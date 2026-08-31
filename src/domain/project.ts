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
}

export interface LayoutVariant {
  id: string
  name: string
  parentId?: string
  equipment: EquipmentItem[]
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
}

export interface KitchenProject {
  schemaVersion: 1
  id: string
  name: string
  displayUnit: DisplayUnit
  snapMm: Millimetres
  architecture: Architecture
  variants: LayoutVariant[]
  scenarios: SimulationScenario[]
  activeVariantId: string
  activeScenarioId: string
}
