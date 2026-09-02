import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectStartScreen } from './ProjectStartScreen'
import { rectangularArchitecture } from '../domain/blank-project'

describe('project start screen', () => {
  it('creates a room from dimensions', async () => {
    const user = userEvent.setup()
    const onCreateRoom = vi.fn()
    render(<ProjectStartScreen onCreateRoom={onCreateRoom} onDrawManually={vi.fn()} onOpenProject={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Enter room dimensions/i }))
    await user.selectOptions(screen.getByLabelText('Room shape'), 'l')
    await user.click(screen.getByRole('button', { name: 'Create room' }))

    expect(onCreateRoom).toHaveBeenCalledOnce()
    expect(onCreateRoom.mock.calls[0][0].roomPolygon.length).toBe(6)
  })

  it('offers tracing and manual drawing paths', async () => {
    const user = userEvent.setup()
    const onDrawManually = vi.fn()
    render(<ProjectStartScreen onCreateRoom={vi.fn()} onDrawManually={onDrawManually} onOpenProject={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Trace a floor plan/i }))
    expect(screen.getByLabelText('Upload floor plan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue to drawing' }))
    expect(onDrawManually).toHaveBeenCalledOnce()
  })

  it('uses a rectangular starter when asked', () => {
    expect(rectangularArchitecture(6200, 4800).widthMm).toBe(6200)
  })
})
