import type {
  Architecture,
  EquipmentCategory,
  EquipmentItem,
  KitchenProject,
  StationCapability,
} from './project'
import { CONFIGURATION_BY_SEED_ID } from './equipment-configurations'

const CREATED_AT = '2026-08-31T00:00:00.000Z'

type EquipmentOptions = {
  heightMm?: number
  capabilities?: StationCapability[]
  approximate?: boolean
  rotationDeg?: number
  clearanceFrontMm?: number
  notes?: string
  visualPreset?: string
  configurationPreset?: string
}

function equipment(
  id: string,
  label: string,
  category: EquipmentCategory,
  widthMm: number,
  depthMm: number,
  xMm: number,
  yMm: number,
  options: EquipmentOptions = {},
): EquipmentItem {
  return {
    id,
    label,
    category,
    widthMm,
    depthMm,
    heightMm: options.heightMm ?? (category === 'cooking' ? 900 : 850),
    xMm,
    yMm,
    rotationDeg: options.rotationDeg ?? 0,
    dimensionsLocked: false,
    movable: true,
    removable: true,
    capabilities: options.capabilities ?? [],
    approximate: options.approximate,
    notes: options.notes,
    visualPreset: options.visualPreset,
    configurationPreset: options.configurationPreset ?? CONFIGURATION_BY_SEED_ID[id],
    appearanceSkinId: `${options.visualPreset ?? 'generic'}-default`,
    clearance: options.clearanceFrontMm === undefined ? undefined : {
      frontMm: options.clearanceFrontMm,
      kind: category === 'cooking' ? 'heat' : 'work',
    },
  }
}

