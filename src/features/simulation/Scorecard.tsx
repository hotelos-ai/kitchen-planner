import type { SimulationResult } from '../../simulation/types'

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

export function Scorecard({ result }: { result: SimulationResult }) {
  const metrics = result.metrics
  const busiest = Object.entries(metrics.stationUtilization).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return (
    <section className="scorecard" aria-label="Simulation metrics">
      <div className="scorecard-heading"><span className="eyebrow">Measured outcome</span><h2>Service scorecard</h2></div>
      <div className="metric-grid">
        <article><strong>{number.format(metrics.totalTravelMm / 1000)} m</strong><span>Total staff travel</span></article>
        <article><strong>{metrics.completedOrders}</strong><span>Completed orders</span></article>
        <article><strong>{number.format(metrics.orderCompletionP90Seconds / 60)} min</strong><span>Order P90</span></article>
        <article><strong>{metrics.hotLineCongestionEvents}</strong><span>Hot-line congestion</span></article>
        <article><strong>{metrics.dirtyCleanCrossings}</strong><span>Dirty-clean crossings</span></article>
        <article><strong>{metrics.doorConflictEvents}</strong><span>D2 door conflicts</span></article>
        <article><strong>{metrics.unreachableTasks}</strong><span>Unreachable tasks</span></article>
        <article><strong>{number.format(metrics.dirtyToWashTravelMm / 1000)} m</strong><span>Dirty-to-wash travel</span></article>
      </div>
      <div className="station-pressure"><h3>Highest station use</h3>{busiest.map(([stationId, utilization]) => <div key={stationId}><span>{stationId.replaceAll('-', ' ')}</span><progress max="1" value={utilization} /><strong>{Math.round(utilization * 100)}%</strong></div>)}</div>
    </section>
  )
}
