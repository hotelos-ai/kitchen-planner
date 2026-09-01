import type { SimulationResult } from '../../simulation/types'

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

export function Scorecard({ result }: { result: SimulationResult }) {
  const metrics = result.metrics
  const busiest = Object.entries(metrics.stationUtilization).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const pressure = Array.from({ length: 12 }, (_, index) => {
    const start = Math.floor(result.frames.length * index / 12)
    const end = Math.floor(result.frames.length * (index + 1) / 12)
    return result.frames.slice(start, end).reduce((total, frame) => total + frame.agents.reduce((count, agent, agentIndex) => count + frame.agents.slice(agentIndex + 1).filter((other) => Math.hypot(agent.xMm - other.xMm, agent.yMm - other.yMm) < 550).length, 0), 0)
  })
  const maxPressure = Math.max(1, ...pressure)
  return (
    <section className="scorecard" aria-label="Simulation metrics">
      <div className="scorecard-heading"><span className="eyebrow">Measured outcome</span><h2>Service scorecard</h2></div>
      <div className="metric-grid">
        <article><strong>{number.format(metrics.totalTravelMm / 1000)} m</strong><span>Total staff travel</span></article>
        <article><strong>{metrics.completedOrders}/{metrics.totalOrders}</strong><span>Completed tickets</span></article>
        <article><strong>{number.format(metrics.averageOrderWaitSeconds / 60)} min</strong><span>Average completed wait</span></article>
        <article><strong>{number.format(metrics.orderCompletionP90Seconds / 60)} min</strong><span>Order P90</span></article>
        <article><strong>{metrics.peakOrderBacklog}</strong><span>Peak ticket backlog</span></article>
        <article><strong>{number.format(metrics.throughputPerHour)}</strong><span>Tickets per hour</span></article>
        <article><strong>{metrics.hotLineCongestionEvents}</strong><span>Hot-line proximity samples</span></article>
        <article><strong>{metrics.dirtyCleanCrossings}</strong><span>Dirty-clean crossings</span></article>
        <article><strong>{metrics.doorConflictEvents}</strong><span>D2 door conflicts</span></article>
        <article><strong>{metrics.unreachableTasks}</strong><span>Unreachable tasks</span></article>
        <article><strong>{number.format(metrics.dirtyToWashTravelMm / 1000)} m</strong><span>Dirty-to-wash travel</span></article>
      </div>
      <div className="station-pressure"><h3>Highest station use</h3>{busiest.map(([stationId, utilization]) => <div key={stationId}><span>{stationId.replaceAll('-', ' ')}</span><progress max="1" value={utilization} /><strong>{Math.round(utilization * 100)}%</strong></div>)}</div>
      <div className="pressure-timeline"><h3>Pressure over service</h3><div aria-label="Congestion pressure timeline">{pressure.map((value, index) => <i key={index} title={`${Math.round(index * result.durationSeconds / 12 / 60)} min: ${value} close-proximity samples`} style={{ height: `${Math.max(4, value / maxPressure * 100)}%` }} />)}</div><span><b>0 min</b><b>{Math.round(result.durationSeconds / 120)} min</b><b>{Math.round(result.durationSeconds / 60)} min</b></span></div>
    </section>
  )
}
