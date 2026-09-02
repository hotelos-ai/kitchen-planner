import { useStore } from 'zustand'
import { createCheckpoint } from '../../domain/layout-checkpoints'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export function RevisionHistory({ store }: { store: ProjectStore }) {
  const revision = useStore(store, (state) => state.revision)
  const variant = useStore(store, getActiveVariant)
  const checkpoints = [...(variant.checkpoints ?? [])].sort((left, right) => right.revision - left.revision)

  return (
    <section className="revision-history" aria-label={`Revision history — ${variant.name}`}>
      <div className="panel-heading">
        <span className="eyebrow">History</span>
        <h2>Revision history — {variant.name}</h2>
      </div>
      <p>Undo is for immediate edits. Named checkpoints keep a durable copy of this layout.</p>
      <ol className="revision-list">
        <li>
          <strong>Rev {revision}</strong>
          <span>Current</span>
        </li>
        {checkpoints.map((checkpoint) => (
          <li key={checkpoint.id}>
            <strong>Rev {checkpoint.revision}</strong>
            <span>{checkpoint.label}</span>
            <button type="button" onClick={() => store.getState().restoreCheckpoint(checkpoint.id)}>Restore as new revision</button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="primary-button"
        onClick={() => store.getState().addNamedCheckpoint(`Named: checkpoint ${checkpoints.length + 1}`)}
      >
        Create named checkpoint
      </button>
    </section>
  )
}

export { createCheckpoint }
