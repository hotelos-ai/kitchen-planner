import { useStore } from 'zustand'
import { createCheckpoint } from '../../domain/layout-checkpoints'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

export function RevisionHistory({ store }: { store: ProjectStore }) {
  const revision = useStore(store, (state) => state.revision)
  const variant = useStore(store, getActiveVariant)
  const checkpoints = [...(variant.checkpoints ?? [])].sort((left, right) => right.revision - left.revision)
  const agentActions = useStore(store, (state) => state.revisionEntries)
    .filter((entry) => entry.author === 'agent' && entry.variantIds.includes(variant.id))
    .sort((left, right) => right.revision - left.revision)

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
        {agentActions.map((action) => (
          <li className="agent-revision-entry" key={`agent-${action.revision}`}>
            <strong>Rev {action.revision} <span className="agent-revision-badge">Agent</span></strong>
            <span>{action.intent}</span>
            {action.changedIds.length > 0 && <small>{action.changedIds.length} item{action.changedIds.length === 1 ? '' : 's'} changed</small>}
          </li>
        ))}
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
