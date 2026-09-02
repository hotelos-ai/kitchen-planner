import { act, fireEvent, render } from '@testing-library/react'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirstPersonViewModel } from './first-person-view-model'

const fiberState = vi.hoisted(() => ({
  frame: undefined as undefined | (() => void),
  canvas: undefined as undefined | HTMLCanvasElement,
  camera: undefined as undefined | THREE.PerspectiveCamera,
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => { fiberState.frame = callback },
  useThree: (selector: (state: { camera: THREE.PerspectiveCamera; gl: { domElement: HTMLCanvasElement } }) => unknown) => selector({ camera: fiberState.camera!, gl: { domElement: fiberState.canvas! } }),
}))

import { FirstPersonHands } from './FirstPersonHands'

describe('rendered FirstPersonHands', () => {
  beforeEach(() => {
    fiberState.frame = undefined
    fiberState.canvas = document.createElement('canvas')
    fiberState.camera = new THREE.PerspectiveCamera()
    document.body.append(fiberState.canvas)
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  const latestModel = (reducedMotion = false) => {
    const models: FirstPersonViewModel[] = []
    render(<FirstPersonHands
      pose={{ locomotion: 'running', grounded: true, verticalVelocityMps: 0 }}
      reducedMotion={reducedMotion}
      onViewModelChange={(model) => models.push(model)}
    />)
    const frame = () => act(() => fiberState.frame?.())
    return { models, frame }
  }

  it('suppresses the pointer-lock acquisition click and swings on the next primary click', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { models, frame } = latestModel()

    fireEvent.click(fiberState.canvas!, { button: 0 })
    frame()
    expect(models.at(-1)?.swing.active).toBe(false)

    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: fiberState.canvas })
    fireEvent(document, new Event('pointerlockchange'))
    now = 1100
    fireEvent.click(fiberState.canvas!, { button: 0 })
    now = 1160
    frame()
    expect(models.at(-1)?.swing.active).toBe(true)
  })

  it('plays one keyboard F swing through the rendered event wiring', () => {
    let now = 2000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { models, frame } = latestModel()

    fireEvent.keyDown(window, { key: 'f', repeat: false })
    now = 2120
    frame()
    expect(models.at(-1)?.swing).toMatchObject({ active: true })
  })

  it('equips the dominant hand with a slotted spatula and the support hand with a wired whisk', () => {
    const { container } = render(<FirstPersonHands pose={{ locomotion: 'idle', grounded: true, verticalVelocityMps: 0 }} />)
    const hands = container.querySelectorAll('group')
    expect(hands.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('torusGeometry')).toHaveLength(3)
    expect(container.querySelectorAll('boxGeometry')).toHaveLength(4)
  })

  it('removes continuous reduced-motion transforms while retaining deliberate swing', () => {
    let now = 3000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { models, frame } = latestModel(true)

    frame()
    expect(models.at(-1)?.root).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] })
    fireEvent.keyDown(window, { key: 'F', repeat: false })
    now = 3140
    frame()
    expect(models.at(-1)?.root).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] })
    expect(models.at(-1)?.swing.active).toBe(true)
    expect(models.at(-1)?.dominantHand.rotation).not.toEqual([.18, -.08, -.12])
  })
})
