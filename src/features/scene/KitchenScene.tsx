import { Environment, Grid, Lightformer } from '@react-three/drei'
import type { KitchenProject, LayoutVariant } from '../../domain/project'
import { ArchitectureMesh } from './ArchitectureMesh'
import { Clearances } from './Clearances'
import { EquipmentMesh } from './EquipmentMesh'

type Props = {
  project: KitchenProject
  variant: LayoutVariant
  selectedIds: string[]
  showClearances: boolean
  wallsTransparent: boolean
  showLabels?: boolean
  onSelect(id: string): void
  onClearSelection(): void
}

// Configuration changes can alter the entire procedural model while preserving
// the component id. Give that model its own lifecycle so React Three Fiber never
// retains geometry or materials from the previous configuration.
function equipmentSceneKey(item: LayoutVariant['equipment'][number]): string {
  return [
    item.id,
    item.category,
    item.configurationPreset ?? 'custom',
    item.visualPreset ?? 'generic',
    item.appearanceSkinId ?? 'default',
    item.accessFlow?.inputFace ?? '',
    item.accessFlow?.outputFace ?? '',
  ].join(':')
}

// eslint-disable-next-line react-refresh/only-export-components
export const resolveSceneArchitecture = (variant: LayoutVariant) => variant.architecture

export function KitchenScene({ project, variant, selectedIds, showClearances, wallsTransparent, showLabels = true, onSelect, onClearSelection }: Props) {
  const architecture = resolveSceneArchitecture(variant)
  return (
    <>
      <color attach="background" args={['#eceade']} />
      <hemisphereLight args={['#fffaf0', '#69736e', .86]} />
      <ambientLight intensity={.34} />
      <directionalLight position={[3, 8, 4]} color="#fff1d4" intensity={2.45} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-near={1} shadow-camera-far={18} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <Environment resolution={64}>
        <Lightformer form="rect" color="#fff6df" intensity={2.8} position={[0, 5, -4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" color="#b7d5d0" intensity={1.35} position={[-4, 2.5, 3]} rotation={[0, Math.PI / 2, 0]} scale={[5, 1.5, 1]} />
      </Environment>
      <group onPointerMissed={onClearSelection}>
        <ArchitectureMesh architecture={architecture} wallsTransparent={wallsTransparent} showLabels={showLabels} />
        {variant.equipment.map((item) => <EquipmentMesh key={equipmentSceneKey(item)} item={item} selected={selectedIds.includes(item.id)} wallHeightMm={architecture.wallHeightMm} showLabels={showLabels} onSelect={onSelect} />)}
        <Clearances items={variant.equipment} architecture={architecture} displayUnit={project.displayUnit} visible={showClearances} showLabels={showLabels} />
        <Grid args={[12, 12]} position={[1.95, -.006, 3.325]} cellSize={.1} cellThickness={.25} cellColor="#9ea9a5" sectionSize={1} sectionThickness={.8} sectionColor="#6e7f79" fadeDistance={14} infiniteGrid />
      </group>
    </>
  )
}
