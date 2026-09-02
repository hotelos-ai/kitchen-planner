import { interpolateAgentFrames } from '../../../core/agents/interpolate-agent-frame'
import type { StaffRole } from '../../../domain/project'
import type { SimulationFrame } from '../../../simulation/types'
import { ChefAvatar } from './ChefAvatar'
import { roleLabel } from './role-style'

export function SimulatedStaff({ frames, elapsedSeconds, followRole = 'overview', reducedMotion = false, showLabels = true }: { frames: readonly SimulationFrame[]; elapsedSeconds: number; followRole?: StaffRole | 'overview'; reducedMotion?: boolean; showLabels?: boolean }) {
  const poses = interpolateAgentFrames(frames, elapsedSeconds)
  return <group data-testid="simulated-staff" userData={{ count: poses.length }}>
    {poses.map((pose) => <group key={pose.agentId} position={[pose.xMm / 1000, 0, pose.yMm / 1000]} rotation={[0, Math.PI / 2 - pose.headingRad, 0]} visible={followRole === 'overview' || pose.role === followRole}>
      <ChefAvatar pose={pose} reducedMotion={reducedMotion} label={showLabels ? `${roleLabel(pose.role)} · ${pose.taskId?.replaceAll('-', ' ') ?? pose.state}` : undefined} />
    </group>)}
  </group>
}
