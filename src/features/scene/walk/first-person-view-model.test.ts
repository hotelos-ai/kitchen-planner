import { describe, expect, it } from 'vitest'
import { spatulaVisualDescriptor } from './SpatulaModel'
import { firstPersonViewModel, firstPersonVisualDescriptor } from './first-person-view-model'

describe('first-person view model', () => {
  it('describes two camera-relative hands and one reusable dominant-hand spatula', () => {
    expect(firstPersonVisualDescriptor()).toEqual({
      parts: ['support-hand', 'dominant-hand', 'dominant-hand-spatula'],
      cameraRelative: true,
      swingInputs: ['primary-click', 'f'],
      reducedMotion: 'deliberate-only',
    })
    expect(spatulaVisualDescriptor()).toMatchObject({
      reusable: true,
      parts: ['grip', 'tang', 'blade', 'blade-slots'],
    })
  })

  it.each([
    ['idle', .006],
    ['walking', .018],
    ['running', .03],
    ['jumping', .025],
    ['falling', .025],
    ['landing', .035],
  ] as const)('keeps %s bob and sway restrained', (locomotion, maximumOffsetM) => {
    const model = firstPersonViewModel({
      elapsedSeconds: 1.237,
      locomotionElapsedSeconds: .137,
      locomotion,
      reducedMotion: false,
      swingStartedAtSeconds: null,
    })
    expect(Math.abs(model.root.position[0])).toBeLessThanOrEqual(maximumOffsetM)
    expect(Math.abs(model.root.position[1])).toBeLessThanOrEqual(maximumOffsetM)
    expect(Math.abs(model.root.rotation[2])).toBeLessThanOrEqual(.04)
  })

  it('uses deterministic distinct walk, run, jump, and landing poses', () => {
    const at = (locomotion: 'walking' | 'running' | 'jumping' | 'landing') => firstPersonViewModel({
      elapsedSeconds: .42,
      locomotionElapsedSeconds: .12,
      locomotion,
      reducedMotion: false,
      swingStartedAtSeconds: null,
    }).root
    expect(at('walking')).not.toEqual(at('running'))
    expect(at('jumping')).not.toEqual(at('landing'))
    expect(at('walking')).toEqual(at('walking'))
  })

  it('plays one short swing and returns exactly to the resting dominant hand', () => {
    const modelAt = (elapsedSeconds: number) => firstPersonViewModel({
      elapsedSeconds,
      locomotionElapsedSeconds: elapsedSeconds,
      locomotion: 'idle',
      reducedMotion: false,
      swingStartedAtSeconds: 1,
    })
    expect(modelAt(1)).toMatchObject({ swing: { active: true, progress: 0 } })
    expect(modelAt(1.16).dominantHand.rotation).not.toEqual(modelAt(1).dominantHand.rotation)
    expect(modelAt(1.4)).toMatchObject({ swing: { active: false, progress: 1 } })
    expect(modelAt(1.4).dominantHand.rotation).toEqual(modelAt(1).dominantHand.rotation)
  })

  it('removes continuous motion in reduced-motion mode but retains deliberate swing', () => {
    const resting = firstPersonViewModel({
      elapsedSeconds: 4.2,
      locomotionElapsedSeconds: .2,
      locomotion: 'running',
      reducedMotion: true,
      swingStartedAtSeconds: null,
    })
    const swinging = firstPersonViewModel({
      elapsedSeconds: 4.36,
      locomotionElapsedSeconds: .36,
      locomotion: 'running',
      reducedMotion: true,
      swingStartedAtSeconds: 4.2,
    })
    expect(resting.root).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] })
    expect(swinging.root).toEqual(resting.root)
    expect(swinging.swing.active).toBe(true)
    expect(swinging.dominantHand.rotation).not.toEqual(resting.dominantHand.rotation)
  })
})
