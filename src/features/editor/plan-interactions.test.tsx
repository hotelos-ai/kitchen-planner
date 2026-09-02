import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveItem, projectStore } from '../../state/project-store'
import { PlanWorkspace } from './PlanWorkspace'

describe('plan workspace', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))

  it('selects an item and exposes editable dimensions in the inspector', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /Select Tandoor, 700 mm by 700 mm/i }))
    expect(screen.getByRole('textbox', { name: /Equipment label/i })).toHaveValue('Tandoor')
    expect(screen.getByLabelText(/Lock dimensions/i)).toBeChecked()
    expect(screen.getByLabelText(/^Width/i)).toBeDisabled()
  })

  it('unlocks and changes dimensions without changing units internally', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /Select Tandoor/i }))
    await user.click(screen.getByLabelText(/Lock dimensions/i))
    const width = screen.getByLabelText(/^Width/i)
    await user.clear(width)
    await user.type(width, '750')
    await user.tab()
    expect(getActiveItem(projectStore.getState(), 'tandoor').widthMm).toBe(750)
    expect(screen.getByLabelText(/Height/i)).not.toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Display units/i), 'ft')
    await user.selectOptions(screen.getByLabelText(/Display units/i), 'mm')
    expect(getActiveItem(projectStore.getState(), 'tandoor').widthMm).toBe(750)
  })

  it('rotates the selected item left and right with explicit controls', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /Select Tandoor/i }))

    await user.click(screen.getByRole('button', { name: /Rotate selected left/i }))
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(270)

    await user.click(screen.getByRole('button', { name: /Rotate selected right/i }))
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(0)
  })

  it('enables drag resize and keeps inspector dimensions synchronized', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /Select Tandoor/i }))
    await user.click(screen.getByRole('button', { name: /Enable drag resize/i }))
    expect(screen.getByLabelText(/Lock dimensions/i)).not.toBeChecked()

    act(() => projectStore.getState().updateItem('tandoor', { widthMm: 900, depthMm: 800 }))
    expect(screen.getByLabelText(/^Width/i)).toHaveValue('900')
    expect(screen.getByLabelText(/^Depth/i)).toHaveValue('800')
  })

  it('adds, duplicates, removes, and restores a custom item', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
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
    expect(screen.getByRole('button', { name: /Select Rice warmer copy/i })).toBeInTheDocument()
  })

  it('opens the layout wizard and atomically switches to its new variant', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /New variant/i }))
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
    const { container } = render(<PlanWorkspace showCanvas={false} />)
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

  it('opens operational essentials from the workspace toolbar', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)

    await user.click(screen.getByRole('button', { name: 'Check essentials' }))
    expect(screen.getByRole('dialog', { name: 'Check essentials' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Professional review' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close essentials checker' }))
    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
  })

  it('uses Escape to close transient workspace UI before clearing selection', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /Select Tandoor/i }))
    await user.click(screen.getByRole('button', { name: 'Check essentials' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
    expect(projectStore.getState().selectedIds).toEqual(['tandoor'])
  })

  it('routes architecture essentials directly to advanced room editing', async () => {
    const user = userEvent.setup()
    const project = createSeedProject()
    project.variants[0].architecture.openings = project.variants[0].architecture.openings.filter((opening) => opening.flow !== 'entry')
    project.architecture = structuredClone(project.variants[0].architecture)
    render(<PlanWorkspace store={createProjectStore(project)} showCanvas={false} />)

    await user.click(screen.getByRole('button', { name: 'Check essentials' }))
    await user.click(screen.getByRole('button', { name: /Edit room.*dedicated staff entry/i }))

    expect(screen.queryByRole('dialog', { name: 'Check essentials' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Room' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Advanced room geometry' })).toBeInTheDocument()
  })
})
