import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import type { WalkPlayerPose, WalkViewMode } from './types'
import { WalkScene } from './WalkScene'

const controllerLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }))

vi.mock('./FirstPersonController', () => ({
  FirstPersonController: ({ view, onLockedChange, onNearbyChange, onPoseChange }: {
    view: WalkViewMode
    onLockedChange?(locked: boolean): void
    onNearbyChange?(nearby: boolean): void
    onPoseChange?(pose: WalkPlayerPose): void
  }) => {
    useEffect(() => {
      controllerLifecycle.mounts += 1
      onLockedChange?.(true)
      onNearbyChange?.(true)
      onPoseChange?.({
        x: 2100,
        y: 3200,
        headingRad: .4,
        pitchRad: -.1,
        elevationMm: 650,
        velocityMmPerSecond: { x: 300, y: 0 },
        verticalVelocityMps: 1.8,
        grounded: false,
        locomotion: 'jumping',
        nearbyInteractionIds: ['chef-2'],
      })
      return () => { controllerLifecycle.unmounts += 1 }
    }, [onLockedChange, onNearbyChange, onPoseChange])
    return <output data-testid="controller-view">{view}</output>
  },
}))
vi.mock('./FirstPersonHands', () => ({ FirstPersonHands: () => <output>hands</output> }))
vi.mock('../agents/ChefAvatar', () => ({ ChefAvatar: () => <output>player chef</output> }))

describe('WalkScene live view switching', () => {
  beforeEach(() => {
    controllerLifecycle.mounts = 0
    controllerLifecycle.unmounts = 0
  })

  it('retains one controller, lock state, vertical pose, and nearby interaction across cameras', () => {
    const project = createSeedProject()
    const onLockedChange = vi.fn()
    const onNearbyChange = vi.fn()
    const onPositionChange = vi.fn()
    const props = {
      active: true,
      architecture: project.architecture,
      equipment: project.variants[0].equipment,
      onLockedChange,
      onNearbyChange,
      onPositionChange,
    }
    const { rerender } = render(<WalkScene {...props} view="first-person" />)

    expect(screen.getByTestId('controller-view')).toHaveTextContent('first-person')
    rerender(<WalkScene {...props} view="third-person" />)

    expect(screen.getByTestId('controller-view')).toHaveTextContent('third-person')
    expect(controllerLifecycle.mounts).toBe(1)
    expect(controllerLifecycle.unmounts).toBe(0)
    expect(onLockedChange).toHaveBeenCalledTimes(1)
    expect(onLockedChange).toHaveBeenLastCalledWith(true)
    expect(onNearbyChange).toHaveBeenCalledTimes(1)
    expect(onNearbyChange).toHaveBeenLastCalledWith(true)
    expect(onPositionChange).toHaveBeenLastCalledWith(expect.objectContaining({
      x: 2100,
      y: 3200,
      elevationMm: 650,
      verticalVelocityMps: 1.8,
      nearbyInteractionIds: ['chef-2'],
    }))
  })
})
