import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('opens the Manta Raja planning workspace', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Manta Raja Kitchen Lab/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
  })
})
