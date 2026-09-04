import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem } from '../../state/project-store'
import { CATALOG_DRAG_MIME } from '../../domain/catalog/catalog-drag'
import { createCatalogEquipmentItem } from '../../domain/catalog/kitchen-catalog'
import type { EquipmentItem } from '../../domain/project'

type LayerHarnessProps = {
  items: EquipmentItem[]
  onQuickConfigure(id: string, position: { x: number; y: number }): void
  onOpenContextMenu(id: string, position: { x: number; y: number }): void
}

type RoomOutlineHarnessProps = {
  editRoomOutline: boolean
  onSelectItem(selection: { kind: 'opening'; id: string }): void
}

vi.mock('react-konva', () => ({ Stage: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('./ArchitectureLayer', () => ({ ArchitectureLayer: () => null }))
vi.mock('./GridLayer', () => ({ GridLayer: () => null }))
vi.mock('./OpeningOverlayLayer', () => ({ OpeningOverlayLayer: () => null }))
vi.mock('./RoomOutlineLayer', () => ({
  RoomOutlineLayer: (props: RoomOutlineHarnessProps) => (
    <button type="button" onClick={() => props.onSelectItem({ kind: 'opening', id: 'd2' })}>
      {props.editRoomOutline ? 'Select door while editing room' : 'Select door from plan'}
    </button>
  ),
}))
vi.mock('./EquipmentNode', () => ({
  EquipmentLayer: (props: LayerHarnessProps) => {
    const targetId = props.items.find((item) => item.id === 'ss-shelf')?.id ?? 'tandoor'
    return <div>
      <button type="button" onClick={() => props.onQuickConfigure(targetId, { x: 100, y: 120 })}>Open quick configuration</button>
      <button type="button" onClick={() => props.onOpenContextMenu(targetId, { x: 200, y: 220 })}>Open component menu</button>
    </div>
  },
}))

import { PlanCanvas } from './PlanCanvas'

describe('PlanCanvas component gestures', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  }))

  it('opens quick configuration and maps context actions to store and host callbacks', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    const onInspectComponentIn3D = vi.fn()
    const onComponentLockChange = vi.fn()
    const onSkinChange = vi.fn()
    render(<PlanCanvas store={store} showReference={false} onInspectComponentIn3D={onInspectComponentIn3D} onComponentLockChange={onComponentLockChange} onSkinChange={onSkinChange} />)

    await user.click(screen.getByRole('button', { name: 'Open quick configuration' }))
    expect(screen.getByRole('dialog', { name: /Quick configure Tandoor/i })).toBeInTheDocument()
    expect(store.getState().selectedIds).toEqual(['tandoor'])
    await user.click(screen.getByRole('button', { name: 'Close quick configuration' }))

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rotate left' }))
    expect(getActiveItem(store.getState(), 'tandoor').rotationDeg).toBe(270)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rotate right' }))
    expect(getActiveItem(store.getState(), 'tandoor').rotationDeg).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Lock' }))
    expect(onComponentLockChange).toHaveBeenCalledWith('tandoor', true)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Inspect in 3D' }))
    expect(onInspectComponentIn3D).toHaveBeenCalledWith('tandoor')

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Skin' }))
    await user.selectOptions(screen.getByLabelText('Appearance skin'), 'stainless-polished')
    await user.click(screen.getByRole('button', { name: 'Apply skin' }))
    expect(onSkinChange).toHaveBeenCalledWith('tandoor', 'stainless-polished')

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(store.getState().project.variants[0].equipment).toHaveLength(createSeedProject().variants[0].equipment.length + 1)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Configure' }))
    expect(screen.getByRole('dialog', { name: /Quick configure Tandoor/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close quick configuration' }))

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }))
    expect(store.getState().project.variants[0].equipment.some((item) => item.id === 'tandoor')).toBe(false)
  })

  it('turns a catalog drop into a preferred-point public catalog add', () => {
    const project = createSeedProject()
    project.variants[0].equipment = []
    const store = createProjectStore(project)
    const addCatalogItem = vi.spyOn(store.getState(), 'addCatalogItem')
    render(<PlanCanvas store={store} showReference={false} />)
    const getData = vi.fn((type: string) => type === CATALOG_DRAG_MIME ? JSON.stringify({
      catalogId: 'prep-work-table',
      dimensions: { widthMm: 1500, depthMm: 700, heightMm: 850 },
      placement: 'preferred-point',
    }) : '')

    fireEvent.drop(screen.getByTestId('plan-canvas'), {
      clientX: 300,
      clientY: 220,
      dataTransfer: { getData },
    })

    expect(getData).toHaveBeenCalledWith(CATALOG_DRAG_MIME)
    expect(addCatalogItem).toHaveBeenCalledWith('prep-work-table', expect.objectContaining({ xMm: expect.any(Number), yMm: expect.any(Number) }))
    expect(addCatalogItem.mock.results[0]?.value).not.toBeNull()
    expect(store.getState().project.variants[0].equipment).toHaveLength(1)
    expect(store.getState().project.variants[0].equipment[0]).toMatchObject({ catalogId: 'prep-work-table' })
    expect(store.getState().selectedIds).toHaveLength(1)
  })

  it('saves a shelf configuration selected from the right-click menu', async () => {
    const user = userEvent.setup()
    const project = createSeedProject()
    project.variants[0].equipment = [createCatalogEquipmentItem({
      catalogId: 'storage-wall-shelf',
      componentId: 'ss-shelf',
      configurationId: 'wall-shelf-one-tier',
      position: { xMm: 500, yMm: 0 },
    })]
    const store = createProjectStore(project)
    render(<PlanCanvas store={store} showReference={false} />)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Configure' }))
    await user.selectOptions(screen.getByLabelText('Equipment configuration'), 'wall-shelf-three-tier')

    expect(getActiveItem(store.getState(), 'ss-shelf').configurationPreset).toBe('wall-shelf-three-tier')
    expect(screen.queryByRole('dialog', { name: /Quick configure/i })).not.toBeInTheDocument()
  })

  it('keeps door interaction enabled in the layout plan', async () => {
    const user = userEvent.setup()
    const onSelectItem = vi.fn()
    render(<PlanCanvas store={createProjectStore(createSeedProject())} showReference={false} onSelectItem={onSelectItem} />)

    await user.click(screen.getByRole('button', { name: 'Select door from plan' }))

    expect(onSelectItem).toHaveBeenCalledWith({ kind: 'opening', id: 'd2' })
  })
})
