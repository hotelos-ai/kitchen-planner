import type { Architecture, KitchenProject, LayoutVariant, SimulationScenario } from './project'

const CREATED_AT = '2026-09-02T00:00:00.000Z'

export function rectangularArchitecture(widthMm: number, depthMm: number, wallHeightMm = 2800): Architecture {
  return {
    widthMm,
    depthMm,
    wallHeightMm,
    roomPolygon: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: depthMm },
      { x: 0, y: depthMm },
    ],
    openings: [{
      id: 'main-entry',
      label: 'Main entrance',
      kind: 'door',
      wall: 'bottom',
      segmentIndex: 2,
      offsetMm: Math.max(0, Math.round(widthMm / 2) - 450),
      widthMm: 900,
      flow: 'entry',
      swingDepthMm: 900,
    }],
    pillars: [],
    storageZones: [],
    locked: false,
  }
}

export function lShapedArchitecture(widthMm: number, depthMm: number, wallHeightMm = 2800): Architecture {
  const cutX = Math.round(widthMm * 0.55)
  const cutY = Math.round(depthMm * 0.45)
  return {
    widthMm,
    depthMm,
    wallHeightMm,
    roomPolygon: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: cutY },
      { x: cutX, y: cutY },
      { x: cutX, y: depthMm },
      { x: 0, y: depthMm },
    ],
    openings: [{
      id: 'main-entry',
      label: 'Main entrance',
      kind: 'door',
      wall: 'bottom',
      segmentIndex: 4,
      offsetMm: 400,
      widthMm: 900,
      flow: 'entry',
      swingDepthMm: 900,
    }],
    pillars: [],
    storageZones: [],
    locked: false,
  }
}

export function uShapedArchitecture(widthMm: number, depthMm: number, wallHeightMm = 2800): Architecture {
  const inset = Math.round(widthMm * 0.28)
  const cutY = Math.round(depthMm * 0.42)
  return {
    widthMm,
    depthMm,
    wallHeightMm,
    roomPolygon: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: depthMm },
      { x: widthMm - inset, y: depthMm },
      { x: widthMm - inset, y: cutY },
      { x: inset, y: cutY },
      { x: inset, y: depthMm },
      { x: 0, y: depthMm },
    ],
    openings: [{
      id: 'main-entry',
      label: 'Main entrance',
      kind: 'door',
      wall: 'top',
      segmentIndex: 0,
      offsetMm: Math.max(0, Math.round(widthMm / 2) - 450),
      widthMm: 900,
      flow: 'entry',
      swingDepthMm: 900,
    }],
    pillars: [],
    storageZones: [],
    locked: false,
  }
}

const defaultScenario = (): SimulationScenario => ({
  id: 'dinner-peak',
  name: 'Dinner peak',
  covers: 45,
  durationMinutes: 60,
  arrivalPattern: 'seating-wave',
  cookToOrderRatio: 0.85,
  seed: 20260902,
  staff: [
    { role: 'head-chef', count: 1 },
    { role: 'sous-chef', count: 1 },
    { role: 'cdp', count: 2 },
    { role: 'busser-washer', count: 1 },
  ],
  checks: { collisions: true, doorSwings: true, dirtyCleanCrossings: true },
})

export function createBlankProject(name = 'Kitchen 1'): KitchenProject {
  const architecture = rectangularArchitecture(6200, 4800)
  const variant: LayoutVariant = {
    id: 'layout-a',
    name: 'Layout A',
    architecture: structuredClone(architecture),
    equipment: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }
  return {
    schemaVersion: 4,
    id: `kitchen-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    name,
    displayUnit: 'mm',
    snapMm: 100,
    architecture: structuredClone(architecture),
    variants: [variant],
    scenarios: [defaultScenario()],
    activeVariantId: variant.id,
    activeScenarioId: 'dinner-peak',
  }
}
