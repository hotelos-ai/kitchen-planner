import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from './seed-project'
import { createProjectStore } from '../state/project-store'
import {
  buildLayoutWizardOperations,
  submitLayoutWizardDraft,
  type LayoutWizardDraft,
} from './layout-wizard'

const profile = {
  covers: 72,
  peakDurationMinutes: 90,
  arrivalPattern: 'two-waves' as const,
  serviceStyle: 'table service',
  menuAssumptions: ['mostly cooked to order', 'shared starters'],
  staff: [{ role: 'head-chef' as const, count: 1 }, { role: 'cdp' as const, count: 3 }],
  targetCapacityPerHour: 54,
}

const project = createSeedProject()
const context = { project, newVariantId: 'wizard-layout' }

const draft = (values: Pick<LayoutWizardDraft, 'mode'> & Partial<LayoutWizardDraft>): LayoutWizardDraft => ({
  name: 'Wizard layout',
  ...values,
  profile,
} as LayoutWizardDraft)

describe('layout wizard operation builder', () => {
  it('supports duplicating a parent and reusing an existing room with blank equipment', () => {
    expect(buildLayoutWizardOperations(draft({ mode: 'duplicate', sourceVariantId: 'baseline-trace' }), context)).toMatchObject([
      { type: 'create_layout', variantId: 'wizard-layout', parentVariantId: 'baseline-trace', equipmentMode: 'duplicate' },
      { type: 'update_operational_profile', variantId: 'wizard-layout', patch: profile },
      { type: 'activate_layout', variantId: 'wizard-layout' },
    ])
    expect(buildLayoutWizardOperations(draft({ mode: 'blank-existing', sourceVariantId: 'baseline-trace' }), context)).toMatchObject([
      { type: 'create_layout', variantId: 'wizard-layout', parentVariantId: 'baseline-trace', equipmentMode: 'empty' },
      { type: 'update_operational_profile', variantId: 'wizard-layout', patch: profile },
      { type: 'activate_layout', variantId: 'wizard-layout' },
    ])
  })

  it('builds rectangular room geometry before applying the operational profile', () => {
    const operations = buildLayoutWizardOperations(draft({
      mode: 'rectangle',
      sourceVariantId: 'baseline-trace',
      architecture: { widthMm: 6000, depthMm: 4500, wallHeightMm: 3000, roomPolygon: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4500 }, { x: 0, y: 4500 }], openings: [], pillars: [], storageZones: [], locked: false },
    }), context)

    expect(operations.map((operation) => operation.type)).toEqual(['create_layout', 'update_architecture', 'update_operational_profile', 'activate_layout'])
    expect(operations[1]).toEqual({
      type: 'update_architecture',
      variantId: 'wizard-layout',
      patch: {
        widthMm: 6000,
        depthMm: 4500,
        wallHeightMm: 3000,
        roomPolygon: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
          { xMm: 6000, yMm: 4500 },
          { xMm: 0, yMm: 4500 },
        ],
        openings: [],
        pillars: [],
        storageZones: [],
        locked: false,
      },
    })
  })

  it('builds a jagged polygon room with doors, service windows, pillars, and zones', () => {
    const operations = buildLayoutWizardOperations(draft({
      mode: 'polygon',
      sourceVariantId: 'baseline-trace',
      architecture: {
        widthMm: 7000,
        depthMm: 6500,
        wallHeightMm: 3200,
        roomPolygon: [
        { x: 0, y: 0 },
        { x: 7000, y: 0 },
        { x: 7000, y: 5000 },
        { x: 4200, y: 5000 },
        { x: 4200, y: 6500 },
        { x: 0, y: 6500 },
        ],
        openings: [
          { id: 'entry', label: 'Staff entry', kind: 'door', wall: 'left', offsetMm: 800, widthMm: 900, flow: 'entry', swingDepthMm: 900 },
          { id: 'pass', label: 'Clean pass', kind: 'service-window', wall: 'right', offsetMm: 1800, widthMm: 1200, sillHeightMm: 950, heightMm: 900, flow: 'clean-out' },
        ],
        pillars: [{ id: 'pillar-1', xMm: 2800, yMm: 2000, widthMm: 400, depthMm: 400 }],
        storageZones: [{ id: 'dry-store', label: 'Dry store', xMm: 0, yMm: 0, widthMm: 1600, depthMm: 900, adjacent: true }],
        locked: false,
      },
    }), context)

    expect(operations[1]).toMatchObject({
      type: 'update_architecture',
      patch: {
        widthMm: 7000,
        depthMm: 6500,
        openings: [
          { id: 'entry', kind: 'door' },
          { id: 'pass', kind: 'service-window' },
        ],
        pillars: [{ id: 'pillar-1' }],
        storageZones: [{ id: 'dry-store' }],
      },
    })
  })

  it('orders selected essentials after architecture and profile operations', () => {
    const operations = buildLayoutWizardOperations({
      ...draft({ mode: 'rectangle', sourceVariantId: 'baseline-trace', architecture: { widthMm: 5000, depthMm: 4000, wallHeightMm: 2800, roomPolygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], openings: [], pillars: [], storageZones: [], locked: false } }),
      essentialCatalogIds: ['sanitation-hand-sink', 'prep-work-table'],
    }, context)

    expect(operations.map((operation) => operation.type)).toEqual([
      'create_layout',
      'update_architecture',
      'update_operational_profile',
      'add_component',
      'add_component',
      'activate_layout',
    ])
    expect(operations.slice(3, 5)).toMatchObject([
      { variantId: 'wizard-layout', componentId: 'wizard-layout-essential-1', catalogId: 'sanitation-hand-sink', position: { xMm: 500, yMm: 500 } },
      { variantId: 'wizard-layout', componentId: 'wizard-layout-essential-2', catalogId: 'prep-work-table', position: { xMm: 1700, yMm: 500 } },
    ])
  })

  it('submits the complete batch as one revision and one undo checkpoint', () => {
    const store = createProjectStore(createSeedProject())
    const result = submitLayoutWizardDraft({
      ...draft({ mode: 'rectangle', sourceVariantId: 'baseline-trace', architecture: { widthMm: 5000, depthMm: 4000, wallHeightMm: 2800, roomPolygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], openings: [], pillars: [], storageZones: [], locked: false } }),
      essentialCatalogIds: ['sanitation-hand-sink'],
    }, { project: store.getState().project, newVariantId: 'wizard-layout' }, store.getState().applyWorkspaceOperations)

    expect(result).toMatchObject({ ok: true, revision: 1 })
    expect(store.getState()).toMatchObject({ revision: 1 })
    expect(store.getState().project.activeVariantId).toBe('wizard-layout')
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().project.variants.find((variant) => variant.id === 'wizard-layout')).toMatchObject({
      architecture: { widthMm: 5000, depthMm: 4000 },
      operationalProfile: profile,
      equipment: [{ catalogId: 'sanitation-hand-sink' }],
    })
  })

  it('does not build or invoke the public apply function when cancelled', () => {
    const apply = vi.fn()
    expect(submitLayoutWizardDraft(null, context, apply)).toEqual({ ok: false, code: 'wizard-cancelled' })
    expect(apply).not.toHaveBeenCalled()
  })

  it('rejects unknown draft fields before producing public operations', () => {
    expect(() => buildLayoutWizardOperations({ ...draft({ mode: 'duplicate', sourceVariantId: 'baseline-trace' }), certify: true } as unknown as LayoutWizardDraft, context)).toThrow()
  })
})
