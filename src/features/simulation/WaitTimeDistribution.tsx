import type { SimulationResult } from '../../simulation/types'

const minute = (seconds: number) => `${(seconds / 60).toFixed(1)}m`
const BINS = [0, 5, 10, 15, 20, 25, 30]

export function WaitTimeDistribution({ result }: { result: SimulationResult }) {
  const waits = result.metrics.orderWaitSamplesSeconds.map((seconds) => seconds / 60)
  const bins = BINS.map((start, index) => ({
    label: index === BINS.length - 1 ? '30+' : `${start}–${BINS[index + 1]}`,
    count: waits.filter((value) => value >= start && (index === BINS.length - 1 || value < BINS[index + 1])).length,
  }))
  const max = Math.max(1, ...bins.map((bin) => bin.count))
  return <section className="wait-distribution" aria-label="Customer wait-time distribution">
    <span className="eyebrow">Completed tickets</span><h3>Wait-time distribution</h3>
    <div className="wait-statline"><span><b>{minute(result.metrics.averageOrderWaitSeconds)}</b> Average</span><span><b>{minute(result.metrics.orderCompletionP50Seconds)}</b> P50</span><span><b>{minute(result.metrics.orderCompletionP90Seconds)}</b> P90</span></div>
    <div className="wait-histogram" role="img" aria-label="Histogram of completed order wait times in minutes">{bins.map((bin) => <div key={bin.label}><span className="bar-track"><i style={{ height: `${Math.max(bin.count ? 8 : 0, bin.count / max * 100)}%` }}><em>{bin.count || ''}</em></i></span><small>{bin.label}</small></div>)}</div>
    <div className="wait-thresholds"><span><b>{Math.round(result.metrics.ordersWithin15MinutesPct)}%</b> served ≤15m</span><span><b>{Math.round(result.metrics.ordersWithin20MinutesPct)}%</b> served ≤20m</span></div>
    <small>Open tickets remain counted above and are excluded until served.</small>
  </section>
}
