import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationInput, SimulationResult } from '../../simulation/types'
import {
  selectSimulationRun,
  simulationRunStore,
  type SimulationRunStore,
} from '../../state/simulation-run-store'
import { advancePlaybackTime } from './playback-timing'

export type SimulationSession = {
  result: SimulationResult | null
  liveState: ReturnType<typeof deriveLiveServiceState> | null
  elapsedSeconds: number
  playing: boolean
  speed: number
  startRun(inputOverride?: SimulationInput, autoplay?: boolean, targetOverride?: SimulationSessionTarget): void
  presentRun(autoplay?: boolean): void
  clearRun(): void
  setPlaying(value: boolean): void
  setSpeed(value: number): void
  setElapsedSeconds(value: number): void
}

export type SimulationSessionTarget = {
  variantId: string
  scenarioId: string
  revision: number
}

type UseSimulationSessionInput = {
  input: SimulationInput
  run: (input: SimulationInput, signal?: AbortSignal) => SimulationResult | Promise<SimulationResult>
  variantId?: string
  scenarioId?: string
  revision?: number
  runStore?: SimulationRunStore
}

export function useSimulationSession({
  input,
  run,
  variantId = 'active-layout',
  scenarioId = input.scenario.id,
  revision = 0,
  runStore = simulationRunStore,
}: UseSimulationSessionInput): SimulationSession {
  const storedRun = useStore(runStore, (state) => selectSimulationRun(state, variantId, scenarioId))
  // Retain stale runs for agent inspection, but never visualize old routes on
  // top of geometry or assumptions from a newer document revision.
  const result = storedRun?.ranAtRevision === revision ? storedRun.result : null
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(25)
  const lastTick = useRef(0)
  const lastResult = useRef(result)
  const locallyStartedResult = useRef<SimulationResult | null>(null)
  const activeRun = useRef<AbortController | null>(null)
  const liveState = useMemo(() => result ? deriveLiveServiceState(result, elapsedSeconds) : null, [elapsedSeconds, result])

  useEffect(() => {
    if (lastResult.current === result) return
    lastResult.current = result
    setElapsedSeconds(0)
    if (locallyStartedResult.current === result) {
      locallyStartedResult.current = null
      return
    }
    setPlaying(false)
  }, [result])

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

  useEffect(() => () => activeRun.current?.abort(), [])

  return {
    result, liveState, elapsedSeconds, playing, speed,
    startRun: (inputOverride, autoplay = true, targetOverride) => {
      const simulationInput = inputOverride ?? input
      activeRun.current?.abort()
      const controller = new AbortController()
      activeRun.current = controller
      const target = targetOverride ?? { variantId, scenarioId, revision }
      setElapsedSeconds(0)
      setPlaying(false)
      let pending: SimulationResult | Promise<SimulationResult>
      try {
        pending = run.length >= 2 ? run(simulationInput, controller.signal) : run(simulationInput)
      } catch {
        if (activeRun.current === controller) activeRun.current = null
        return
      }
      void Promise.resolve(pending).then((nextResult) => {
        if (controller.signal.aborted) return
        locallyStartedResult.current = nextResult
        runStore.getState().storeRun({
          variantId: target.variantId,
          scenarioId: target.scenarioId,
          result: nextResult,
          seed: simulationInput.scenario.seed,
          ranAtRevision: target.revision,
        })
        setElapsedSeconds(0)
        setPlaying(autoplay)
      }).catch(() => undefined).finally(() => {
        if (activeRun.current === controller) activeRun.current = null
      })
    },
    presentRun: (autoplay = true) => {
      setElapsedSeconds(0)
      setPlaying(autoplay)
    },
    clearRun: () => {
      locallyStartedResult.current = null
      runStore.getState().removeRun(variantId, scenarioId)
      setElapsedSeconds(0)
      setPlaying(false)
    },
    setPlaying, setSpeed, setElapsedSeconds,
  }
}
