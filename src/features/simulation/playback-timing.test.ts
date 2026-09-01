import { describe, expect, it } from 'vitest'
import { advancePlaybackTime, boundedFrameIndex } from './playback-timing'

describe('simulation playback timing', () => {
  it('never moves backwards when the first animation-frame timestamp predates setup', () => {
    expect(advancePlaybackTime({ currentSeconds: 0, nowMs: 99, previousMs: 100, speed: 25, durationSeconds: 3600 })).toBe(0)
  })

  it('bounds frame selection at both ends and handles non-finite input', () => {
    expect(boundedFrameIndex(-1, 100)).toBe(0)
    expect(boundedFrameIndex(999, 100)).toBe(99)
    expect(boundedFrameIndex(Number.NaN, 100)).toBe(0)
  })
})
