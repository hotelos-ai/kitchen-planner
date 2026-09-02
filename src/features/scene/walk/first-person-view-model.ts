import type { WalkLocomotionState } from './types'

type Vector3Tuple = [number, number, number]
export type FirstPersonPartTransform = { position: Vector3Tuple; rotation: Vector3Tuple }

export type FirstPersonViewModel = {
  root: FirstPersonPartTransform
  supportHand: FirstPersonPartTransform
  dominantHand: FirstPersonPartTransform
  swing: { active: boolean; progress: number }
}

export type FirstPersonViewModelInput = {
  elapsedSeconds: number
  locomotionElapsedSeconds: number
  locomotion: WalkLocomotionState
  reducedMotion: boolean
  swingStartedAtSeconds: number | null
}

const SWING_DURATION_SECONDS = .32
const zeroTransform = (): FirstPersonPartTransform => ({ position: [0, 0, 0], rotation: [0, 0, 0] })

export function firstPersonVisualDescriptor() {
  return {
    parts: ['support-hand', 'support-hand-whisk', 'dominant-hand', 'dominant-hand-spatula'] as const,
    cameraRelative: true as const,
    swingInputs: ['primary-click', 'f'] as const,
    reducedMotion: 'deliberate-only' as const,
  }
}

function continuousRoot(input: FirstPersonViewModelInput): FirstPersonPartTransform {
  if (input.reducedMotion) return zeroTransform()
  const time = input.elapsedSeconds
  const phase = input.locomotionElapsedSeconds
  switch (input.locomotion) {
    case 'walking':
      return { position: [Math.cos(time * 7) * .006, Math.abs(Math.sin(time * 7)) * .012, 0], rotation: [Math.sin(time * 3.5) * .008, 0, Math.sin(time * 7) * .012] }
    case 'running':
      return { position: [Math.cos(time * 10) * .01, Math.abs(Math.sin(time * 10)) * .02, 0], rotation: [Math.sin(time * 5) * .014, 0, Math.sin(time * 10) * .022] }
    case 'jumping':
      return { position: [Math.sin(time * 2) * .003, -.018, 0], rotation: [-.012, 0, Math.sin(time * 2) * .006] }
    case 'falling':
      return { position: [Math.sin(time * 2) * .003, .012, 0], rotation: [.01, 0, Math.sin(time * 2) * .006] }
    case 'landing': {
      const settle = Math.exp(-phase * 8)
      return { position: [0, -Math.sin(Math.min(phase / .28, 1) * Math.PI) * .028 * settle, 0], rotation: [.016 * settle, 0, 0] }
    }
    case 'idle':
      return { position: [Math.sin(time * .9) * .002, Math.sin(time * 1.8) * .003, 0], rotation: [0, Math.sin(time * .7) * .003, Math.sin(time * .9) * .003] }
  }
}

export function firstPersonViewModel(input: FirstPersonViewModelInput): FirstPersonViewModel {
  const swingElapsed = input.swingStartedAtSeconds === null ? Number.POSITIVE_INFINITY : input.elapsedSeconds - input.swingStartedAtSeconds
  const active = swingElapsed >= 0 && swingElapsed <= SWING_DURATION_SECONDS
  const progress = input.swingStartedAtSeconds === null || swingElapsed < 0
    ? 0
    : Math.min(1, swingElapsed / SWING_DURATION_SECONDS)
  const arc = active ? Math.sin(progress * Math.PI) : 0
  return {
    root: continuousRoot(input),
    supportHand: { position: [-.17, -.12, -.42], rotation: [.16, .07, .1] },
    dominantHand: {
      position: [.17 - arc * .04, -.13 + arc * .05, -.42 - arc * .06],
      rotation: [.16 - arc * .46, -.06 + arc * .22, -.1 - arc * .1],
    },
    swing: { active, progress },
  }
}
