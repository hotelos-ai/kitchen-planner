import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import type { WalkPlayerPose } from './types'

const frameState = vi.hoisted(() => ({ callback: undefined as undefined | ((state: { camera: { position: { set(...values: number[]): void }; lookAt(...values: number[]): void } }, delta: number) => void) }))
const motionState = vi.hoisted(() => ({ poses: [] as WalkPlayerPose[] }))
const pointerLockState = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }))

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: typeof frameState.callback) => { frameState.callback = callback },
}))
vi.mock('./PointerLockLook', async () => {
  const { useEffect } = await import('react')
  return { PointerLockLook: () => {
    useEffect(() => {
      pointerLockState.mounts += 1
      return () => { pointerLockState.unmounts += 1 }
    }, [])
    return null
  } }
})
vi.mock('./player-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('./player-motion')>()
  return {
    ...original,
    advanceWalkPlayerMotion: () => ({ pose: motionState.poses.shift()!, colliderIds: [] }),
  }
})

import { FirstPersonController } from './FirstPersonController'
import { createWalkPlayerPose } from './player-motion'

describe('FirstPersonController pose delivery', () => {
  beforeEach(() => {
    frameState.callback = undefined
    motionState.poses = []
    pointerLockState.mounts = 0
    pointerLockState.unmounts = 0
  })

  it('publishes the one-frame landing state and keeps it visible for the hands', () => {
    const project = createSeedProject()
    const base = createWalkPlayerPose({ xMm: 1000, yMm: 1000, headingRad: 0 })
    motionState.poses = [
      { ...base, grounded: false, locomotion: 'falling', verticalVelocityMps: -1 },
      { ...base, grounded: true, locomotion: 'landing' },
      { ...base, grounded: true, locomotion: 'idle' },
      { ...base, grounded: true, locomotion: 'idle' },
    ]
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const onPoseChange = vi.fn()
    const camera = { position: { set: vi.fn() }, lookAt: vi.fn() }

    render(<FirstPersonController
      active
      architecture={project.architecture}
      equipment={[]}
      spawn={{ xMm: 1000, yMm: 1000, headingRad: 0 }}
      onPoseChange={onPoseChange}
    />)

    act(() => frameState.callback?.({ camera }, .016))
    now = 1016
    act(() => frameState.callback?.({ camera }, .016))
    expect(onPoseChange).toHaveBeenLastCalledWith(expect.objectContaining({ locomotion: 'landing' }))
    now = 1032
    act(() => frameState.callback?.({ camera }, .016))
    expect(onPoseChange).toHaveBeenLastCalledWith(expect.objectContaining({ locomotion: 'landing' }))
    now = 1140
    act(() => frameState.callback?.({ camera }, .016))
    expect(onPoseChange).toHaveBeenLastCalledWith(expect.objectContaining({ locomotion: 'idle' }))
  })

  it('keeps the pointer-lock controller mounted while switching live camera views', () => {
    const project = createSeedProject()
    const props = {
      active: true,
      architecture: project.architecture,
      equipment: [],
      spawn: { xMm: 1000, yMm: 1000, headingRad: 0 },
    }
    const { rerender } = render(<FirstPersonController {...props} view="first-person" />)

    rerender(<FirstPersonController {...props} view="third-person" />)
    rerender(<FirstPersonController {...props} view="first-person" />)

    expect(pointerLockState.mounts).toBe(1)
    expect(pointerLockState.unmounts).toBe(0)
  })
})
