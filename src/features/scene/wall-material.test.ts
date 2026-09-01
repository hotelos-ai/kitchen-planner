import { expect, it } from 'vitest'
import { wallSurfaceRenderState } from './wall-material'

it('removes all wall surface and shadow output in outline-only mode', () => {
  expect(wallSurfaceRenderState(true)).toEqual({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false,
    castShadow: false,
  })
  expect(wallSurfaceRenderState(false)).toEqual({
    transparent: false,
    opacity: 1,
    colorWrite: true,
    depthWrite: true,
    castShadow: true,
  })
})
