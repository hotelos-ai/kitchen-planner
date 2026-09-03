import { useEffect, useState, type ComponentType } from 'react'
import { useStore } from 'zustand'
import type { EquipmentItem, KitchenProject, LayoutVariant } from '../../domain/project'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { appStateStore } from '../../state/app-state-store'
import { KitchenScene } from './KitchenScene'
import { ResilientSceneBoundary } from './ResilientSceneBoundary'
import { SceneCanvas, type CameraMode } from './SceneCanvas'
import { ChefAvatar } from './agents/ChefAvatar'
import { WalkControlsGuide } from './walk/WalkControlsGuide'
import { WalkScene, type WalkAvailability } from './walk/WalkScene'
import { WalkUnavailableNotice } from './walk/WalkUnavailableNotice'
import type { WalkPlayerPosition, WalkViewMode } from './walk/types'

export type { CameraMode } from './SceneCanvas'

export type SceneRendererProps = {
  items: EquipmentItem[]
  onSelect(id: string): void
  project: KitchenProject
  variant: LayoutVariant
  selectedIds: string[]
  showClearances: boolean
  wallsTransparent: boolean
  showLabels: boolean
  walkMode: boolean
  walkView: WalkViewMode
  reducedMotion: boolean
  playerPosition?: WalkPlayerPosition
  cameraMode: CameraMode
  fitSignal: number
  focusPoint?: { x: number; y: number }
  onClearSelection(): void
  onContextLost(): void
  onContextRestored(): void
  onWalkAvailabilityChange(availability: WalkAvailability): void
  onWalkLockedChange(locked: boolean): void
  onWalkNearbyChange(nearby: boolean): void
  onPlayerPositionChange(position: WalkPlayerPosition): void
  walkRetrySignal: number
  rendererGeneration: number
}

type Props = {
  store?: ProjectStore
  renderer?: ComponentType<SceneRendererProps>
  compact?: boolean
  webglSupported?: boolean
  variantOverride?: LayoutVariant
  readOnly?: boolean
  walkMode?: boolean
}

function WebGLKitchenRenderer({ project, variant, selectedIds, showClearances, wallsTransparent, showLabels, walkMode, walkView, reducedMotion, playerPosition, cameraMode, fitSignal, focusPoint, walkRetrySignal, onSelect, onClearSelection, onContextLost, onContextRestored, onWalkAvailabilityChange, onWalkLockedChange, onWalkNearbyChange, onPlayerPositionChange }: SceneRendererProps) {
  return <SceneCanvas architecture={variant.architecture} cameraMode={cameraMode} fitSignal={fitSignal} focusPoint={focusPoint} walkMode={walkMode} onContextLost={onContextLost} onContextRestored={onContextRestored}>
    <KitchenScene project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} wallsTransparent={wallsTransparent} showLabels={showLabels} onSelect={onSelect} onClearSelection={onClearSelection} />
    <WalkScene active={walkMode} view={walkView} architecture={variant.architecture} equipment={variant.equipment} reducedMotion={reducedMotion} retrySignal={walkRetrySignal} onAvailabilityChange={onWalkAvailabilityChange} onLockedChange={onWalkLockedChange} onNearbyChange={onWalkNearbyChange} onPositionChange={onPlayerPositionChange} />
    {!walkMode && playerPosition && <group position={[playerPosition.x / 1000, playerPosition.elevationMm / 1000, playerPosition.y / 1000]}><ChefAvatar player reducedMotion={reducedMotion} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPosition.x, yMm: playerPosition.y, state: 'waiting', headingRad: 0, moving: false }} /></group>}
  </SceneCanvas>
}

const browserSupportsWebGL = () => typeof window === 'undefined'
  || typeof window.WebGL2RenderingContext === 'function'
  || typeof window.WebGLRenderingContext === 'function'

