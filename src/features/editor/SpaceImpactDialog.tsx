import { architectureAffectsMultipleLayouts, previewSharedArchitectureImpact } from '../../domain/space-impact'
import type { Architecture, KitchenProject } from '../../domain/project'

type Props = {
  project: KitchenProject
  nextArchitecture: Architecture
  onCancel(): void
  onApply(): void
}

export function SpaceImpactDialog({ project, nextArchitecture, onCancel, onApply }: Props) {
  const impacts = previewSharedArchitectureImpact(project, nextArchitecture)
  const layoutCount = project.variants.length
  return (
    <div className="workspace-modal-backdrop">
      <section className="essentials-dialog space-impact-dialog" role="dialog" aria-modal="true" aria-label="Space change impact">
        <h2>This wall is used by {layoutCount} kitchen layout{layoutCount === 1 ? '' : 's'}.</h2>
        <p>Applying this space change will affect:</p>
        <ul>
          {impacts.map((impact) => (
            <li key={impact.layoutId}>
              <strong>{impact.layoutName}</strong>
              {impact.conflicts.length ? (
                <ul>{impact.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
              ) : <span>No conflict</span>}
            </li>
          ))}
        </ul>
        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={onApply}>Apply and create checkpoint</button>
        </footer>
      </section>
    </div>
  )
}

export { architectureAffectsMultipleLayouts }
