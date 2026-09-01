import type { deriveLiveServiceState } from '../../simulation/live-state'

type LiveState = ReturnType<typeof deriveLiveServiceState>

export function LiveSimulationOverlays({ liveState, className = '' }: { liveState: LiveState; className?: string }) {
  const visibleTickets = liveState.orders.filter((order) => order.status !== 'served' || liveState.recentlyCompleted.some((completed) => completed.id === order.id)).slice(-7).reverse()
  return <div className={`live-simulation-overlays ${className}`.trim()}>
    <aside className="live-ticket-rail" aria-label="Live order tickets"><header><span>Order rail</span><strong>{liveState.backlog} open</strong></header>{visibleTickets.length ? visibleTickets.map((order) => <article key={order.id} className={order.status}><div><b>{order.id.replace('order-', 'Ticket #')}</b><span>{order.status}</span></div><small>{order.currentCapability?.replaceAll('-', ' ') ?? 'through clean window'} · {(order.waitSeconds / 60).toFixed(1)}m</small><progress max="1" value={order.progress} /></article>) : <p>Waiting for first order…</p>}</aside>
    <div className="live-station-strip" aria-label="Live station queues"><span>Station backlog</span>{liveState.stationQueues.filter((station) => station.waiting || station.active).slice(0, 6).map((station) => <div key={station.stationId} className={station.waiting > 2 ? 'pressure' : ''}><b>{station.stationId.replaceAll('-', ' ')}</b><em>{station.active} active</em><strong>{station.waiting} queued</strong></div>)}</div>
  </div>
}
