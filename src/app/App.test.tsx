import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
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
})
