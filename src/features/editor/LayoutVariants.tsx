import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import type { ProjectStore } from '../../state/project-store'

export type ClosedLayout = {
  id: string
  name: string
  undo(): void
}

type Props = {
  store: ProjectStore
  onAdd?(): void
  onClosed?(layout: ClosedLayout): void
}

type RenameState = { id: string; draft: string }

export function LayoutVariants({ store, onAdd, onClosed }: Props) {
  const project = useStore(store, (state) => state.project)
  const [rename, setRename] = useState<RenameState | null>(null)
  const tabs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusId = useRef<string | null>(null)

  useLayoutEffect(() => {
    const id = pendingFocusId.current
    if (!id || rename) return
    pendingFocusId.current = null
    tabs.current.get(id)?.focus()
  }, [project, rename])

  const activate = (id: string) => {
    if (id !== project.activeVariantId) store.getState().activateVariant(id)
  }

  const focusAndActivate = (id: string) => {
    activate(id)
    tabs.current.get(id)?.focus()
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = project.variants.length - 1
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = lastIndex
    if (nextIndex !== undefined) {
      event.preventDefault()
      focusAndActivate(project.variants[nextIndex].id)
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      const variant = project.variants[index]
      setRename({ id: variant.id, draft: variant.name })
    }
  }

  const finishRename = (commit: boolean) => {
    if (!rename) return
    const variant = project.variants.find((candidate) => candidate.id === rename.id)
    if (commit && variant) store.getState().renameVariant(rename.id, rename.draft.trim() || variant.name)
    pendingFocusId.current = rename.id
    setRename(null)
  }

  const close = (id: string) => {
    if (project.variants.length <= 1) return
    const index = project.variants.findIndex((variant) => variant.id === id)
    const closing = project.variants[index]
    if (!closing) return
    const nearest = project.variants[index + 1] ?? project.variants[index - 1]
    pendingFocusId.current = nearest?.id ?? null
    store.getState().deleteVariant(id)
    if (store.getState().project.variants.some((variant) => variant.id === id)) {
      pendingFocusId.current = null
      return
    }
    onClosed?.({ id: closing.id, name: closing.name, undo: () => store.getState().undo() })
  }

  const add = () => {
    if (onAdd) {
      onAdd()
      return
    }
    const id = store.getState().createVariant(`Layout option ${project.variants.length + 1}`)
    pendingFocusId.current = id
    store.getState().activateVariant(id)
  }

  return (
    <div className="variant-controls">
      <div className="layout-tab-strip" role="tablist" aria-label="Layout variants">
        {project.variants.map((variant, index) => {
          const active = variant.id === project.activeVariantId
          const editing = rename?.id === variant.id
          return (
            <div className={`layout-tab${active ? ' active' : ''}`} role="presentation" key={variant.id}>
              {editing ? (
                <input
                  autoFocus
                  className="layout-tab-rename"
                  aria-label={`Rename ${variant.name}`}
                  value={rename.draft}
                  onChange={(event) => setRename({ id: variant.id, draft: event.target.value })}
                  onBlur={() => finishRename(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); finishRename(true) }
                    if (event.key === 'Escape') { event.preventDefault(); finishRename(false) }
                  }}
                />
              ) : (
                <button
                  ref={(node) => { if (node) tabs.current.set(variant.id, node); else tabs.current.delete(variant.id) }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  className="layout-tab-label"
                  title="Double-click or press F2 to rename"
                  onClick={() => activate(variant.id)}
                  onDoubleClick={() => setRename({ id: variant.id, draft: variant.name })}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                >
                  {variant.name}
                </button>
              )}
              <button
                type="button"
                className="layout-tab-close"
                aria-label={`Close ${variant.name}`}
                title={project.variants.length <= 1 ? 'The last layout cannot be closed' : `Close ${variant.name}`}
                disabled={project.variants.length <= 1}
                onClick={() => close(variant.id)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="layout-tab-add" aria-label="New variant" title="Create a new layout" onClick={add}>＋</button>
      <select
        hidden
        tabIndex={-1}
        aria-label="Active layout variant"
        value={project.activeVariantId}
        onChange={(event) => activate(event.target.value)}
      >
        {project.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
      </select>
    </div>
  )
}
