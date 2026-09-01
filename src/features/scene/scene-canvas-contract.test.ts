import { expect, it } from 'vitest'
import { SceneCanvas } from './SceneCanvas'

it('publishes one reusable resilient scene canvas', () => {
  expect(SceneCanvas).toBeTypeOf('function')
})
