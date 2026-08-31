type Props = {
  elapsedSeconds: number
  durationSeconds: number
  playing: boolean
  speed: number
  onPlaying(value: boolean): void
  onElapsed(value: number): void
  onSpeed(value: number): void
}

const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

export function PlaybackControls({ elapsedSeconds, durationSeconds, playing, speed, onPlaying, onElapsed, onSpeed }: Props) {
  return (
    <div className="playback-controls" aria-label="Simulation playback controls">
      <button type="button" onClick={() => onElapsed(0)} aria-label="Restart service">↺</button>
      <button type="button" className="play-button" onClick={() => onPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
      <span className="playback-time">{time(elapsedSeconds)} / {time(durationSeconds)}</span>
      <input aria-label="Simulation time" type="range" min="0" max={durationSeconds} step="1" value={elapsedSeconds} onChange={(event) => onElapsed(Number(event.target.value))} />
      <label>Speed<select aria-label="Playback speed" value={speed} onChange={(event) => onSpeed(Number(event.target.value))}>{[.5, 1, 2, 4].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
  )
}
