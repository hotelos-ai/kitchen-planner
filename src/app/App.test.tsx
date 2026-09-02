import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { getActiveItem, getVariantItem, projectStore } from '../state/project-store'
import { App } from './App'

describe('App', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))
  it('opens the Manta Raja planning workspace', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Kitchen Planner/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('button', { name: /Select Tandoor/i })).toBeInTheDocument()
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

  it('opens the auto-layout experiment workspace', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Auto-layout' }))
    expect(await screen.findByLabelText('Auto-layout experiment')).toBeInTheDocument()
    expect(screen.getByText(/best observed feasible layouts/i)).toBeInTheDocument()
  })

  it('enables Plan editing shortcuts in 3D and disables them in non-editor views', async () => {
    render(<App />)
    const editorVariantId = projectStore.getState().project.activeVariantId
    await userEvent.click(await screen.findByRole('button', { name: /Select Tandoor/i }))

    await userEvent.click(screen.getByRole('button', { name: '3D' }))
    fireEvent.keyDown(window, { key: ']' })
    expect(getActiveItem(projectStore.getState(), 'tandoor').rotationDeg).toBe(90)

    await userEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(await screen.findByRole('heading', { name: 'Priority findings' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(getVariantItem(projectStore.getState(), editorVariantId, 'tandoor')).toBeDefined()
  })
})
