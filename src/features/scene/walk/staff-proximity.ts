import type { PointMm } from '../../../domain/project'

export function softenPlayerStep(position: PointMm, intendedDelta: PointMm, staff: readonly { agentId: string; xMm: number; yMm: number }[]) {
  const nearby = staff.filter((agent) => Math.hypot(agent.xMm - position.x, agent.yMm - position.y) < 850)
  if (!nearby.length) return { delta: intendedDelta, overlappingAgentIds: [] as string[] }
  const closest = Math.min(...nearby.map((agent) => Math.hypot(agent.xMm - position.x, agent.yMm - position.y)))
  const scale = Math.max(.35, Math.min(1, .35 + Math.max(0, closest - 350) / 500 * .65))
  return { delta: { x: intendedDelta.x * scale, y: intendedDelta.y * scale }, overlappingAgentIds: nearby.filter((agent) => Math.hypot(agent.xMm - position.x, agent.yMm - position.y) < 500).map((agent) => agent.agentId) }
}
