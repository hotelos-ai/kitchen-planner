import { describe, expect, it } from 'vitest'
import { interpolateAgentFrames } from './interpolate-agent-frame'

describe('interpolateAgentFrames', () => {
  const frames = [
    { elapsedSeconds: 0, agents: [{ agentId: 'chef-1', role: 'chef', xMm: 0, yMm: 0, state: 'walking' as const }] },
    { elapsedSeconds: 1, agents: [{ agentId: 'chef-1', role: 'chef', xMm: 1000, yMm: 0, state: 'working' as const }] },
  ]

  it('smoothly interpolates position and heading without mutating frames', () => {
    expect(interpolateAgentFrames(frames, 0.5)[0]).toMatchObject({ xMm: 500, yMm: 0, headingRad: 0, moving: true })
    expect(frames[0].agents[0].xMm).toBe(0)
  })

  it('clamps before the first and after the last frame', () => {
    expect(interpolateAgentFrames(frames, -2)[0].xMm).toBe(0)
    expect(interpolateAgentFrames(frames, 9)[0].xMm).toBe(1000)
  })
})
