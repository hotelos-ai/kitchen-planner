import { useMemo, useState } from 'react'
import { interpolateAgentFrames } from '../../core/agents/interpolate-agent-frame'
import type { KitchenProject, LayoutVariant, StaffRole } from '../../domain/project'
import type { deriveLiveServiceState } from '../../simulation/live-state'
import type { SimulationResult } from '../../simulation/types'
import { KitchenScene } from '../scene/KitchenScene'
import { ResilientSceneBoundary } from '../scene/ResilientSceneBoundary'
import { SceneCanvas } from '../scene/SceneCanvas'
import { SimulatedStaff } from '../scene/agents/SimulatedStaff'
import { ChefAvatar } from '../scene/agents/ChefAvatar'
import { WalkControlsGuide } from '../scene/walk/WalkControlsGuide'
import { WalkScene, type WalkAvailability } from '../scene/walk/WalkScene'
import { WalkUnavailableNotice } from '../scene/walk/WalkUnavailableNotice'
import type { WalkPlayerPosition, WalkViewMode } from '../scene/walk/types'
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
  webglSupported?: boolean
}

const browserSupportsWebGL = () => typeof window === 'undefined'
  || typeof window.WebGL2RenderingContext === 'function'
  || typeof window.WebGLRenderingContext === 'function'

export function SimulationThreeScene({ view, project, variant, result, liveState, elapsedSeconds, layers, followRole, onExitWalk, webglSupported }: SimulationThreeSceneProps) {
  const [rendererKey, setRendererKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const [walkLocked, setWalkLocked] = useState(false)
  const [walkView, setWalkView] = useState<WalkViewMode>('first-person')
  const [walkNearby, setWalkNearby] = useState(false)
  const [walkAvailability, setWalkAvailability] = useState<WalkAvailability>({ status: 'idle' })
  const [walkRetrySignal, setWalkRetrySignal] = useState(0)
  const [playerPosition, setPlayerPosition] = useState<WalkPlayerPosition>()
  const walkMode = view === 'walk'
  const poses = useMemo(() => interpolateAgentFrames(result.frames, elapsedSeconds), [elapsedSeconds, result.frames])
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const restartRenderer = () => { setContextLost(false); setRendererKey((key) => key + 1) }
  const supportStatus = (webglSupported ?? browserSupportsWebGL()) ? 'ready' : 'unsupported'

  const staffPositionSignature = poses.map((pose) => `${pose.agentId}:${Math.round(pose.xMm)},${Math.round(pose.yMm)}`).join('|')

  return <div className={`simulation-three-scene${walkMode ? ' walk-active walk-pointer-lock-target' : ''}`} data-testid="simulation-3d-scene" data-view={view} data-walk-view={walkMode ? walkView : undefined} data-staff-count={poses.length} data-staff-positions={staffPositionSignature} data-player-position={playerPosition ? `${Math.round(playerPosition.x)},${Math.round(playerPosition.y)},${Math.round(playerPosition.elevationMm)}` : undefined} data-player-x-mm={playerPosition?.x} data-player-y-mm={playerPosition?.y} data-player-elevation-mm={playerPosition?.elevationMm} data-player-grounded={playerPosition?.grounded} data-player-vertical-velocity={playerPosition?.verticalVelocityMps}>
    <ResilientSceneBoundary status={supportStatus} resetKey={rendererKey} onRetry={restartRenderer}>
      <SceneCanvas architecture={variant.architecture} cameraMode="perspective" fitSignal={0} walkMode={walkMode} onContextLost={() => setContextLost(true)} onContextRestored={() => setContextLost(false)}>
        <KitchenScene project={project} variant={variant} selectedIds={[]} showClearances={layers.clearances} wallsTransparent onSelect={() => undefined} onClearSelection={() => undefined} />
        <SimulationSpatialOverlays3D result={result} liveState={liveState} elapsedSeconds={elapsedSeconds} equipment={variant.equipment} layers={layers} followRole={followRole} />
        <SimulatedStaff frames={result.frames} elapsedSeconds={elapsedSeconds} followRole={followRole} reducedMotion={Boolean(reducedMotion)} />
        <CompletedOrderFlow3D architecture={variant.architecture} liveState={liveState} elapsedSeconds={elapsedSeconds} />
        <WalkScene active={walkMode} view={walkView} architecture={variant.architecture} equipment={variant.equipment} staff={poses} reducedMotion={Boolean(reducedMotion)} retrySignal={walkRetrySignal} onAvailabilityChange={setWalkAvailability} onLockedChange={setWalkLocked} onNearbyChange={setWalkNearby} onPositionChange={setPlayerPosition} />
        {!walkMode && playerPosition && <group position={[playerPosition.x / 1000, playerPosition.elevationMm / 1000, playerPosition.y / 1000]}><ChefAvatar player reducedMotion={Boolean(reducedMotion)} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPosition.x, yMm: playerPosition.y, state: 'waiting', headingRad: 0, moving: false }} label="You · walkthrough position" /></group>}
      </SceneCanvas>
    </ResilientSceneBoundary>
    {contextLost && <div role="alert" className="scene-context-message"><strong>Live 3D rendering paused</strong><p>The browser interrupted the graphics context. It may restore automatically, or restart it without losing this service run or playback position.</p><button type="button" onClick={restartRenderer}>Restart live 3D</button></div>}
    <LiveSimulationOverlays liveState={liveState} className="three-overlay" />
    <div className="simulation-three-status"><span>{walkMode ? `${walkView === 'first-person' ? 'First-person' : 'Third-person'} service floor` : 'Live spatial overview'}</span><strong>{poses.length} chefs · {liveState.backlog} open orders</strong></div>
    {walkMode && walkAvailability.status === 'unavailable' ? <WalkUnavailableNotice availability={walkAvailability} onRetry={() => setWalkRetrySignal((value) => value + 1)} onExit={onExitWalk} /> : walkMode && <><div className="walk-reticle" aria-hidden="true" /><div role="group" aria-label="Walk view"><button type="button" aria-pressed={walkView === 'first-person'} onClick={() => setWalkView('first-person')}>First-person view</button><button type="button" aria-pressed={walkView === 'third-person'} onClick={() => setWalkView('third-person')}>Third-person view</button></div><WalkControlsGuide view={walkView} locked={walkLocked} nearby={walkNearby} onExit={onExitWalk} /></>}
  </div>
}
