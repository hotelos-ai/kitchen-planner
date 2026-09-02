import { fireEvent, render, waitFor } from '@testing-library/react'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PointerLockLook } from './PointerLockLook'

const useThreeMock = vi.hoisted(() => vi.fn())

vi.mock('@react-three/fiber', () => ({ useThree: useThreeMock }))

describe('PointerLockLook', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = document.createElement('canvas')
    document.body.append(canvas)
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null })
    useThreeMock.mockImplementation((selector: (state: unknown) => unknown) => selector({
      camera: new THREE.PerspectiveCamera(),
      gl: { domElement: canvas },
    }))
  })

  afterEach(() => {
    canvas.remove()
    useThreeMock.mockReset()
  })

  it('does not report an unlock when the browser merely rejects the lock request', async () => {
    const onUnlock = vi.fn()
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Pointer lock unavailable')),
    })

    render(<PointerLockLook active onLock={vi.fn()} onUnlock={onUnlock} />)
    fireEvent.click(canvas)

    await waitFor(() => expect(canvas.requestPointerLock).toHaveBeenCalledOnce())
    await Promise.resolve()
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('reports an unlock only after a successful locked state', () => {
    const onLock = vi.fn()
    const onUnlock = vi.fn()
    render(<PointerLockLook active onLock={onLock} onUnlock={onUnlock} />)

    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas })
    fireEvent(document, new Event('pointerlockchange'))
    expect(onLock).toHaveBeenCalledOnce()
    expect(onUnlock).not.toHaveBeenCalled()

    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null })
    fireEvent(document, new Event('pointerlockchange'))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('publishes look deltas to the player pose owner without mutating the camera', () => {
    const camera = new THREE.PerspectiveCamera()
    const onLook = vi.fn()
    useThreeMock.mockImplementation((selector: (state: unknown) => unknown) => selector({ camera, gl: { domElement: canvas } }))
    render(<PointerLockLook active onLock={vi.fn()} onUnlock={vi.fn()} onLook={onLook} />)

    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas })
    fireEvent.mouseMove(document, { movementX: 12, movementY: -8 })

    expect(onLook).toHaveBeenCalledWith(.024, .016)
    expect(camera.quaternion.toArray()).toEqual([0, 0, 0, 1])
  })
})
