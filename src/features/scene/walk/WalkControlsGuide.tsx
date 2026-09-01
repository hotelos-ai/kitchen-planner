export function WalkControlsGuide({ locked, nearby, onExit }: { locked: boolean; nearby: boolean; onExit(): void }) {
  return <aside className="walk-controls-guide" aria-label="Walk kitchen controls">
    <div><strong>{locked ? 'Walking the kitchen' : 'Click the kitchen to look'}</strong>{nearby && <em>Worker nearby</em>}</div>
    <dl>
      <div><dt>Move</dt><dd>WASD · Arrow keys</dd></div>
      <div><dt>Left</dt><dd>A/Left · move left</dd></div>
      <div><dt>Right</dt><dd>D/Right · move right</dd></div>
      <div><dt>Look</dt><dd>Mouse</dd></div>
      <div><dt>Jump</dt><dd>Space · adaptive jump</dd></div>
      <div><dt>Faster</dt><dd>Shift</dd></div>
      <div><dt>Release</dt><dd>Esc</dd></div>
    </dl>
    <button type="button" onClick={onExit}>Exit walk mode</button>
  </aside>
}
