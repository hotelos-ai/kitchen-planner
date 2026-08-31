import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { EquipmentItem } from '../../domain/project'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { KitchenScene } from './KitchenScene'

export type SceneRendererProps = {
  items: EquipmentItem[]
  onSelect(id: string): void
}

type Props = {
  store?: ProjectStore
  renderer?: ComponentType<SceneRendererProps>
  compact?: boolean
}

type CameraMode = 'perspective' | 'top'

function CameraRig({ mode, fitSignal }: { mode: CameraMode; fitSignal: number }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(mode === 'top' ? 1.95 : 6.2, mode === 'top' ? 9 : 6.8, mode === 'top' ? 3.325 : 8.2)
    camera.up.set(0, mode === 'top' ? 0 : 1, mode === 'top' ? -1 : 0)
    camera.lookAt(1.95, 0, 3.325)
    camera.updateProjectionMatrix()
  }, [camera, fitSignal, mode])
  return null
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
  const [cameraMode, setCameraMode] = useState<CameraMode>('perspective')
  const [fitSignal, setFitSignal] = useState(0)
  const select = (id: string) => store.getState().selectItems([id])

  if (Renderer) return <Renderer items={variant.equipment} onSelect={select} />

  return (
    <section className={`scene-workspace${compact ? ' compact' : ''}`} aria-label="3D kitchen workspace">
      <div className="scene-toolbar">
        <div><span className="eyebrow">Active layout</span><strong>{variant.name}</strong></div>
        <div className="scene-actions">
          <button type="button" aria-pressed={cameraMode === 'perspective'} onClick={() => setCameraMode('perspective')}>Perspective</button>
          <button type="button" aria-pressed={cameraMode === 'top'} onClick={() => setCameraMode('top')}>Top</button>
          <button type="button" onClick={() => setFitSignal((value) => value + 1)}>Fit room</button>
          <button type="button" aria-pressed={showClearances} onClick={() => setShowClearances((value) => !value)}>Clearances</button>
        </div>
      </div>
      <div className="scene-canvas" data-testid="kitchen-scene">
        <SceneErrorBoundary>
          <Canvas shadows gl={{ alpha: false, antialias: true, preserveDrawingBuffer: true }} camera={{ position: [6.2, 6.8, 8.2], fov: 43, near: .05, far: 80 }} dpr={[1, 2]}>
            <CameraRig mode={cameraMode} fitSignal={fitSignal} />
            <KitchenScene project={project} variant={variant} selectedIds={selectedIds} showClearances={showClearances} onSelect={select} onClearSelection={() => store.getState().clearSelection()} />
            <OrbitControls makeDefault target={[1.95, .7, 3.325]} minDistance={2.2} maxDistance={18} maxPolarAngle={Math.PI / 2.02} enableDamping />
          </Canvas>
        </SceneErrorBoundary>
      </div>
      <div className="scene-legend"><span><i className="cooking" /> Cooking</span><span><i className="cold" /> Cold</span><span><i className="wash" /> Washing</span><span>Drag to orbit · Shift-drag to pan · Scroll to zoom</span></div>
    </section>
  )
}
