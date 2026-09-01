import { Grid } from '@react-three/drei'
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
  onSelect(id: string): void
  onClearSelection(): void
}

export function KitchenScene({ project, variant, selectedIds, showClearances, wallsTransparent, onSelect, onClearSelection }: Props) {
  return (
    <group onPointerMissed={onClearSelection}>
      <color attach="background" args={['#e8e4da']} />
      <hemisphereLight args={['#fffaf0', '#69736e', 1.65]} />
      <ambientLight intensity={.72} />
      <directionalLight position={[3, 8, 4]} intensity={2.15} castShadow shadow-mapSize={[512, 512]} shadow-camera-near={1} shadow-camera-far={18} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <ArchitectureMesh architecture={project.architecture} wallsTransparent={wallsTransparent} />
      {variant.equipment.map((item) => <EquipmentMesh key={item.id} item={item} selected={selectedIds.includes(item.id)} wallHeightMm={project.architecture.wallHeightMm} onSelect={onSelect} />)}
      <Clearances items={variant.equipment} architecture={project.architecture} displayUnit={project.displayUnit} visible={showClearances} />
      <Grid args={[12, 12]} position={[1.95, -.006, 3.325]} cellSize={.1} cellThickness={.25} cellColor="#9ea9a5" sectionSize={1} sectionThickness={.8} sectionColor="#6e7f79" fadeDistance={14} infiniteGrid />
    </group>
  )
}
