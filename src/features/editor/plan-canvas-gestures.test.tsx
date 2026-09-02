import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem } from '../../state/project-store'

type LayerHarnessProps = {
  onQuickConfigure(id: string, position: { x: number; y: number }): void
  onOpenContextMenu(id: string, position: { x: number; y: number }): void
}

vi.mock('react-konva', () => ({ Stage: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('./ArchitectureLayer', () => ({ ArchitectureLayer: () => null }))
vi.mock('./GridLayer', () => ({ GridLayer: () => null }))
vi.mock('./OpeningOverlayLayer', () => ({ OpeningOverlayLayer: () => null }))
vi.mock('./EquipmentNode', () => ({
  EquipmentLayer: (props: LayerHarnessProps) => <div>
    <button type="button" onClick={() => props.onQuickConfigure('tandoor', { x: 100, y: 120 })}>Open quick configuration</button>
    <button type="button" onClick={() => props.onOpenContextMenu('tandoor', { x: 200, y: 220 })}>Open component menu</button>
  </div>,
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
    await user.click(screen.getByRole('menuitem', { name: 'Rotate Left' }))
    expect(getActiveItem(store.getState(), 'tandoor').rotationDeg).toBe(270)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rotate Right' }))
    expect(getActiveItem(store.getState(), 'tandoor').rotationDeg).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Lock' }))
    expect(onComponentLockChange).toHaveBeenCalledWith('tandoor', true)

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Inspect in 3D' }))
    expect(onInspectComponentIn3D).toHaveBeenCalledWith('tandoor')

    await user.click(screen.getByRole('button', { name: 'Open component menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Skin' }))
    await user.clear(screen.getByLabelText('Appearance skin'))
    await user.type(screen.getByLabelText('Appearance skin'), 'stainless-worn')
    await user.click(screen.getByRole('button', { name: 'Apply skin' }))
    expect(onSkinChange).toHaveBeenCalledWith('tandoor', 'stainless-worn')

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
})
