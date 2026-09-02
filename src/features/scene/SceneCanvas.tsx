import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Architecture } from '../../domain/project'
import { cameraArchitectureKey } from './camera-policy'

export type CameraMode = 'perspective' | 'top'
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
  const { widthMm, depthMm, wallHeightMm } = architecture
  useEffect(() => {
    const preset = cameraPreset(mode, { widthMm, depthMm, wallHeightMm }, size.width / Math.max(1, size.height))
    camera.position.set(...preset.position)
    camera.up.set(...preset.up)
    camera.lookAt(...preset.target)
    camera.updateProjectionMatrix()
    const orbit = controls as unknown as OrbitControlsState | null
    orbit?.target.set(...preset.target)
    orbit?.update()
  }, [architectureKey, camera, controls, depthMm, fitSignal, mode, size.height, size.width, wallHeightMm, widthMm])
  return null
}

export function WebGLContextGuard({ onLost, onRestored }: { onLost(): void; onRestored(): void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => { event.preventDefault(); onLost() }
    const handleRestored = () => onRestored()
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)
    return () => { canvas.removeEventListener('webglcontextlost', handleLost); canvas.removeEventListener('webglcontextrestored', handleRestored) }
  }, [gl, onLost, onRestored])
  return null
}

function WalkCameraMemory({ active }: { active: boolean }) {
  const { camera, controls } = useThree()
  const wasActive = useRef(false)
  const saved = useRef<{ position: [number, number, number]; quaternion: [number, number, number, number]; target?: [number, number, number] } | undefined>(undefined)
  useEffect(() => {
    const orbit = controls as unknown as OrbitControlsState | null
    if (active && !wasActive.current) saved.current = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: orbit ? [orbit.target.x, orbit.target.y, orbit.target.z] : undefined }
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

export function SceneCanvas({ architecture, cameraMode, fitSignal, walkMode = false, onContextLost, onContextRestored, children }: {
  architecture: Architecture
  cameraMode: CameraMode
  fitSignal: number
  walkMode?: boolean
  onContextLost(): void
  onContextRestored(): void
  children: ReactNode
}) {
  const width = architecture.widthMm / 1000
  const depth = architecture.depthMm / 1000
  const span = Math.max(width, depth)
  return <Canvas shadows="basic" gl={{ alpha: false, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }} camera={{ position: [6.2, 6.8, 8.2], fov: 43, near: .05, far: 80 }} dpr={[1, 1.5]}>
    <WebGLContextGuard onLost={onContextLost} onRestored={onContextRestored} />
    <CameraRig mode={cameraMode} fitSignal={fitSignal} architecture={architecture} />
    <WalkCameraMemory active={walkMode} />
    {children}
    <OrbitControls makeDefault enabled={!walkMode} target={[width / 2, .7, depth / 2]} minDistance={2.2} maxDistance={Math.max(18, span * 3)} maxPolarAngle={Math.PI / 2.02} enableDamping />
  </Canvas>
}
