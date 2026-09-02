import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { KitchenProject, LayoutVariant } from '../../domain/project'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { LayoutVariants, type ClosedLayout } from './LayoutVariants'

function projectWithLayouts(activeVariantId = 'layout-b'): KitchenProject {
  const project = createSeedProject()
  const source = project.variants[0]
  const layout = (id: string, name: string): LayoutVariant => ({ ...structuredClone(source), id, name })
  project.variants = [layout('layout-a', 'Layout A'), layout('layout-b', 'Layout B'), layout('layout-c', 'Layout C')]
  project.activeVariantId = activeVariantId
  project.architecture = structuredClone(project.variants.find((variant) => variant.id === activeVariantId)!.architecture)
  return project
}

describe('layout variant tabs', () => {
  it('renders an accessible tablist with a roving active tab', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts())
    render(<LayoutVariants store={store} />)

    const tablist = screen.getByRole('tablist', { name: 'Layout variants' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute('tabindex', '-1')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('tabindex', '0')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')

    await user.click(tabs[2])
    expect(store.getState().project.activeVariantId).toBe('layout-c')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('moves focus and activation with arrows, Home, and End', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts('layout-a'))
    render(<LayoutVariants store={store} />)
    const tab = (name: string) => screen.getByRole('tab', { name })

    tab('Layout A').focus()
    await user.keyboard('{ArrowRight}')
    expect(tab('Layout B')).toHaveFocus()
    expect(store.getState().project.activeVariantId).toBe('layout-b')

    await user.keyboard('{End}')
    expect(tab('Layout C')).toHaveFocus()
    expect(store.getState().project.activeVariantId).toBe('layout-c')

    await user.keyboard('{ArrowRight}')
    expect(tab('Layout A')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Layout A')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(tab('Layout C')).toHaveFocus()
  })

  it('renames inline on double click and supports keyboard commit or cancel', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts())
    render(<LayoutVariants store={store} />)

    await user.dblClick(screen.getByRole('tab', { name: 'Layout B' }))
    const rename = screen.getByRole('textbox', { name: 'Rename Layout B' })
    await user.clear(rename)
    await user.type(rename, 'Fast service{Enter}')
    expect(store.getState().project.variants.find((variant) => variant.id === 'layout-b')?.name).toBe('Fast service')
    expect(screen.getByRole('tab', { name: 'Fast service' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{F2}')
    const cancel = screen.getByRole('textbox', { name: 'Rename Fast service' })
    await user.clear(cancel)
    await user.type(cancel, 'Discard me{Escape}')
    expect(store.getState().project.variants.find((variant) => variant.id === 'layout-b')?.name).toBe('Fast service')
  })

  it('closes without confirmation, activates the nearest survivor, and reports an undo hook', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts())
    const onClosed = vi.fn<(closed: ClosedLayout) => void>()
    render(<LayoutVariants store={store} onClosed={onClosed} />)

    await user.click(screen.getByRole('button', { name: 'Close Layout B' }))

    expect(store.getState().project.variants.map((variant) => variant.id)).toEqual(['layout-a', 'layout-c'])
    expect(store.getState().project.activeVariantId).toBe('layout-c')
    expect(screen.getByRole('tab', { name: 'Layout C' })).toHaveFocus()
    expect(onClosed).toHaveBeenCalledOnce()
    expect(onClosed.mock.calls[0][0]).toMatchObject({ id: 'layout-b', name: 'Layout B' })

    expect(onClosed.mock.calls[0][0].undo()).toBe(true)
    expect(store.getState().project.variants.map((variant) => variant.id)).toEqual(['layout-a', 'layout-b', 'layout-c'])
    expect(store.getState().project.activeVariantId).toBe('layout-b')
  })

  it('activates the nearest survivor when closing an inactive tab', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts('layout-a'))
    render(<LayoutVariants store={store} />)

    await user.click(screen.getByRole('button', { name: 'Close Layout C' }))

    expect(store.getState().project.variants.map((variant) => variant.id)).toEqual(['layout-a', 'layout-b'])
    expect(store.getState().project.activeVariantId).toBe('layout-b')
    expect(store.getState().past).toHaveLength(1)
  })

  it('refuses close Undo after an intervening workspace revision', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(projectWithLayouts())
    const onClosed = vi.fn<(closed: ClosedLayout) => void>()
    render(<LayoutVariants store={store} onClosed={onClosed} />)

    await user.click(screen.getByRole('button', { name: 'Close Layout B' }))
    store.getState().renameVariant('layout-c', 'Edited after close')

    expect(onClosed.mock.calls[0][0].undo()).toBe(false)
    expect(store.getState().project.variants.map((variant) => variant.id)).toEqual(['layout-a', 'layout-c'])
    expect(store.getState().project.variants.find((variant) => variant.id === 'layout-c')?.name).toBe('Edited after close')
  })

  it('protects the last layout and delegates the plus action when supplied', async () => {
    const user = userEvent.setup()
    const project = projectWithLayouts('layout-a')
    project.variants = [project.variants[0]]
    const store = createProjectStore(project)
    const onAdd = vi.fn()
    render(<LayoutVariants store={store} onAdd={onAdd} />)

    expect(screen.getByRole('button', { name: 'Close Layout A' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'New variant' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(store.getState().project.variants).toHaveLength(1)
  })

  it('creates and activates a temporary variant when no plus callback is supplied', async () => {
    const user = userEvent.setup()
    const project = projectWithLayouts('layout-a')
    project.variants = [project.variants[0]]
    const store = createProjectStore(project)
    render(<LayoutVariants store={store} />)

    await user.click(screen.getByRole('button', { name: 'New variant' }))

    expect(store.getState().project.variants).toHaveLength(2)
    expect(store.getState().project.activeVariantId).not.toBe('layout-a')
    expect(screen.getByRole('tab', { name: 'Layout option 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Layout option 2' })).toHaveFocus()
  })
})
