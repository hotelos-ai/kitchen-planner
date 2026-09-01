import { Component, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { EquipmentItem, KitchenProject, LayoutVariant, PointMm } from '../../domain/project'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { KitchenScene } from './KitchenScene'
import { SceneCanvas, type CameraMode } from './SceneCanvas'
import { ChefAvatar } from './agents/ChefAvatar'
import { WalkControlsGuide } from './walk/WalkControlsGuide'
import { WalkScene } from './walk/WalkScene'

export type { CameraMode } from './SceneCanvas'

export type SceneRendererProps = {
  items: EquipmentItem[]
  onSelect(id: string): void
  project: KitchenProject
  variant: LayoutVariant
  selectedIds: string[]
  showClearances: boolean
  wallsTransparent: boolean
  walkMode: boolean
  reducedMotion: boolean
  playerPosition?: PointMm
  cameraMode: CameraMode
  fitSignal: number
  onClearSelection(): void
  onContextLost(): void
  onContextRestored(): void
  onWalkLockedChange(locked: boolean): void
  onWalkNearbyChange(nearby: boolean): void
  onPlayerPositionChange(position: PointMm): void
}

type Props = {
  store?: ProjectStore
  renderer?: ComponentType<SceneRendererProps>
  compact?: boolean
}

function WebGLKitchenRenderer({ project, variant, selectedIds, showClearances, wallsTransparent, walkMode, reducedMotion, playerPosition, cameraMode, fitSignal, onSelect, onClearSelection, onContextLost, onContextRestored, onWalkLockedChange, onWalkNearbyChange, onPlayerPositionChange }: SceneRendererProps) {
  return <SceneCanvas architecture={project.architecture} cameraMode={cameraMode} fitSignal={fitSignal} walkMode={walkMode} onContextLost={onContextLost} onContextRestored={onContextRestored}>
    <KitchenScene project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} wallsTransparent={wallsTransparent} onSelect={onSelect} onClearSelection={onClearSelection} />
    <WalkScene active={walkMode} architecture={project.architecture} equipment={variant.equipment} reducedMotion={reducedMotion} onLockedChange={onWalkLockedChange} onNearbyChange={onWalkNearbyChange} onPositionChange={onPlayerPositionChange} />
    {!walkMode && playerPosition && <group position={[playerPosition.x / 1000, 0, playerPosition.y / 1000]}><ChefAvatar player reducedMotion={reducedMotion} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPosition.x, yMm: playerPosition.y, state: 'waiting', headingRad: 0, moving: false }} /></group>}
  </SceneCanvas>
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Unable to start the 3D kitchen view', error, info) }
  render() {
    if (this.state.failed) return <p role="alert" className="scene-fallback">3D view is unavailable in this browser. The plan editor is still fully usable.</p>
    return this.props.children
  }
}

export function SceneWorkspace({ store = projectStore, renderer: Renderer, compact = false }: Props) {
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const variant = useStore(store, getActiveVariant)
  const [showClearances, setShowClearances] = useState(false)
  const [wallsTransparent, setWallsTransparent] = useState(false)
  const [walkMode, setWalkMode] = useState(false)
  const [walkLocked, setWalkLocked] = useState(false)
  const [walkNearby, setWalkNearby] = useState(false)
  const [playerPosition, setPlayerPosition] = useState<PointMm>()
  const [cameraMode, setCameraMode] = useState<CameraMode>('perspective')
  const [fitSignal, setFitSignal] = useState(0)
  const [rendererKey, setRendererKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const select = (id: string) => store.getState().selectItems([id])
  const SceneRenderer = Renderer ?? WebGLKitchenRenderer
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const activateCamera = (mode: CameraMode) => { setWalkMode(false); setWalkLocked(false); setCameraMode(mode); setFitSignal((value) => value + 1) }
  const restartRenderer = () => { setContextLost(false); setRendererKey((value) => value + 1); setFitSignal((value) => value + 1) }

  return (
    <section className={`scene-workspace${compact ? ' compact' : ''}`} aria-label="3D kitchen workspace">
      <div className="scene-toolbar">
        <div><span className="eyebrow">Active layout</span><strong>{variant.name}</strong></div>
        <div className="scene-actions">
          <button type="button" aria-pressed={cameraMode === 'perspective'} onClick={() => activateCamera('perspective')}>Perspective</button>
          <button type="button" aria-pressed={cameraMode === 'top'} onClick={() => activateCamera('top')}>Top</button>
          <button type="button" onClick={() => setFitSignal((value) => value + 1)}>Fit room</button>
          <button type="button" aria-pressed={showClearances} onClick={() => setShowClearances((value) => !value)}>Clearances</button>
          <button type="button" aria-pressed={wallsTransparent} onClick={() => setWallsTransparent((value) => !value)}>Transparent walls</button>
          <button type="button" aria-pressed={walkMode} onClick={() => setWalkMode(true)}>Walk kitchen</button>
        </div>
      </div>
      <div className={`scene-canvas${contextLost ? ' context-lost' : ''}`} data-testid="kitchen-scene" data-renderer-generation={rendererKey}>
        {contextLost ? <div role="alert" className="scene-context-message"><strong>3D rendering paused</strong><p>The browser interrupted the graphics context. Restart the renderer to restore the model without changing the plan.</p><button type="button" onClick={restartRenderer}>Restart 3D renderer</button></div> : <SceneErrorBoundary key={rendererKey}>
          <SceneRenderer key={rendererKey} items={variant.equipment} project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} wallsTransparent={wallsTransparent} walkMode={walkMode} reducedMotion={Boolean(reducedMotion)} playerPosition={playerPosition} cameraMode={cameraMode} fitSignal={fitSignal} onSelect={select} onClearSelection={() => store.getState().clearSelection()} onContextLost={() => setContextLost(true)} onContextRestored={() => setContextLost(false)} onWalkLockedChange={setWalkLocked} onWalkNearbyChange={setWalkNearby} onPlayerPositionChange={setPlayerPosition} />
        </SceneErrorBoundary>}
        {walkMode && <><div className="walk-reticle" aria-hidden="true" /><WalkControlsGuide locked={walkLocked} nearby={walkNearby} onExit={() => { setWalkMode(false); setWalkLocked(false); setWalkNearby(false) }} /></>}
      </div>
      <div className="scene-legend"><span><i className="cooking" /> Cooking</span><span><i className="cold" /> Cold</span><span><i className="wash" /> Washing</span><span>Drag to orbit · Shift-drag to pan · Scroll to zoom</span></div>
    </section>
  )
}
