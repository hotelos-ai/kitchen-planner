import type { AgentRenderPose, SpatialPlaybackFrame } from './types'

export function interpolateAgentFrames<TRole extends string>(frames: readonly SpatialPlaybackFrame<TRole>[], elapsedSeconds: number): AgentRenderPose<TRole>[] {
  if (!frames.length) return []
  if (frames.length === 1 || elapsedSeconds <= frames[0].elapsedSeconds) return posesAt(frames, 0, 0)
  if (elapsedSeconds >= frames[frames.length - 1].elapsedSeconds) return posesAt(frames, frames.length - 1, frames.length - 1)

  let low = 0
  let high = frames.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (frames[middle].elapsedSeconds <= elapsedSeconds) low = middle
    else high = middle
  }
  const start = frames[low]
  const end = frames[high]
  const span = Math.max(.0001, end.elapsedSeconds - start.elapsedSeconds)
  const progress = Math.max(0, Math.min(1, (elapsedSeconds - start.elapsedSeconds) / span))
  return start.agents.map((agent) => {
    const next = end.agents.find((candidate) => candidate.agentId === agent.agentId) ?? agent
    const dx = next.xMm - agent.xMm
    const dy = next.yMm - agent.yMm
    return {
      ...agent,
      state: progress < .5 ? agent.state : next.state,
      taskId: progress < .5 ? agent.taskId : next.taskId,
      xMm: agent.xMm + dx * progress,
      yMm: agent.yMm + dy * progress,
      headingRad: Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : headingNear(frames, low, agent.agentId),
      moving: Math.hypot(dx, dy) > 1,
    }
  })
}

function headingNear<TRole extends string>(frames: readonly SpatialPlaybackFrame<TRole>[], index: number, id: string): number {
  const current = frames[index].agents.find((agent) => agent.agentId === id)
  const prior = frames[Math.max(0, index - 1)].agents.find((agent) => agent.agentId === id)
  if (!current || !prior) return 0
  const dx = current.xMm - prior.xMm
  const dy = current.yMm - prior.yMm
  return Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : 0
}

function posesAt<TRole extends string>(frames: readonly SpatialPlaybackFrame<TRole>[], index: number, headingIndex: number): AgentRenderPose<TRole>[] {
  return frames[index].agents.map((agent) => ({ ...agent, headingRad: headingNear(frames, headingIndex, agent.agentId), moving: agent.state === 'walking' }))
}
