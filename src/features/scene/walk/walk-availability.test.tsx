import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EquipmentItem } from '../../../domain/project'
import { createSeedProject } from '../../../domain/seed-project'
import { WalkScene } from './WalkScene'

describe('WalkScene availability', () => {
  it('reports a fully obstructed room without mounting the walkthrough controller', async () => {
    const project = createSeedProject()
    const architecture = { ...project.architecture, openings: [] }
    const blocker: EquipmentItem = {
      id: 'room-blocker',
      label: 'Room blocker',
      category: 'custom',
      xMm: 0,
      yMm: 0,
      widthMm: architecture.widthMm,
      depthMm: architecture.depthMm,
      heightMm: 2500,
      rotationDeg: 0,
      dimensionsLocked: true,
      movable: false,
      removable: false,
      capabilities: [],
    }
    const onAvailabilityChange = vi.fn()

    expect(() => render(
      <WalkScene
        active
        architecture={architecture}
        equipment={[blocker]}
        onAvailabilityChange={onAvailabilityChange}
      />,
    )).not.toThrow()

    await waitFor(() => expect(onAvailabilityChange).toHaveBeenCalledWith({
      status: 'unavailable',
      code: 'no-valid-spawn',
      message: 'No safe walkthrough start is available. Add a staff entry or clear space inside the room.',
    }))
  })

  it('clears walk-local availability when leaving Walk mode', async () => {
    const project = createSeedProject()
    const onAvailabilityChange = vi.fn()
    const { rerender } = render(
      <WalkScene
        active={false}
        architecture={project.architecture}
        equipment={project.variants[0].equipment}
        onAvailabilityChange={onAvailabilityChange}
      />,
    )

    await waitFor(() => expect(onAvailabilityChange).toHaveBeenLastCalledWith({ status: 'idle' }))
    rerender(
      <WalkScene
        active={false}
        architecture={project.architecture}
        equipment={project.variants[0].equipment}
        onAvailabilityChange={onAvailabilityChange}
      />,
    )
    expect(onAvailabilityChange).toHaveBeenLastCalledWith({ status: 'idle' })
  })
})