export function SceneWorkspace({ store = projectStore, renderer: Renderer, compact = false, webglSupported, variantOverride, readOnly = false, walkMode: walkModeProp }: Props) {
  const project = useStore(store, (state) => state.project)
  const storeSelectedIds = useStore(store, (state) => state.selectedIds)
  const storeVariant = useStore(store, getActiveVariant)
  const variant = variantOverride ?? storeVariant
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[]>([])
  const selectedIds = readOnly ? previewSelectedIds : storeSelectedIds
  const sharedShowClearances = useStore(appStateStore, (state) => state.showClearances)
  const sharedWallsTransparent = useStore(appStateStore, (state) => state.wallsTransparent)
  const sharedShowLabels = useStore(appStateStore, (state) => state.showLabels)
  const [previewShowClearances, setPreviewShowClearances] = useState(false)
  const [previewWallsTransparent, setPreviewWallsTransparent] = useState(false)
  const [previewShowLabels, setPreviewShowLabels] = useState(true)
  const showClearances = readOnly ? previewShowClearances : sharedShowClearances
  const wallsTransparent = readOnly ? previewWallsTransparent : sharedWallsTransparent
  const showLabels = readOnly ? previewShowLabels : sharedShowLabels
  const setShowClearances = (value: boolean) => readOnly ? setPreviewShowClearances(value) : appStateStore.getState().setShowClearances(value)
  const setWallsTransparent = (value: boolean) => readOnly ? setPreviewWallsTransparent(value) : appStateStore.getState().setWallsTransparent(value)
  const setShowLabels = (value: boolean) => readOnly ? setPreviewShowLabels(value) : appStateStore.getState().setShowLabels(value)
  const sharedWalkMode = useStore(appStateStore, (state) => state.walkMode)
  const setSharedWalkMode = useStore(appStateStore, (state) => state.setWalkMode)
  const [previewWalkMode, setPreviewWalkMode] = useState(Boolean(walkModeProp))
  const walkMode = walkModeProp ?? (readOnly ? previewWalkMode : sharedWalkMode)
  const setWalkMode = (value: boolean) => readOnly ? setPreviewWalkMode(value) : setSharedWalkMode(value)
  const sharedWalkView = useStore(appStateStore, (state) => state.walkView)
  const [previewWalkView, setPreviewWalkView] = useState<WalkViewMode>('first-person')
  const walkView = readOnly ? previewWalkView : sharedWalkView
  const setWalkView = (value: WalkViewMode) => readOnly ? setPreviewWalkView(value) : appStateStore.getState().setWalkView(value)
  const [walkAvailability, setWalkAvailability] = useState<WalkAvailability>({ status: 'idle' })
  const [walkRetrySignal, setWalkRetrySignal] = useState(0)
  const [walkLocked, setWalkLocked] = useState(false)
  const [walkNearby, setWalkNearby] = useState(false)
  const [playerPosition, setPlayerPosition] = useState<WalkPlayerPosition>()
  const sharedCameraMode = useStore(appStateStore, (state) => state.cameraMode)
  const setSharedCameraMode = useStore(appStateStore, (state) => state.setCameraMode)
  const [previewCameraMode, setPreviewCameraMode] = useState<CameraMode>('perspective')
  const cameraMode = readOnly ? previewCameraMode : sharedCameraMode
  const setCameraMode = (value: CameraMode) => readOnly ? setPreviewCameraMode(value) : setSharedCameraMode(value)
  const cameraFocusRequest = useStore(appStateStore, (state) => state.cameraFocusRequest)
  const [fitSignal, setFitSignal] = useState(0)
  const [rendererKey, setRendererKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const select = (id: string) => {
    if (readOnly) setPreviewSelectedIds([id])
    else store.getState().selectItems([id])
  }
  const clearSelection = () => {
    if (readOnly) setPreviewSelectedIds([])
    else store.getState().clearSelection()
  }
  const SceneRenderer = Renderer ?? WebGLKitchenRenderer
  const supportsWebGL = webglSupported ?? (Boolean(Renderer) || browserSupportsWebGL())
  const focusPoint = !readOnly && cameraFocusRequest?.target === 'point'
    ? cameraFocusRequest.point
    : !readOnly && cameraFocusRequest?.target === 'component'
      ? (() => {
          const item = variant.equipment.find((candidate) => candidate.id === cameraFocusRequest.componentId)
          return item ? { x: item.xMm + item.widthMm / 2, y: item.yMm + item.depthMm / 2 } : undefined
        })()
      : undefined
  const focusSignal = cameraFocusRequest?.id.split('').reduce((value, character) => ((value * 31) + character.charCodeAt(0)) | 0, 0) ?? 0
  const supportStatus = supportsWebGL ? 'ready' : 'unsupported'
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => () => {
    if (readOnly || walkModeProp !== undefined) return
    appStateStore.getState().setWalkMode(false)
    appStateStore.getState().setCameraMode('perspective')
  }, [readOnly, walkModeProp])
  const exitWalk = () => {
    if (walkModeProp) return
    setWalkMode(false)
    setWalkAvailability({ status: 'idle' })
    setWalkLocked(false)
    setWalkNearby(false)
  }
  const activateCamera = (mode: CameraMode) => { exitWalk(); setCameraMode(mode); setFitSignal((value) => value + 1) }
  const restartRenderer = () => { setContextLost(false); setRendererKey((value) => value + 1); setFitSignal((value) => value + 1) }

  return (
    <section className={`scene-workspace${compact ? ' compact' : ''}`} aria-label="3D kitchen workspace">
      <div className="scene-toolbar">
        <div><span className="eyebrow">Active layout</span><strong>{variant.name}</strong></div>
        <div className="scene-actions">
          <button type="button" aria-pressed={cameraMode === 'perspective'} onClick={() => activateCamera('perspective')}>Perspective</button>
          <button type="button" aria-pressed={cameraMode === 'top'} onClick={() => activateCamera('top')}>Top</button>
          <button type="button" onClick={() => setFitSignal((value) => value + 1)}>Fit room</button>
          <button type="button" aria-pressed={showClearances} onClick={() => setShowClearances(!showClearances)}>Clearances</button>
          <button type="button" aria-pressed={wallsTransparent} onClick={() => setWallsTransparent(!wallsTransparent)}>Transparent walls</button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels(!showLabels)}>Labels</button>
          <button type="button" aria-pressed={walkMode} onClick={() => { setWalkAvailability({ status: 'idle' }); setWalkMode(true) }}>Walk kitchen</button>
        </div>
      </div>
      <div
        className={`scene-canvas${contextLost ? ' context-lost' : ''}${walkMode ? ' walk-pointer-lock-target' : ''}`}
        data-testid="kitchen-scene"
        data-renderer-generation={rendererKey}
        data-player-x-mm={playerPosition?.x}
        data-player-y-mm={playerPosition?.y}
        data-player-elevation-mm={playerPosition?.elevationMm}
        data-player-grounded={playerPosition?.grounded}
        data-player-vertical-velocity={playerPosition?.verticalVelocityMps}
        data-walk-view={walkMode ? walkView : undefined}
      >
        <ResilientSceneBoundary status={supportStatus} resetKey={rendererKey} onRetry={restartRenderer}>
          <SceneRenderer key={rendererKey} items={variant.equipment} project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} wallsTransparent={wallsTransparent} showLabels={showLabels} walkMode={walkMode} walkView={walkView} reducedMotion={Boolean(reducedMotion)} playerPosition={playerPosition} cameraMode={cameraMode} fitSignal={fitSignal + focusSignal} focusPoint={focusPoint} walkRetrySignal={walkRetrySignal} rendererGeneration={rendererKey} onSelect={select} onClearSelection={clearSelection} onContextLost={() => setContextLost(true)} onContextRestored={() => setContextLost(false)} onWalkAvailabilityChange={setWalkAvailability} onWalkLockedChange={setWalkLocked} onWalkNearbyChange={setWalkNearby} onPlayerPositionChange={setPlayerPosition} />
        </ResilientSceneBoundary>
        {contextLost && <div role="alert" className="scene-context-message"><strong>3D rendering paused</strong><p>The browser interrupted the graphics context. It may restore automatically, or restart the renderer without changing the plan.</p><button type="button" onClick={restartRenderer}>Restart 3D renderer</button></div>}
        {walkMode && walkAvailability.status === 'unavailable' ? <WalkUnavailableNotice availability={walkAvailability} onRetry={() => setWalkRetrySignal((value) => value + 1)} onExit={exitWalk} /> : walkMode && <><div className="walk-reticle" aria-hidden="true" /><div role="group" aria-label="Walk view"><button type="button" aria-pressed={walkView === 'first-person'} onClick={() => setWalkView('first-person')}>First-person view</button><button type="button" aria-pressed={walkView === 'third-person'} onClick={() => setWalkView('third-person')}>Third-person view</button></div><WalkControlsGuide view={walkView} locked={walkLocked} nearby={walkNearby} onExit={exitWalk} /></>}
      </div>
      <div className="scene-legend"><span><i className="cooking" /> Cooking</span><span><i className="cold" /> Cold</span><span><i className="wash" /> Washing</span><span>Drag to orbit · Shift-drag to pan · Scroll to zoom</span></div>
    </section>
  )
}
