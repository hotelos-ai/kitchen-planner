import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WalkControlsGuide } from './WalkControlsGuide'

describe('WalkControlsGuide', () => {
  it('shows every approved control and exits accessibly', async () => {
    const onExit = vi.fn()
    render(<WalkControlsGuide locked={false} nearby={false} onExit={onExit} />)
    const guide = screen.getByLabelText('Walk kitchen controls')
    expect(guide).toHaveTextContent('WASD')
    expect(guide).toHaveTextContent('Up/Down')
    expect(guide).toHaveTextContent('StrafeA/D')
    expect(guide).toHaveTextContent('TurnLeft/Right arrows')
    expect(guide).toHaveTextContent('Swing spatulaClick · F')
    expect(guide).toHaveTextContent('Space · adaptive jump')
    expect(guide).toHaveTextContent('Shift')
    expect(guide).toHaveTextContent('Esc')
    await userEvent.click(screen.getByRole('button', { name: 'Exit walk mode' }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})
