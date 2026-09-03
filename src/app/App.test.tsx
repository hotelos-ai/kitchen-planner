import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { getActiveItem, getVariantItem, projectStore } from '../state/project-store'
import { App } from './App'

describe('App', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))
  it('opens the Kitchen 1 planning workspace', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
    const user = userEvent.setup()
    await screen.findByLabelText('2D plan workspace', {}, { timeout: 5000 })
    const catalog = screen.getByLabelText('Equipment catalog')
    await user.click(within(catalog).getByRole('tab', { name: /Placed/i }))
    expect(await within(catalog).findByRole('button', { name: /Select Tandoor/i })).toBeInTheDocument()
  })

  it('keeps Plan and 3D workspace hosts mounted while switching and splitting', async () => {
    render(<App />)
    const plan = await screen.findByLabelText('2D plan workspace')

    await userEvent.click(screen.getByRole('button', { name: '3D' }))
    const scene = await screen.findByLabelText('3D kitchen workspace')
    expect(plan).toBeInTheDocument()
    expect(plan.closest('[data-workspace-surface]')).toHaveAttribute('aria-hidden', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Split' }))
    expect(screen.getByLabelText('2D plan workspace')).toBe(plan)
    expect(screen.getByLabelText('3D kitchen workspace')).toBe(scene)
    expect(plan.closest('[data-workspace-surface]')).toHaveAttribute('aria-hidden', 'false')
    expect(scene.closest('[data-workspace-surface]')).toHaveAttribute('aria-hidden', 'false')
  })

  it('opens the auto-layout experiment workspace from global actions', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Auto-layout' }))
    expect(await screen.findByLabelText('Auto-layout experiment')).toBeInTheDocument()
    expect(screen.getByText(/best observed feasible layouts/i)).toBeInTheDocument()
  })

  it('toggles Space, Equipment, and Simulate with the numbered steps', async () => {
    render(<App />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '1 Space' }))
    expect(screen.getByRole('button', { name: '1 Space' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('Shared base space')).toBeInTheDocument()
    expect(screen.getByLabelText('Space components catalog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2 Fit-out' }))
    expect(screen.getByRole('button', { name: '2 Fit-out' })).toHaveAttribute('aria-current', 'step')
    expect(await screen.findByLabelText('Equipment catalog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '3 Simulate' }))
    expect(screen.getByRole('button', { name: '3 Simulate' })).toHaveAttribute('aria-current', 'step')
    expect(await screen.findByText(/Pressure-test this layout/i)).toBeInTheDocument()
  })

  it('switches workflow stages with the 1 2 3 keys', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: '1' })
    expect(screen.getByRole('button', { name: '1 Space' })).toHaveAttribute('aria-current', 'step')
    fireEvent.keyDown(window, { key: '3' })
    expect(await screen.findByText(/Pressure-test this layout/i)).toBeInTheDocument()
  })

  it('enables Plan editing shortcuts in 3D and disables them in non-editor views', async () => {
    render(<App />)
    const editorVariantId = projectStore.getState().project.activeVariantId
    const user = userEvent.setup()
    const catalog = await screen.findByLabelText('Equipment catalog')
    await user.click(within(catalog).getByRole('tab', { name: /Placed/i }))
    await user.click(await within(catalog).findByRole('button', { name: /Select Tandoor/i }))

    await userEvent.click(screen.getByRole('button', { name: '3D' }))
    fireEvent.keyDown(window, { key: ']' })
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(90)

    projectStore.getState().createVariant('Compare layout')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(await screen.findByRole('heading', { name: 'Priority findings' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(getVariantItem(projectStore.getState(), editorVariantId, 'tandoor')).toBeDefined()
  })

  it('opens the new-project start screen from the project menu', async () => {
    render(<App />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Project menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'New project' }))
    expect(await screen.findByRole('heading', { name: 'Create your kitchen space' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter room dimensions/i })).toBeInTheDocument()
  })

  it('opens and closes the AI tools panel without unmounting the plan workspace', async () => {
    render(<App />)
    const plan = await screen.findByLabelText('2D plan workspace')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'AI tools' }))
    const panel = await screen.findByRole('dialog', { name: 'AI agent tools' })
    expect(plan).toBeInTheDocument()
    expect(panel).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Agent tools unavailable in this browser')).toBeInTheDocument())
    expect(screen.getByText(/No agent activity yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close AI tools' }))
    expect(screen.queryByRole('dialog', { name: 'AI agent tools' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('2D plan workspace')).toBe(plan)
  })
})
