import { Environment, Grid } from '@react-three/drei'
import type { KitchenProject, LayoutVariant } from '../../domain/project'
import { ArchitectureMesh } from './ArchitectureMesh'
import { Clearances } from './Clearances'
import { EquipmentMesh } from './EquipmentMesh'

type Props = {
  project: KitchenProject
  variant: LayoutVariant
  selectedIds: string[]
  showClearances: boolean
  onSelect(id: string): void
  onClearSelection(): void
}

export function KitchenScene({ project, variant, selectedIds, showClearances, onSelect, onClearSelection }: Props) {
  return (
    <group onPointerMissed={onClearSelection}>
      <color attach="background" args={['#e8e4da']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 8, 4]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <ArchitectureMesh architecture={project.architecture} />
      {variant.equipment.map((item) => <EquipmentMesh key={item.id} item={item} selected={selectedIds.includes(item.id)} wallHeightMm={project.architecture.wallHeightMm} onSelect={onSelect} />)}
      <Clearances items={variant.equipment} architecture={project.architecture} visible={showClearances} />
      <Grid args={[12, 12]} position={[1.95, -.006, 3.325]} cellSize={.1} cellThickness={.25} cellColor="#9ea9a5" sectionSize={1} sectionThickness={.8} sectionColor="#6e7f79" fadeDistance={14} infiniteGrid />
      <Environment preset="warehouse" environmentIntensity={.35} />
    </group>
  )
}
