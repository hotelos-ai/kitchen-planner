import type { EquipmentItem, StaffRole } from '../../domain/project'
import type { LiveStationQueue } from '../../simulation/live-state'
import type { SimulationFrame } from '../../simulation/types'

export type AgentTrail = { agentId: string; role: StaffRole; points: [number, number][] }
export type StationQueueAnchor = { stationId: string; label: string; xMm: number; yMm: number; active: number; waiting: number }

export function buildAgentTrails(frames: readonly SimulationFrame[], elapsedSeconds: number, windowSeconds = 24): AgentTrail[] {
  if (!frames.length) return []
  const end = Math.max(0, Math.min(frames.length - 1, Math.floor(elapsedSeconds)))
  const start = Math.max(0, end - Math.max(1, Math.floor(windowSeconds)))
  const agents = frames[end].agents
  return agents.map((agent) => ({
    agentId: agent.agentId,
    role: agent.role,
    points: frames.slice(start, end + 1).map((frame) => frame.agents.find((candidate) => candidate.agentId === agent.agentId)).filter((pose) => Boolean(pose)).map((pose) => [pose!.xMm, pose!.yMm]),
  }))
}

export function stationQueueAnchors(equipment: readonly EquipmentItem[], queues: readonly LiveStationQueue[]): StationQueueAnchor[] {
  return queues.flatMap((queue) => {
    const item = equipment.find((candidate) => candidate.id === queue.stationId)
    return item && (queue.active || queue.waiting) ? [{ stationId: queue.stationId, label: item.label, xMm: item.xMm + item.widthMm / 2, yMm: item.yMm + item.depthMm / 2, active: queue.active, waiting: queue.waiting }] : []
  })
}
