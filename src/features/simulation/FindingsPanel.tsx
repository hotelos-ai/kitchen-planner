import type { SimulationResult } from '../../simulation/types'

export function FindingsPanel({ result }: { result: SimulationResult }) {
  const findings = [
    ...(result.metrics.unreachableTasks ? [{ level: 'high', title: 'Access failure detected', text: `${result.metrics.unreachableTasks} task legs could not reach their assigned station without crossing equipment.` }] : []),
    ...(result.metrics.hotLineCongestionEvents > 20 ? [{ level: 'high', title: 'Hot-line pinch pressure', text: `${result.metrics.hotLineCongestionEvents} close-proximity events occurred around the cooking line.` }] : []),
    ...(result.metrics.dirtyCleanCrossings ? [{ level: 'medium', title: 'Dirty and clean paths cross', text: `${result.metrics.dirtyCleanCrossings} simulated crossing events need review around wash-up and service.` }] : []),
    ...(!result.metrics.unreachableTasks && result.metrics.dirtyToWashTravelMm < 30000 ? [{ level: 'good', title: 'Wash-up sequence is compact', text: 'Dirty landing, pre-rinse, dishwasher, and clean landing form a short working chain.' }] : []),
  ]
  return <section className="simulation-findings"><div className="panel-heading"><span className="eyebrow">Layout signals</span><h2>What to inspect</h2></div>{result.warnings.map((warning) => <p role="alert" className="simulation-warning" key={warning}>{warning}</p>)}{findings.map((finding) => <article className={finding.level} key={finding.title}><strong>{finding.title}</strong><p>{finding.text}</p></article>)}</section>
}
