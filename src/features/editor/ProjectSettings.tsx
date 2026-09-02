import { useStore } from 'zustand'
import type { DisplayUnit } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'

type Props = { store: ProjectStore }

export function ProjectSettings({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  return (
    <div className="project-settings">
      <label>Display units
        <select aria-label="Display units" value={project.displayUnit} onChange={(event) => store.getState().setDisplayUnit(event.target.value as DisplayUnit)}>
          <option value="mm">Millimetres</option><option value="cm">Centimetres</option><option value="in">Inches</option><option value="ft">Feet + inches</option>
        </select>
      </label>
      <label>Snap interval
        <select aria-label="Snap interval" value={project.snapMm} onChange={(event) => store.getState().setSnapMm(Number(event.target.value))}>
          <option value="10">10 mm</option><option value="50">50 mm</option><option value="100">100 mm</option><option value="250">250 mm</option>
        </select>
      </label>
      <label className="checkbox-row"><input type="checkbox" checked={variant.architecture.locked} onChange={(event) => store.getState().setArchitectureLocked(event.target.checked)} />Lock architecture</label>
    </div>
  )
}
