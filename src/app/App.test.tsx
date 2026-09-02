import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('opens the Manta Raja planning workspace', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Kitchen Planner/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('button', { name: /Select Tandoor/i })).toBeInTheDocument()
  })
})
