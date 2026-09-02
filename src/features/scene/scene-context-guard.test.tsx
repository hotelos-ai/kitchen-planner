import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const contextState = vi.hoisted(() => ({ canvas: undefined as undefined | HTMLCanvasElement }))
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: unknown }) => children,
  useThree: (selector: (state: { gl: { domElement: HTMLCanvasElement } }) => unknown) => selector({ gl: { domElement: contextState.canvas! } }),
}))
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }))

import { WebGLContextGuard } from './SceneCanvas'

describe('WebGLContextGuard native events', () => {
  beforeEach(() => { contextState.canvas = document.createElement('canvas') })

  it('handles native loss, restoration, and a repeated loss on the same canvas', () => {
    const onLost = vi.fn()
    const onRestored = vi.fn()
    render(<WebGLContextGuard onLost={onLost} onRestored={onRestored} />)

    const firstLoss = new Event('webglcontextlost', { cancelable: true })
    contextState.canvas!.dispatchEvent(firstLoss)
    contextState.canvas!.dispatchEvent(new Event('webglcontextrestored'))
    contextState.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(firstLoss.defaultPrevented).toBe(true)
    expect(onLost).toHaveBeenCalledTimes(2)
    expect(onRestored).toHaveBeenCalledOnce()
  })
})
