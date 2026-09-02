import type { WalkSpawnResolution } from './walk-collision'

export function WalkUnavailableNotice({ availability, onRetry, onExit }: {
  availability: Extract<WalkSpawnResolution, { status: 'unavailable' }>
  onRetry(): void
  onExit(): void
}) {
  return (
    <div role="alert" className="walk-unavailable">
      <strong>Walk Kitchen is unavailable</strong>
      <p>{availability.message}</p>
      <div>
        <button type="button" onClick={onRetry}>Retry Walk</button>
        <button type="button" onClick={onExit}>Return to 3D overview</button>
      </div>
    </div>
  )
}
