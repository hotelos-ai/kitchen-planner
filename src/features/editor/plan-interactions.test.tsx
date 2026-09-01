import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { getActiveItem, projectStore } from '../../state/project-store'
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

  it('creates and switches to an isolated layout variant', async () => {
    const user = userEvent.setup()
    render(<PlanWorkspace showCanvas={false} />)
    await user.click(screen.getByRole('button', { name: /New variant/i }))
    expect(screen.getByLabelText(/Active layout variant/i)).toHaveDisplayValue('Layout option 2')
    expect(projectStore.getState().project.variants).toHaveLength(2)
  })
})
