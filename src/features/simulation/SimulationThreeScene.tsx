import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { interpolateAgentFrames } from '../../core/agents/interpolate-agent-frame'
import type { KitchenProject, LayoutVariant, StaffRole } from '../../domain/project'
import type { deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationResult } from '../../simulation/types'
import { KitchenScene } from '../scene/KitchenScene'
import { SceneCanvas } from '../scene/SceneCanvas'
import { SimulatedStaff } from '../scene/agents/SimulatedStaff'
import { ChefAvatar } from '../scene/agents/ChefAvatar'
import { WalkControlsGuide } from '../scene/walk/WalkControlsGuide'
import { WalkScene } from '../scene/walk/WalkScene'
import type { WalkPlayerPosition } from '../scene/walk/types'
import { CompletedOrderFlow3D } from './CompletedOrderFlow3D'
import { LiveSimulationOverlays } from './LiveSimulationOverlays'
import { SimulationSpatialOverlays3D } from './SimulationSpatialOverlays3D'
import type { SimulationView } from './SimulationViewSwitcher'

type LiveState = ReturnType<typeof deriveLiveServiceState>
type Layers = { heatmap: boolean; trails: boolean; queues: boolean; clearances: boolean; flows: boolean }

export type SimulationThreeSceneProps = {
  view: Exclude<SimulationView, 'operations-2d'>
  project: KitchenProject
  variant: LayoutVariant
  result: SimulationResult
  liveState: LiveState
  elapsedSeconds: number
  layers: Layers
  followRole: StaffRole | 'overview'
  onExitWalk(): void
}

class SimulationSceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Unable to render the live 3D simulation', error, info) }
  render() {
    if (this.state.failed) return <p role="alert" className="scene-fallback">The live 3D view could not start. Playback and the 2D operations view remain available.</p>
    return this.props.children
  }
}

export function SimulationThreeScene({ view, project, variant, result, liveState, elapsedSeconds, layers, followRole, onExitWalk }: SimulationThreeSceneProps) {
  const [rendererKey, setRendererKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const [walkLocked, setWalkLocked] = useState(false)
  const [walkNearby, setWalkNearby] = useState(false)
  const [playerPosition, setPlayerPosition] = useState<WalkPlayerPosition>()
  const walkMode = view === 'walk'
  const poses = useMemo(() => interpolateAgentFrames(result.frames, elapsedSeconds), [elapsedSeconds, result.frames])
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const restartRenderer = () => { setContextLost(false); setRendererKey((key) => key + 1) }

  const staffPositionSignature = poses.map((pose) => `${pose.agentId}:${Math.round(pose.xMm)},${Math.round(pose.yMm)}`).join('|')

  return <div className={`simulation-three-scene${walkMode ? ' walk-active walk-pointer-lock-target' : ''}`} data-testid="simulation-3d-scene" data-view={view} data-staff-count={poses.length} data-staff-positions={staffPositionSignature} data-player-position={playerPosition ? `${Math.round(playerPosition.x)},${Math.round(playerPosition.y)},${Math.round(playerPosition.elevationMm)}` : undefined} data-player-x-mm={playerPosition?.x} data-player-y-mm={playerPosition?.y} data-player-elevation-mm={playerPosition?.elevationMm} data-player-grounded={playerPosition?.grounded} data-player-vertical-velocity={playerPosition?.verticalVelocityMps}>
    {contextLost ? <div role="alert" className="scene-context-message"><strong>Live 3D rendering paused</strong><p>The browser interrupted the graphics context. Restart it without losing this service run or playback position.</p><button type="button" onClick={restartRenderer}>Restart live 3D</button></div> : <SimulationSceneBoundary key={rendererKey}>
      <SceneCanvas architecture={project.architecture} cameraMode="perspective" fitSignal={0} walkMode={walkMode} onContextLost={() => setContextLost(true)} onContextRestored={() => setContextLost(false)}>
        <KitchenScene project={project} variant={variant} selectedIds={[]} showClearances={layers.clearances} wallsTransparent onSelect={() => undefined} onClearSelection={() => undefined} />
        <SimulationSpatialOverlays3D result={result} liveState={liveState} elapsedSeconds={elapsedSeconds} equipment={variant.equipment} layers={layers} followRole={followRole} />
        <SimulatedStaff frames={result.frames} elapsedSeconds={elapsedSeconds} followRole={followRole} reducedMotion={Boolean(reducedMotion)} />
        <CompletedOrderFlow3D architecture={project.architecture} liveState={liveState} elapsedSeconds={elapsedSeconds} />
        <WalkScene active={walkMode} architecture={project.architecture} equipment={variant.equipment} staff={poses} reducedMotion={Boolean(reducedMotion)} onLockedChange={setWalkLocked} onNearbyChange={setWalkNearby} onPositionChange={setPlayerPosition} />
        {!walkMode && playerPosition && <group position={[playerPosition.x / 1000, playerPosition.elevationMm / 1000, playerPosition.y / 1000]}><ChefAvatar player reducedMotion={Boolean(reducedMotion)} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPosition.x, yMm: playerPosition.y, state: 'waiting', headingRad: 0, moving: false }} label="You · walkthrough position" /></group>}
      </SceneCanvas>
    </SimulationSceneBoundary>}
    <LiveSimulationOverlays liveState={liveState} className="three-overlay" />
    <div className="simulation-three-status"><span>{walkMode ? 'First-person service floor' : 'Live spatial overview'}</span><strong>{poses.length} chefs · {liveState.backlog} open orders</strong></div>
    {walkMode && <><div className="walk-reticle" aria-hidden="true" /><WalkControlsGuide locked={walkLocked} nearby={walkNearby} onExit={onExitWalk} /></>}
  </div>
}
