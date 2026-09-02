import { describe, expect, it } from 'vitest'
import { WORKSPACE_OPERATION_TYPES, workspaceOperationSchema } from './workspace-operation'

const acceptedOperations: unknown[] = [
  { type: 'create_layout', variantId: 'variant-b', name: 'Option B', parentVariantId: 'baseline', equipmentMode: 'duplicate' },
  { type: 'activate_layout', variantId: 'variant-b' },
  { type: 'rename_layout', variantId: 'variant-b', name: 'Fast service' },
  { type: 'remove_layout', variantId: 'variant-b' },
  { type: 'add_component', variantId: 'variant-b', componentId: 'range-2', catalogId: 'range-six', position: { xMm: 1200, yMm: 900 }, dimensions: { widthMm: 1200, depthMm: 900, heightMm: 900 }, rotationDeg: 90, configurationId: 'hot-range-six', skinId: 'stainless-clean' },
  { type: 'add_custom_component', variantId: 'variant-b', componentId: 'custom-1', label: 'Rice warmer', position: { xMm: 900, yMm: 2100 }, dimensions: { widthMm: 600, depthMm: 600, heightMm: 850 }, capabilities: ['hot-hold'] },
  { type: 'configure_component', variantId: 'variant-b', componentId: 'range-2', configurationId: 'hot-range-four' },
  { type: 'skin_component', variantId: 'variant-b', componentId: 'range-2', skinId: 'stainless-worn' },
  { type: 'update_component', variantId: 'variant-b', componentId: 'range-2', patch: { label: 'Main range', category: 'cooking', heightMm: 950, capabilities: ['range-cook'], clearance: { frontMm: 1000, kind: 'heat' } } },
  { type: 'move_components', variantId: 'variant-b', componentIds: ['range-2', 'prep-1'], anchor: { xMm: 1400, yMm: 1000 } },
  { type: 'nudge_components', variantId: 'variant-b', componentIds: ['range-2'], delta: { xMm: 100, yMm: 0 } },
  { type: 'rotate_components', variantId: 'variant-b', componentIds: ['range-2'], deltaDeg: -90 },
  { type: 'resize_component', variantId: 'variant-b', componentId: 'range-2', dimensions: { widthMm: 800, depthMm: 900 } },
  { type: 'set_component_dimensions_lock', variantId: 'variant-b', componentId: 'range-2', locked: true },
  { type: 'duplicate_components', variantId: 'variant-b', components: [{ componentId: 'range-2', duplicateId: 'range-3' }], offset: { xMm: 100, yMm: 100 } },
  { type: 'lock_components', variantId: 'variant-b', componentIds: ['range-2'], locked: true },
  { type: 'remove_components', variantId: 'variant-b', componentIds: ['range-2'] },
  { type: 'update_architecture', variantId: 'variant-b', patch: { widthMm: 5000, roomPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }, { xMm: 5000, yMm: 6000 }], openings: [{ id: 'entry', label: 'Staff entry', kind: 'door', wall: 'left', offsetMm: 1000, widthMm: 900, flow: 'entry', swingDepthMm: 900 }], pillars: [{ id: 'pillar-1', xMm: 2200, yMm: 2000, widthMm: 400, depthMm: 400 }], storageZones: [{ id: 'dry-store', label: 'Dry store', xMm: 0, yMm: 0, widthMm: 1800, depthMm: 800, adjacent: true }] } },
  { type: 'update_workspace_settings', variantId: 'variant-b', patch: { displayUnit: 'cm', snapMm: 50 } },
  { type: 'update_scenario', variantId: 'variant-b', scenarioId: 'dinner', patch: { covers: 80, arrivalPattern: 'two-waves', staff: [{ role: 'head-chef', count: 1 }, { role: 'cdp', count: 3 }], checks: { collisions: true, doorSwings: true, dirtyCleanCrossings: true }, taskDurations: { 'food-prep': { minSeconds: 30, maxSeconds: 90 } }, stationCapacities: { 'range-2': 2 } } },
  { type: 'adopt_auto_layout_result', variantId: 'variant-b', runId: 'run-1', resultId: 'fastest', newVariantId: 'variant-fastest', name: 'Fastest service' },
]

describe('workspace operation schema', () => {
  it('accepts every approved friendly operation', () => {
    expect(acceptedOperations.map((operation) => workspaceOperationSchema.parse(operation).type)).toEqual(WORKSPACE_OPERATION_TYPES)
  })

  it.each(acceptedOperations.map((operation) => [(operation as { type: string }).type, operation]))(
    '%s rejects unknown top-level fields',
    (_type, operation) => {
      expect(workspaceOperationSchema.safeParse({ ...(operation as object), unexpected: true }).success).toBe(false)
    },
  )

  it('requires an explicit valid variant ID on every operation', () => {
    for (const operation of acceptedOperations) {
      const withoutVariant = { ...(operation as Record<string, unknown>) }
      delete withoutVariant.variantId
      expect(workspaceOperationSchema.safeParse(withoutVariant).success).toBe(false)
      expect(workspaceOperationSchema.safeParse({ ...operation as object, variantId: 'bad id/with spaces' }).success).toBe(false)
    }
  })

  it('rejects malformed IDs, dimensions, and empty component sets', () => {
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[4] as object, componentId: '' }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[4] as object, dimensions: { widthMm: -1, depthMm: 900 } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[12] as object, dimensions: { widthMm: Number.NaN, depthMm: 900 } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[8] as object, componentIds: [] }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[14] as object, components: [{ componentId: 'range-2', duplicateId: 'not valid' }] }).success).toBe(false)
  })

  it('rejects unknown fields inside every controlled nested patch', () => {
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[4] as object, position: { xMm: 1, yMm: 2, zMm: 3 } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ ...acceptedOperations[5] as object, dimensions: { widthMm: 600, depthMm: 600, watts: 1000 } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ type: 'update_architecture', variantId: 'variant-b', patch: { openings: [{ id: 'entry', label: 'Entry', kind: 'door', wall: 'left', offsetMm: 0, widthMm: 900, secret: true }] } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ type: 'update_scenario', variantId: 'variant-b', scenarioId: 'dinner', patch: { checks: { collisions: true, doorSwings: true, dirtyCleanCrossings: true, certify: true } } }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ type: 'update_scenario', variantId: 'variant-b', scenarioId: 'dinner', patch: { taskDurations: { 'food-prep': { minSeconds: 90, maxSeconds: 30 } } } }).success).toBe(false)
  })

  it('rejects empty patches and unknown operation kinds', () => {
    expect(workspaceOperationSchema.safeParse({ type: 'update_architecture', variantId: 'variant-b', patch: {} }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ type: 'update_scenario', variantId: 'variant-b', scenarioId: 'dinner', patch: {} }).success).toBe(false)
    expect(workspaceOperationSchema.safeParse({ type: 'overwrite_project', variantId: 'variant-b' }).success).toBe(false)
  })
})
