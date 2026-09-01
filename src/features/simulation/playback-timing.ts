export function advancePlaybackTime({ currentSeconds, nowMs, previousMs, speed, durationSeconds }: { currentSeconds: number; nowMs: number; previousMs: number; speed: number; durationSeconds: number }) {
  const deltaSeconds = Math.max(0, nowMs - previousMs) / 1000 * speed
  return Math.max(0, Math.min(durationSeconds, currentSeconds + deltaSeconds))
}

export function boundedFrameIndex(elapsedSeconds: number, frameCount: number) {
  if (!frameCount || !Number.isFinite(elapsedSeconds)) return 0
  return Math.max(0, Math.min(frameCount - 1, Math.floor(elapsedSeconds)))
}
