import { describe, expect, it } from 'vitest'
import { serviceWindowArrowDirection } from './service-window-direction'

describe('service-window arrow direction', () => {
  it('points clean service out and dirty returns in after the mesh rotation', () => {
    expect(serviceWindowArrowDirection('clean-out')).toBe(1)
    expect(serviceWindowArrowDirection('dirty-in')).toBe(-1)
  })
})
