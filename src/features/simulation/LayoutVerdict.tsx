import type { SimulationResult } from '../../simulation/types'

const mins = (seconds: number) => `${(seconds / 60).toFixed(1)} min`

export function LayoutVerdict({ result }: { result: SimulationResult }) {
  const metrics = result.metrics
  const completionRate = metrics.totalOrders ? metrics.completedOrders / metrics.totalOrders : 0
  const blocked = metrics.unreachableTasks > 0 || completionRate < .75
  const pressured = !blocked && (metrics.orderCompletionP90Seconds > 20 * 60 || metrics.peakOrderBacklog > 10 || metrics.hotLineCongestionEvents > 100)
  const tone = blocked ? 'critical' : pressured ? 'strained' : 'workable'
  const title = blocked ? 'Not operationally viable yet' : pressured ? 'Workable, but under pressure' : 'Operationally workable in this scenario'
  const queueLeader = Object.entries(metrics.queueSeconds).sort((a, b) => b[1] - a[1])[0]
  return <section className={`layout-verdict ${tone}`} aria-label="Layout verdict">
    <span className="eyebrow">Scenario verdict</span><h3>Layout verdict</h3><strong>{title}</strong>
    <p>{metrics.completedOrders} of {metrics.totalOrders} tickets served; completed-ticket average {mins(metrics.averageOrderWaitSeconds)}, P90 {mins(metrics.orderCompletionP90Seconds)}, peak backlog {metrics.peakOrderBacklog}.</p>
    {queueLeader && queueLeader[1] > 0 && <p><b>Primary queue:</b> {queueLeader[0].replaceAll('-', ' ')} accumulated {mins(queueLeader[1])} of station waiting.</p>}
    {metrics.hotLineCongestionEvents > 20 && <p><b>Spatial pressure:</b> {metrics.hotLineCongestionEvents} one-second close-proximity samples occurred around the cooking line.</p>}
    <small>Verdict applies only to the selected demand, staffing, timings, and layout.</small>
  </section>
}
