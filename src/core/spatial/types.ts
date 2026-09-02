export type Millimetres = number
export type DisplayUnit = 'mm' | 'cm' | 'in' | 'ft'
export type PointMm = { x: Millimetres; y: Millimetres }

export interface SpatialRect {
  id: string
  xMm: Millimetres
  yMm: Millimetres
  widthMm: Millimetres
  depthMm: Millimetres
}

export interface SpatialItem extends SpatialRect {
  label: string
  heightMm: Millimetres
  rotationDeg: number
  dimensionsLocked: boolean
  movable: boolean
  removable: boolean
  visualPreset?: string
  tags?: readonly string[]
}

export interface SpatialOpening {
  id: string
  label: string
  kind: string
  wall: 'top' | 'right' | 'bottom' | 'left'
  offsetMm: Millimetres
  widthMm: Millimetres
  sillHeightMm?: Millimetres
  heightMm?: Millimetres
  flow?: string
  swingDepthMm?: Millimetres
}

export interface SpatialZone extends SpatialRect { label: string }

export interface SpatialArchitecture<TOpening extends SpatialOpening = SpatialOpening, TZone extends SpatialZone = SpatialZone> {
  widthMm: Millimetres
  depthMm: Millimetres
  wallHeightMm: Millimetres
  roomPolygon: PointMm[]
  openings: TOpening[]
  pillars: SpatialRect[]
  storageZones: TZone[]
  locked: boolean
}

export interface SpatialVariant<TItem extends SpatialItem, TArchitecture extends SpatialArchitecture = SpatialArchitecture> {
  id: string
  name: string
  parentId?: string
  architecture: TArchitecture
  items: TItem[]
  createdAt: string
  updatedAt: string
}

export interface SpatialProject<TItem extends SpatialItem, TScenario, TArchitecture extends SpatialArchitecture = SpatialArchitecture> {
  schemaVersion: number
  id: string
  name: string
  displayUnit: DisplayUnit
  snapMm: Millimetres
  architecture: TArchitecture
  variants: SpatialVariant<TItem, TArchitecture>[]
  scenarios: TScenario[]
  activeVariantId: string
  activeScenarioId: string
}

export interface ProjectEnvelope<TProject> { revision: number; project: TProject }

export interface SpatialDocumentAdapter<TProject, TItem extends SpatialItem, TScenario> {
  read(project: TProject): SpatialProject<TItem, TScenario>
  write(spatial: SpatialProject<TItem, TScenario>, source: TProject): TProject
  validateItem(value: unknown): { success: true; data: TItem } | { success: false; issues: unknown }
  validateArchitecture(value: unknown): { success: true; data: SpatialArchitecture } | { success: false; issues: unknown }
  describeCapabilities?(): { itemPresets?: readonly string[]; domainCapabilities?: readonly string[]; catalog?: readonly unknown[] }
}
