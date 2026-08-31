import { useStore } from 'zustand'
import type { ProjectStore } from '../../state/project-store'

type Props = { store: ProjectStore }

export function LayoutVariants({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const create = () => {
    const id = store.getState().createVariant(`Layout option ${project.variants.length + 1}`)
    store.getState().activateVariant(id)
  }
  return (
    <div className="variant-controls">
      <label>Active layout variant
        <select aria-label="Active layout variant" value={project.activeVariantId} onChange={(event) => store.getState().activateVariant(event.target.value)}>
          {project.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={create}>＋ New variant</button>
      <button type="button" disabled={project.variants.length <= 1} onClick={() => store.getState().deleteVariant(project.activeVariantId)}>Delete variant</button>
    </div>
  )
}
