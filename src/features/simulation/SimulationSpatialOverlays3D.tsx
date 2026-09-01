import { Html, Line } from '@react-three/drei'
import type { EquipmentItem, StaffRole } from '../../domain/project'
import type { deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationResult } from '../../simulation/types'
import { ROLE_COLORS } from '../scene/agents/role-style'
import { buildAgentTrails, stationQueueAnchors } from './spatial-overlay-data'

type LiveState = ReturnType<typeof deriveLiveServiceState>
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean }

export function SimulationSpatialOverlays3D({ result, liveState, elapsedSeconds, equipment, layers, followRole }: { result: SimulationResult; liveState: LiveState; elapsedSeconds: number; equipment: readonly EquipmentItem[]; layers: Layers; followRole: StaffRole | 'overview' }) {
  const maxVisits = Math.max(1, ...result.metrics.trafficCells.map((cell) => cell.visits))
  const trails = layers.trails ? buildAgentTrails(result.frames, elapsedSeconds) : []
  const queues = layers.queues ? stationQueueAnchors(equipment, liveState.stationQueues) : []
  return <group>
    {layers.heatmap && result.metrics.trafficCells.map((cell) => <mesh key={`heat-${cell.xMm}-${cell.yMm}`} position={[cell.xMm / 1000, .012, cell.yMm / 1000]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[.1, .1]} /><meshBasicMaterial color="#df6341" transparent opacity={.04 + .42 * cell.visits / maxVisits} depthWrite={false} />
    </mesh>)}
    {trails.filter((trail) => followRole === 'overview' || trail.role === followRole).map((trail) => trail.points.length > 1 ? <Line key={trail.agentId} points={trail.points.map(([xMm, yMm]) => [xMm / 1000, .045, yMm / 1000])} color={ROLE_COLORS[trail.role]} lineWidth={2.2} transparent opacity={.58} raycast={() => null} /> : null)}
    {queues.map((queue) => <Html key={queue.stationId} position={[queue.xMm / 1000, 1.18, queue.yMm / 1000]} center distanceFactor={8} className={`station-queue-label${queue.waiting > 2 ? ' pressure' : ''}`}>
      <span>{queue.label}</span><strong>{queue.active} active · {queue.waiting} queued</strong>
    </Html>)}
  </group>
}
