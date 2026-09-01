import { expect, it } from 'vitest'
import { softenPlayerStep } from './staff-proximity'

it('slows movement near a worker without creating a hard deadlock', () => {
  const result = softenPlayerStep({ x: 0, y: 0 }, { x: 300, y: 0 }, [{ agentId: 'cdp-1', xMm: 350, yMm: 0 }])
  expect(result.delta.x).toBeGreaterThan(0)
  expect(result.delta.x).toBeLessThan(300)
  expect(result.overlappingAgentIds).toEqual(['cdp-1'])
})
