import { useEffect, useMemo, useRef, useState } from 'react'
import { deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import { advancePlaybackTime } from './playback-timing'

export type SimulationSession = {
  result: SimulationResult | null
  liveState: ReturnType<typeof deriveLiveServiceState> | null
  elapsedSeconds: number
  playing: boolean
  speed: number
  startRun(): void
  clearRun(): void
  setPlaying(value: boolean): void
  setSpeed(value: number): void
  setElapsedSeconds(value: number): void
}

export function useSimulationSession({ input, run }: { input: SimulationInput; run: (input: SimulationInput) => SimulationResult }): SimulationSession {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(25)
  const lastTick = useRef(0)
  const liveState = useMemo(() => result ? deriveLiveServiceState(result, elapsedSeconds) : null, [elapsedSeconds, result])

  useEffect(() => {
    if (!playing || !result) return
    let frameId = 0
    lastTick.current = performance.now()
    const tick = (now: number) => {
      const previous = lastTick.current
      lastTick.current = now
      setElapsedSeconds((current) => {
        const next = advancePlaybackTime({ currentSeconds: current, nowMs: now, previousMs: previous, speed, durationSeconds: result.durationSeconds })
        if (next >= result.durationSeconds) setPlaying(false)
        return next
      })
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [playing, result, speed])

  return {
    result, liveState, elapsedSeconds, playing, speed,
    startRun: () => { setResult(run(input)); setElapsedSeconds(0); setPlaying(true) },
    clearRun: () => { setResult(null); setElapsedSeconds(0); setPlaying(false) },
    setPlaying, setSpeed, setElapsedSeconds,
  }
}