export function createSeedProject(): KitchenProject {
  const equipmentItems: EquipmentItem[] = [
    equipment('flat-top-fryer', 'Flat-top + fryer', 'cooking', 1200, 700, 0, 900, {
      visualPreset: 'flat-top-fryer',
      capabilities: ['flat-top-cook', 'fryer-cook'], clearanceFrontMm: 1000,
      notes: 'Equipment stand with storage below.',
    }),
    equipment('six-burner', '6-burner range', 'cooking', 1200, 900, 1200, 900, {
      visualPreset: 'six-burner-range',
      capabilities: ['range-cook'], clearanceFrontMm: 1100,
    }),
    equipment('tandoor', 'Tandoor', 'cooking', 700, 700, 2400, 900, {
      visualPreset: 'tandoor',
      heightMm: 900, capabilities: ['tandoor-cook'], clearanceFrontMm: 1000,
      notes: 'Confirmed directly against the shaded pillar.',
    }),
    equipment('upright-freezer', 'Upright freezer', 'cold', 700, 800, 2800, 0, {
      visualPreset: 'upright-freezer',
      heightMm: 1950, capabilities: ['cold-retrieval'], clearanceFrontMm: 900,
      notes: 'Faces the adjacent storage area.',
    }),
    equipment('fridge-clean-prep', 'Fridge + clean prep', 'cold', 1200, 700, 2700, 1700, {
      visualPreset: 'prep-fridge',
      capabilities: ['cold-retrieval', 'food-prep', 'finish-plate'], clearanceFrontMm: 900,
    }),
    equipment('prep-fridge-counter', 'Prep fridge + counter', 'cold', 1200, 700, 2700, 2600, {
      visualPreset: 'prep-fridge',
      capabilities: ['cold-retrieval', 'food-prep'], clearanceFrontMm: 900,
    }),
    equipment('mixer', 'Mixer', 'prep', 650, 650, 1950, 1800, {
      visualPreset: 'mixer',
      heightMm: 700, capabilities: ['mix'], approximate: true, clearanceFrontMm: 700,
    }),
    equipment('working-table', 'Working table', 'prep', 700, 700, 1950, 2700, {
      visualPreset: 'open-table',
      capabilities: ['food-prep', 'finish-plate'], approximate: true, clearanceFrontMm: 800,
    }),
    equipment('double-sink', 'Double sink', 'washing', 1200, 700, 0, 2500, {
      visualPreset: 'double-sink',
      capabilities: ['dish-pre-rinse'], clearanceFrontMm: 900,
    }),
    equipment('two-door-fridge', '2-door fridge', 'cold', 1400, 850, 0, 4300, {
      visualPreset: 'two-door-fridge',
      heightMm: 1000, capabilities: ['cold-retrieval'], approximate: true, clearanceFrontMm: 1100,
      notes: 'Source dimension requires confirmation; door-swing layer is enabled.',
    }),
    equipment('dirty-landing', 'Dirty landing', 'landing', 900, 700, 1100, 5200, {
      visualPreset: 'landing-table',
      capabilities: ['dirty-window', 'dirty-landing'], approximate: true, clearanceFrontMm: 800,
    }),
    equipment('pre-rinse-sink', 'Pre-rinse sink', 'washing', 700, 700, 2000, 5200, {
      visualPreset: 'pre-rinse-sink',
      capabilities: ['dish-pre-rinse'], clearanceFrontMm: 800,
    }),
    equipment('dishwasher', 'Dishwasher', 'washing', 700, 750, 2700, 5200, {
      visualPreset: 'dishwasher',
      capabilities: ['dish-wash'], clearanceFrontMm: 900,
    }),
    equipment('clean-landing', 'Clean landing', 'landing', 700, 700, 3200, 4300, {
      visualPreset: 'landing-table',
      capabilities: ['clean-landing'], clearanceFrontMm: 800,
    }),
    equipment('handwash', 'Handwash sink', 'washing', 400, 400, 0, 5700, {
      visualPreset: 'handwash-sink',
      heightMm: 850, capabilities: ['hand-wash'], approximate: true, clearanceFrontMm: 600,
    }),
    equipment('hot-line-hood', 'Hot-line hood', 'hood', 3500, 1100, 0, 700, {
      visualPreset: 'canopy-hood',
      heightMm: 600, approximate: true,
      notes: 'Continuous hood concept; exhaust route and final coverage require professional design.',
    }),
  ]

  const architecture: Architecture = {
    widthMm: 3900,
    depthMm: 6650,
    wallHeightMm: 2800,
    roomPolygon: [
      { x: 0, y: 0 },
      { x: 3900, y: 0 },
      { x: 3900, y: 5700 },
      { x: 3500, y: 5700 },
      { x: 3500, y: 6650 },
      { x: 0, y: 6650 },
    ],
    openings: [
      { id: 'd2', label: 'D2 · staff + receiving', kind: 'door', wall: 'left', offsetMm: 5550, widthMm: 900, flow: 'entry', doorType: 'hinged', swingDepthMm: 900, swingHinge: 'start', swingDirection: 'inward' },
      { id: 'd6', label: 'D6 · permanently closed', kind: 'sealed-opening', wall: 'top', offsetMm: 2450, widthMm: 900, flow: 'closed' },
      { id: 'clean-window', label: 'Clean service window', kind: 'service-window', wall: 'right', offsetMm: 2050, widthMm: 900, sillHeightMm: 950, heightMm: 900, flow: 'clean-out' },
      { id: 'dirty-window', label: 'Dirty service window', kind: 'service-window', wall: 'right', offsetMm: 3850, widthMm: 900, sillHeightMm: 950, heightMm: 900, flow: 'dirty-in' },
    ],
    pillars: [{ id: 'pillar', xMm: 3100, yMm: 900, widthMm: 400, depthMm: 400 }],
    storageZones: [{ id: 'adjacent-storage', label: 'Adjacent storage area', xMm: 0, yMm: 0, widthMm: 2400, depthMm: 800, adjacent: true }],
    locked: true,
  }

  return {
    schemaVersion: 4,
    id: 'kitchen-1',
    name: 'Kitchen 1',
    displayUnit: 'mm',
    snapMm: 100,
    architecture: structuredClone(architecture),
    variants: [{
      id: 'baseline-trace',
      name: 'Layout A',
      architecture: structuredClone(architecture),
      equipment: equipmentItems,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }],
    scenarios: [{
      id: 'dinner-peak',
      name: 'Dinner peak · mostly cooked to order',
      covers: 50,
      durationMinutes: 60,
      arrivalPattern: 'seating-wave',
      cookToOrderRatio: 0.85,
      seed: 20260831,
      staff: [
        { role: 'head-chef', count: 1 },
        { role: 'sous-chef', count: 1 },
        { role: 'cdp', count: 2 },
        { role: 'busser-washer', count: 1 },
      ],
      checks: { collisions: true, doorSwings: true, dirtyCleanCrossings: true },
      taskDurations: {
        'cold-retrieval': { minSeconds: 20, maxSeconds: 45 },
        'food-prep': { minSeconds: 45, maxSeconds: 120 },
        'flat-top-cook': { minSeconds: 180, maxSeconds: 420 },
        'fryer-cook': { minSeconds: 150, maxSeconds: 360 },
        'range-cook': { minSeconds: 180, maxSeconds: 480 },
        'tandoor-cook': { minSeconds: 240, maxSeconds: 540 },
        'finish-plate': { minSeconds: 25, maxSeconds: 60 },
        'clean-window': { minSeconds: 5, maxSeconds: 15 },
        'dirty-window': { minSeconds: 8, maxSeconds: 16 },
        'dirty-landing': { minSeconds: 8, maxSeconds: 20 },
        'dish-pre-rinse': { minSeconds: 25, maxSeconds: 55 },
        'dish-wash': { minSeconds: 55, maxSeconds: 110 },
        'clean-landing': { minSeconds: 12, maxSeconds: 30 },
      },
      stationCapacities: { 'six-burner': 2, 'flat-top-fryer': 2, tandoor: 1, dishwasher: 1 },
    }],
    activeVariantId: 'baseline-trace',
    activeScenarioId: 'dinner-peak',
  }
}
