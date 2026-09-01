import type { Architecture, EquipmentItem, StaffRole } from '../../domain/project'
import { RECENT_COMPLETION_WINDOW_SECONDS, type deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationResult } from '../../simulation/types'
import { boundedFrameIndex } from './playback-timing'

// Shared by the visual agent layer and its accessible legend.
// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_COLORS: Record<StaffRole, string> = { 'head-chef': '#c94f39', 'sous-chef': '#8c5bb3', cdp: '#277c91', 'busser-washer': '#b78a28' }

type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean }
type LiveState = ReturnType<typeof deriveLiveServiceState>

const openingAnchor = (architecture: Architecture, openingId: string) => {
  const opening = architecture.openings.find((candidate) => candidate.id === openingId)
  if (!opening) return undefined
  const middle = opening.offsetMm + opening.widthMm / 2
  if (opening.wall === 'top') return { x: middle, y: 150, label: opening.label }
  if (opening.wall === 'bottom') return { x: middle, y: architecture.depthMm - 150, label: opening.label }
  if (opening.wall === 'left') return { x: 150, y: middle, label: opening.label }
  return { x: architecture.widthMm - 150, y: middle, label: opening.label }
}

export function SimulationScene({ result, liveState, elapsedSeconds, architecture, equipment, layers, followRole }: { result: SimulationResult; liveState: LiveState; elapsedSeconds: number; architecture: Architecture; equipment: EquipmentItem[]; layers: Layers; followRole: StaffRole | 'overview' }) {
  const frameIndex = boundedFrameIndex(elapsedSeconds, result.frames.length)
  const frame = result.frames[frameIndex]
  const maxVisits = Math.max(1, ...result.metrics.trafficCells.map((cell) => cell.visits))
  const trailStart = Math.max(0, frameIndex - 90)
  const followedAgent = followRole === 'overview' ? undefined : frame.agents.find((agent) => agent.role === followRole)
  const viewBox = followedAgent ? `${followedAgent.xMm - 1600} ${followedAgent.yMm - 1600} 3200 3200` : `-180 -180 ${architecture.widthMm + 360} ${architecture.depthMm + 360}`
  const visibleTickets = liveState.orders.filter((order) => order.status !== 'served' || liveState.recentlyCompleted.some((completed) => completed.id === order.id)).slice(-7).reverse()
  return (
    <div className="simulation-scene">
      <svg viewBox={viewBox} role="img" aria-label={`Kitchen service at ${Math.floor(elapsedSeconds / 60)} minutes ${Math.floor(elapsedSeconds % 60)} seconds`}>
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
        {frame.agents.map((agent) => <g key={agent.agentId} transform={`translate(${agent.xMm} ${agent.yMm})`} opacity={followRole === 'overview' || agent.role === followRole ? 1 : .22}><circle r="105" fill={ROLE_COLORS[agent.role]} stroke="white" strokeWidth="24" /><circle r="135" fill="none" stroke={ROLE_COLORS[agent.role]} strokeWidth="12" opacity={agent.state === 'waiting' ? .35 : .85} /><text y="25" textAnchor="middle" fontSize="75" fontWeight="900" fill="white">{agent.agentId.split('-').at(-1)}</text></g>)}
        {liveState.recentlyCompleted.map((order, index) => {
          const progress = Math.max(0, Math.min(1, (elapsedSeconds - (order.completedAtSeconds ?? elapsedSeconds)) / RECENT_COMPLETION_WINDOW_SECONDS))
          return <g key={`out-${order.id}`} transform={`translate(${3880 + progress * 440} ${2450 + index * 120})`} opacity={1 - progress * .8}><circle r="86" fill="#2f827f" stroke="white" strokeWidth="18" /><text y="18" textAnchor="middle" fontSize="48" fontWeight="900" fill="white">{order.id.replace('order-', '#')}</text></g>
        })}
        {layers.queues && liveState.stationQueues.filter((station) => station.waiting || station.active).map((station) => {
          const item = equipment.find((value) => value.id === station.stationId)
          const opening = openingAnchor(architecture, station.stationId)
          const anchor = item ? { x: item.xMm + item.widthMm, y: item.yMm, label: item.label } : opening
          return anchor ? <g role="img" aria-label={`${anchor.label} live queue: ${station.waiting} waiting, ${station.active} active`} key={`queue-${station.stationId}`} transform={`translate(${anchor.x} ${anchor.y})`}><circle r="90" fill={station.waiting > 2 ? '#752f21' : '#486d65'} /><text y="22" textAnchor="middle" fontSize="62" fontWeight="900" fill="white">{station.waiting}</text></g> : null
        })}
      </svg>
      <aside className="live-ticket-rail" aria-label="Live order tickets"><header><span>Order rail</span><strong>{liveState.backlog} open</strong></header>{visibleTickets.length ? visibleTickets.map((order) => <article key={order.id} className={order.status}><div><b>{order.id.replace('order-', 'Ticket #')}</b><span>{order.status}</span></div><small>{order.currentCapability?.replaceAll('-', ' ') ?? 'through clean window'} · {(order.waitSeconds / 60).toFixed(1)}m</small><progress max="1" value={order.progress} /></article>) : <p>Waiting for first order…</p>}</aside>
      <div className="live-station-strip" aria-label="Live station queues"><span>Station backlog</span>{liveState.stationQueues.filter((station) => station.waiting || station.active).slice(0, 6).map((station) => <div key={station.stationId} className={station.waiting > 2 ? 'pressure' : ''}><b>{station.stationId.replaceAll('-', ' ')}</b><em>{station.active} active</em><strong>{station.waiting} queued</strong></div>)}</div>
      <div className="role-legend">{Object.entries(ROLE_COLORS).map(([role, color]) => <span key={role}><i style={{ background: color }} />{role.replaceAll('-', ' ')}</span>)}</div>
    </div>
  )
}
