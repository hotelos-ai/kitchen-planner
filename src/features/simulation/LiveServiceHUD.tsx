import type { SimulationResult } from '../../simulation/types'
import type { deriveLiveServiceState } from '../../simulation/live-state'

type LiveState = ReturnType<typeof deriveLiveServiceState>

const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
const minutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`

export function LiveServiceHUD({ result, state }: { result: SimulationResult; state: LiveState }) {
  return <section className="live-service-hud" aria-label="Live service status">
    <article className="service-clock"><span>Service time</span><strong>{clock(state.elapsedSeconds)}</strong></article>
    <article><span>Orders in</span><strong>{state.arrivedOrders}<small> / {result.metrics.totalOrders}</small></strong></article>
    <article><span>Served</span><strong>{state.completedOrders}</strong></article>
    <article className={state.backlog > 8 ? 'pressure' : ''}><span>Live backlog</span><strong>{state.backlog}</strong></article>
    <article><span>Average served wait</span><strong>{minutes(state.averageCompletedWaitSeconds)}</strong></article>
    <article className={state.oldestOpenWaitSeconds > 20 * 60 ? 'pressure' : ''}><span>Oldest open ticket</span><strong>{minutes(state.oldestOpenWaitSeconds)}</strong></article>
  </section>
}
