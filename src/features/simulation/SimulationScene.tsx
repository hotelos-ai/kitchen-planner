import type { Architecture, EquipmentItem, StaffRole } from '../../domain/project'
import type { SimulationResult } from '../../simulation/types'

export const ROLE_COLORS: Record<StaffRole, string> = { 'head-chef': '#c94f39', 'sous-chef': '#8c5bb3', cdp: '#277c91', 'busser-washer': '#b78a28' }

type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean }

export function SimulationScene({ result, elapsedSeconds, architecture, equipment, layers }: { result: SimulationResult; elapsedSeconds: number; architecture: Architecture; equipment: EquipmentItem[]; layers: Layers }) {
  const frameIndex = Math.min(result.frames.length - 1, Math.floor(elapsedSeconds))
  const frame = result.frames[frameIndex]
  const maxVisits = Math.max(1, ...result.metrics.trafficCells.map((cell) => cell.visits))
  const trailStart = Math.max(0, frameIndex - 90)
  return (
    <div className="simulation-scene">
      <svg viewBox={`-180 -180 ${architecture.widthMm + 360} ${architecture.depthMm + 360}`} role="img" aria-label={`Kitchen service at ${Math.floor(elapsedSeconds / 60)} minutes ${Math.floor(elapsedSeconds % 60)} seconds`}>
        <defs><pattern id="sim-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#aab4b0" strokeWidth="3" opacity=".4" /></pattern></defs>
        <polygon points={architecture.roomPolygon.map((point) => `${point.x},${point.y}`).join(' ')} fill="#fbfaf6" stroke="#27322e" strokeWidth="30" />
        <polygon points={architecture.roomPolygon.map((point) => `${point.x},${point.y}`).join(' ')} fill="url(#sim-grid)" />
        {layers.heatmap && result.metrics.trafficCells.map((cell) => <rect key={`${cell.xMm}-${cell.yMm}`} x={cell.xMm - 50} y={cell.yMm - 50} width="100" height="100" fill="#e56743" opacity={.06 + .5 * cell.visits / maxVisits} />)}
        {architecture.storageZones.map((zone) => <rect key={zone.id} x={zone.xMm} y={zone.yMm} width={zone.widthMm} height={zone.depthMm} fill="#789472" opacity=".13" stroke="#607b5c" strokeWidth="12" strokeDasharray="45 30" />)}
        {layers.clearances && equipment.filter((item) => item.clearance).map((item) => <rect key={`clear-${item.id}`} x={item.xMm} y={item.yMm + item.depthMm} width={item.widthMm} height={item.clearance!.frontMm} fill={item.category === 'cooking' ? '#e57a59' : '#5f9c91'} opacity=".12" stroke="#9e5a47" strokeWidth="8" strokeDasharray="30 22" />)}
        {equipment.filter((item) => item.category !== 'hood').map((item) => <g key={item.id} transform={`translate(${item.xMm} ${item.yMm}) rotate(${item.rotationDeg})`}><rect width={item.widthMm} height={item.depthMm} rx="22" fill={item.category === 'cooking' ? '#e8b5a7' : item.category === 'cold' ? '#c2d9db' : item.category === 'washing' || item.category === 'landing' ? '#dfd0a8' : '#d4ddca'} stroke="#45534e" strokeWidth="12" /><text x={item.widthMm / 2} y={item.depthMm / 2} textAnchor="middle" dominantBaseline="middle" fontSize="70" fontWeight="800" fill="#35413d">{item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label}</text></g>)}
        {architecture.pillars.map((pillar) => <rect key={pillar.id} x={pillar.xMm} y={pillar.yMm} width={pillar.widthMm} height={pillar.depthMm} fill="#4c5551" />)}
        {layers.flows && <><path d="M 3850 2500 C 3300 2800, 2600 3000, 2000 3000" fill="none" stroke="#2d8790" strokeWidth="35" strokeDasharray="60 35" opacity=".6" /><path d="M 3850 4300 C 3200 4500, 2700 5050, 2300 5550" fill="none" stroke="#b8892e" strokeWidth="35" strokeDasharray="60 35" opacity=".65" /></>}
        {layers.trails && frame.agents.map((agent) => {
          const points = result.frames.slice(trailStart, frameIndex + 1).map((candidate) => candidate.agents.find((value) => value.agentId === agent.agentId)).filter(Boolean).map((value) => `${value!.xMm},${value!.yMm}`).join(' ')
          return <polyline key={`trail-${agent.agentId}`} points={points} fill="none" stroke={ROLE_COLORS[agent.role]} strokeWidth="22" opacity=".35" />
        })}
        {frame.agents.map((agent) => <g key={agent.agentId} transform={`translate(${agent.xMm} ${agent.yMm})`}><circle r="105" fill={ROLE_COLORS[agent.role]} stroke="white" strokeWidth="24" /><circle r="135" fill="none" stroke={ROLE_COLORS[agent.role]} strokeWidth="12" opacity={agent.state === 'waiting' ? .35 : .85} /><text y="25" textAnchor="middle" fontSize="75" fontWeight="900" fill="white">{agent.agentId.split('-').at(-1)}</text></g>)}
        {layers.queues && Object.entries(result.metrics.queueSeconds).filter(([, seconds]) => seconds > 0).map(([stationId, seconds]) => { const item = equipment.find((value) => value.id === stationId); return item ? <g key={`queue-${stationId}`} transform={`translate(${item.xMm + item.widthMm} ${item.yMm})`}><circle r="90" fill="#752f21" /><text y="22" textAnchor="middle" fontSize="62" fontWeight="900" fill="white">{Math.ceil(seconds / 60)}m</text></g> : null })}
      </svg>
      <div className="role-legend">{Object.entries(ROLE_COLORS).map(([role, color]) => <span key={role}><i style={{ background: color }} />{role.replaceAll('-', ' ')}</span>)}</div>
    </div>
  )
}
