import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { Architecture, EquipmentItem, KitchenProject, LayoutVariant, PointMm } from '../../domain/project'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { KitchenScene } from './KitchenScene'
import { cameraArchitectureKey } from './camera-policy'
import { ChefAvatar } from './agents/ChefAvatar'
import { WalkControlsGuide } from './walk/WalkControlsGuide'
import { WalkScene } from './walk/WalkScene'

export type CameraMode = 'perspective' | 'top'

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

type OrbitControlsState = { target: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }; update(): unknown }

function cameraPreset(mode: CameraMode, architecture: Pick<Architecture, 'widthMm' | 'depthMm' | 'wallHeightMm'>, aspect: number, fovDegrees = 43) {
  const width = architecture.widthMm / 1000
  const depth = architecture.depthMm / 1000
  const wallHeight = architecture.wallHeightMm / 1000
  const target: [number, number, number] = [width / 2, mode === 'top' ? 0 : Math.min(.72, wallHeight * .26), depth / 2]
  if (mode === 'top') {
    const halfFov = fovDegrees * Math.PI / 360
    const distance = Math.max(depth / (2 * Math.tan(halfFov)), width / (2 * Math.max(.25, aspect) * Math.tan(halfFov))) * 1.18
    return { position: [target[0], Math.max(6, distance), target[2]] as [number, number, number], target, up: [0, 0, -1] as [number, number, number] }
  }
  const span = Math.max(width, depth)
  return { position: [target[0] + span * .64, target[1] + span * .9, target[2] + span * .76] as [number, number, number], target, up: [0, 1, 0] as [number, number, number] }
}

function CameraRig({ mode, fitSignal, architecture }: { mode: CameraMode; fitSignal: number; architecture: Architecture }) {
  const { camera, controls, size } = useThree()
  const architectureKey = cameraArchitectureKey(architecture)
  const widthMm = architecture.widthMm
  const depthMm = architecture.depthMm
  const wallHeightMm = architecture.wallHeightMm
  useEffect(() => {
    const preset = cameraPreset(mode, { widthMm, depthMm, wallHeightMm }, size.width / Math.max(1, size.height))
    camera.position.set(...preset.position)
    camera.up.set(...preset.up)
    camera.lookAt(...preset.target)
    camera.updateProjectionMatrix()
    const orbitControls = controls as unknown as OrbitControlsState | null
    orbitControls?.target.set(...preset.target)
    orbitControls?.update()
  }, [architectureKey, camera, controls, depthMm, fitSignal, mode, size.height, size.width, wallHeightMm, widthMm])
  return null
}

function WebGLContextGuard({ onLost, onRestored }: { onLost(): void; onRestored(): void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => { event.preventDefault(); onLost() }
    const handleRestored = () => onRestored()
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [gl, onLost, onRestored])
  return null
}

function WalkCameraMemory({ active }: { active: boolean }) {
  const { camera, controls } = useThree()
  const wasActive = useRef(false)
  const saved = useRef<{ position: [number, number, number]; quaternion: [number, number, number, number]; target?: [number, number, number] } | undefined>(undefined)
  useEffect(() => {
    const orbit = controls as unknown as OrbitControlsState | null
    if (active && !wasActive.current) saved.current = {
      position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
      target: orbit ? [orbit.target.x, orbit.target.y, orbit.target.z] : undefined,
    }
    if (!active && wasActive.current && saved.current) {
      camera.position.fromArray(saved.current.position)
      camera.quaternion.fromArray(saved.current.quaternion)
      if (saved.current.target) orbit?.target.set(...saved.current.target)
      orbit?.update()
    }
    wasActive.current = active
  }, [active, camera, controls])
  return null
}

function WebGLKitchenRenderer({ project, variant, selectedIds, showClearances, wallsTransparent, walkMode, reducedMotion, playerPosition, cameraMode, fitSignal, onSelect, onClearSelection, onContextLost, onContextRestored, onWalkLockedChange, onWalkNearbyChange, onPlayerPositionChange }: SceneRendererProps) {
  const width = project.architecture.widthMm / 1000
  const depth = project.architecture.depthMm / 1000
  const span = Math.max(width, depth)
  return <Canvas
    shadows="basic"
    gl={{ alpha: false, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
    camera={{ position: [6.2, 6.8, 8.2], fov: 43, near: .05, far: 80 }}
    dpr={[1, 1.5]}
  >
    <WebGLContextGuard onLost={onContextLost} onRestored={onContextRestored} />
    <CameraRig mode={cameraMode} fitSignal={fitSignal} architecture={project.architecture} />
    <WalkCameraMemory active={walkMode} />
    <KitchenScene project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} wallsTransparent={wallsTransparent} onSelect={onSelect} onClearSelection={onClearSelection} />
    <WalkScene active={walkMode} architecture={project.architecture} equipment={variant.equipment} reducedMotion={reducedMotion} onLockedChange={onWalkLockedChange} onNearbyChange={onWalkNearbyChange} onPositionChange={onPlayerPositionChange} />
    {!walkMode && playerPosition && <group position={[playerPosition.x / 1000, 0, playerPosition.y / 1000]}><ChefAvatar player reducedMotion={reducedMotion} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPosition.x, yMm: playerPosition.y, state: 'waiting', headingRad: 0, moving: false }} /></group>}
    <OrbitControls makeDefault enabled={!walkMode} target={[width / 2, .7, depth / 2]} minDistance={2.2} maxDistance={Math.max(18, span * 3)} maxPolarAngle={Math.PI / 2.02} enableDamping />
  </Canvas>
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
