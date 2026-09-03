import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem, projectStore } from '../../state/project-store'
import { PlanWorkspace } from './PlanWorkspace'

const workspace = (props: Partial<ComponentProps<typeof PlanWorkspace>> = {}) => (
  <PlanWorkspace showCanvas={false} includeToolbar {...props} />
)

async function selectPlacedItem(user: ReturnType<typeof userEvent.setup>, pattern: RegExp) {
  await user.click(screen.getByRole('tab', { name: /Placed/i }))
  await user.click(screen.getByRole('button', { name: pattern }))
}

describe('plan workspace', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))
  afterEach(() => vi.unstubAllGlobals())

  it('selects an item and exposes editable dimensions in the inspector', async () => {
    const user = userEvent.setup()
    render(workspace())
    await selectPlacedItem(user, /Select Tandoor, 700 mm by 700 mm/i)
    expect(screen.getByRole('textbox', { name: /Equipment label/i })).toHaveValue('Tandoor')
    expect(screen.getByLabelText(/Lock dimensions/i)).not.toBeChecked()
    expect(screen.getByLabelText(/^Width/i)).toBeEnabled()
  })

  it('changes dimensions without changing units internally', async () => {
    const user = userEvent.setup()
    render(workspace())
    await selectPlacedItem(user, /Select Tandoor/i)
    const width = screen.getByLabelText(/^Width/i)
    await user.clear(width)
    await user.type(width, '750')
    await user.tab()
    expect(getActiveItem(projectStore.getState(), 'tandoor').widthMm).toBe(750)
    expect(screen.getByLabelText(/Height/i)).not.toBeDisabled()
    await act(async () => { projectStore.getState().clearSelection() })
    await screen.findByLabelText(/Display units/i)
    await user.selectOptions(screen.getByLabelText(/Display units/i), 'ft')
    await user.selectOptions(screen.getByLabelText(/Display units/i), 'mm')
    expect(getActiveItem(projectStore.getState(), 'tandoor').widthMm).toBe(750)
  })

  it('rotates the selected item left and right with explicit controls', async () => {
    const user = userEvent.setup()
    render(workspace())
    await selectPlacedItem(user, /Select Tandoor/i)

    await user.click(screen.getByRole('button', { name: /Rotate selected left/i }))
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(270)

    await user.click(screen.getByRole('button', { name: /Rotate selected right/i }))
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(0)
  })

  it('enables drag resize on selection and keeps inspector dimensions synchronized', async () => {
    const user = userEvent.setup()
    render(workspace())
    await selectPlacedItem(user, /Select Tandoor/i)
    expect(screen.getByRole('button', { name: /Disable drag resize/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/Lock dimensions/i)).not.toBeChecked()

    act(() => projectStore.getState().updateItem('tandoor', { widthMm: 900, depthMm: 800 }))
    expect(screen.getByLabelText(/^Width/i)).toHaveValue('900')
    expect(screen.getByLabelText(/^Depth/i)).toHaveValue('800')
  })

  it('adds, duplicates, removes, and restores a custom item', async () => {
    const user = userEvent.setup()
    render(workspace())
    await user.click(screen.getByRole('button', { name: /Add custom item/i }))
    await user.clear(screen.getByLabelText(/New item label/i))
    await user.type(screen.getByLabelText(/New item label/i), 'Rice warmer')
    await user.click(screen.getByRole('button', { name: /^Add to plan$/i }))
    await user.click(screen.getByRole('button', { name: /Duplicate selected item/i }))
    expect(screen.getByDisplayValue('Rice warmer copy')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Remove selected item/i }))
    expect(screen.getByRole('button', { name: /Confirm remove selected item/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Confirm remove selected item/i }))
    await user.click(screen.getByRole('button', { name: /Undo/i }))
    await user.click(screen.getByRole('tab', { name: /Placed/i }))
    expect(screen.getByRole('button', { name: /Select Rice warmer copy/i })).toBeInTheDocument()
  })

  it('duplicates the complete multi-selection in one workspace revision', () => {
    const store = createProjectStore(createSeedProject())
    const before = store.getState().project.variants[0].equipment
    const sourceIds = before.slice(0, 2).map((item) => item.id)
    store.getState().selectItems(sourceIds)
    render(workspace({ store }))

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })

    const state = store.getState()
    expect(state.project.variants[0].equipment).toHaveLength(before.length + 2)
    expect(state.selectedIds).toHaveLength(2)
    expect(state.selectedIds).not.toEqual(sourceIds)
    expect(state.past).toHaveLength(1)
    expect(state.revision).toBe(1)
  })

  it('opens the layout wizard and atomically switches to its new variant', async () => {
    const user = userEvent.setup()
    render(workspace())
    await user.click(screen.getByRole('button', { name: /^Layout A actions$/i }))
    await user.click(screen.getByRole('menuitem', { name: 'New layout from wizard' }))
    expect(screen.getByRole('dialog', { name: 'Starting point' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Create layout' }))
    expect(screen.getByLabelText(/Active layout variant/i)).toHaveDisplayValue('Layout option 2')
    expect(projectStore.getState().project.variants).toHaveLength(2)
    expect(projectStore.getState().past).toHaveLength(1)
  })

  it('collapses overlay drawers without remounting the active canvas host', async () => {
    const user = userEvent.setup()
    const { container } = render(workspace())
    const canvasHost = container.querySelector('.canvas-column')
    const catalogDrawer = container.querySelector('[data-editor-drawer="catalog"]')
    const inspectorDrawer = container.querySelector('[data-editor-drawer="inspector"]')

    expect(canvasHost).not.toBeNull()
    expect(catalogDrawer).toHaveAttribute('aria-hidden', 'false')
    expect(inspectorDrawer).toHaveAttribute('aria-hidden', 'false')

    await user.click(screen.getByRole('button', { name: 'Toggle equipment catalog' }))
    await user.click(screen.getByRole('button', { name: 'Toggle inspector' }))

    expect(container.querySelector('.canvas-column')).toBe(canvasHost)
    expect(catalogDrawer).toHaveAttribute('aria-hidden', 'true')
    expect(inspectorDrawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('starts narrow overlay drawers closed while retaining desktop-open defaults', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const { container } = render(workspace())

    expect(screen.getByRole('button', { name: 'Toggle equipment catalog' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Toggle inspector' })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('[data-editor-drawer="catalog"]')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[data-editor-drawer="inspector"]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('opens operational essentials from the workspace toolbar', async () => {
    const user = userEvent.setup()
    render(workspace())

    await user.click(screen.getByRole('button', { name: /Check essentials/i }))
    expect(screen.getByRole('dialog', { name: 'Check essentials' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Professional review' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close essentials checker' }))
    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
  })

  it('uses Escape to close transient workspace UI before clearing selection', async () => {
    const user = userEvent.setup()
    render(workspace())
    await selectPlacedItem(user, /Select Tandoor/i)
    await user.click(screen.getByRole('button', { name: /Check essentials/i }))
    ;(document.activeElement as HTMLElement).blur()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
    expect(projectStore.getState().selectedIds).toEqual(['tandoor'])
  })

  it('routes architecture essentials directly to advanced room editing', async () => {
    const user = userEvent.setup()
    const project = createSeedProject()
    project.variants[0].architecture.openings = project.variants[0].architecture.openings.filter((opening) => opening.flow !== 'entry')
    project.architecture = structuredClone(project.variants[0].architecture)
    render(workspace({ store: createProjectStore(project) }))

    await user.click(screen.getByRole('button', { name: /Check essentials/i }))
    await user.click(screen.getByRole('button', { name: /Edit room.*dedicated staff entry/i }))

    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Room' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Advanced room geometry' })).toBeInTheDocument()
  })
})
