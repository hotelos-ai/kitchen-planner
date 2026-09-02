import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import type { KitchenProject, LayoutVariant } from '../../domain/project'
import { exportProject } from '../../state/persistence'
import type { ProjectStore } from '../../state/project-store'

export type ClosedLayout = {
  id: string
  name: string
  revision: number
  undo(): boolean
}

type Props = {
  store: ProjectStore
  formatTabLabel?(variant: LayoutVariant, isActive: boolean): string
  onAdd?(): void
  onClosed?(layout: ClosedLayout): void
  onOpenRevisions?(): void
  onCompare?(): void
  onGenerateAlternatives?(): void
}

type RenameState = { id: string; draft: string }

function downloadLayout(project: KitchenProject, variant: LayoutVariant) {
  const payload: KitchenProject = {
    ...structuredClone(project),
    variants: [structuredClone(variant)],
    activeVariantId: variant.id,
    architecture: structuredClone(variant.architecture),
  }
  const blob = new Blob([exportProject(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${variant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function LayoutVariants({ store, formatTabLabel, onAdd, onClosed, onOpenRevisions, onCompare, onGenerateAlternatives }: Props) {
  const project = useStore(store, (state) => state.project)
  const [rename, setRename] = useState<RenameState | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const tabs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusId = useRef<string | null>(null)

  useLayoutEffect(() => {
    const id = pendingFocusId.current
    if (!id || rename) return
    pendingFocusId.current = null
    tabs.current.get(id)?.focus()
  }, [project, rename])

  const labelFor = (variant: LayoutVariant, active: boolean) => formatTabLabel?.(variant, active) ?? variant.name

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
    const result = store.getState().applyWorkspaceOperations([
      { type: 'remove_layout', variantId: id },
      { type: 'activate_layout', variantId: nearest.id },
    ], 'Close layout')
    if (!result.ok) {
      pendingFocusId.current = null
      return
    }
    store.getState().clearSelection()
    const revision = store.getState().revision
    onClosed?.({
      id: closing.id,
      name: closing.name,
      revision,
      undo: () => {
        if (store.getState().revision !== revision) return false
        store.getState().undo()
        return true
      },
    })
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

  const duplicateLayout = (variant: LayoutVariant) => {
    store.getState().activateVariant(variant.id)
    const id = store.getState().createVariant(`${variant.name} copy`)
    pendingFocusId.current = id
    store.getState().activateVariant(id)
    setMenuId(null)
  }

  const emptyLayout = () => {
    const id = store.getState().createEmptyVariant(`Empty layout ${project.variants.length + 1}`)
    pendingFocusId.current = id
    store.getState().activateVariant(id)
    setAddMenuOpen(false)
  }

  return (
    <div className="variant-controls">
      <div className="layout-tab-strip" role="tablist" aria-label="Layout variants">
        {project.variants.map((variant, index) => {
          const active = variant.id === project.activeVariantId
          const editing = rename?.id === variant.id
          const tabLabel = labelFor(variant, active)
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
                  {tabLabel}
                </button>
              )}
              <button
                type="button"
                className="layout-tab-menu"
                aria-label={`${variant.name} actions`}
                aria-expanded={menuId === variant.id}
                onClick={() => setMenuId((current) => current === variant.id ? null : variant.id)}
              >
                ⋮
              </button>
              {menuId === variant.id && (
                <div className="layout-tab-popover" role="menu" aria-label={`${variant.name} actions`}>
                  <button type="button" role="menuitem" onClick={() => { setRename({ id: variant.id, draft: variant.name }); setMenuId(null) }}>Rename</button>
                  <button type="button" role="menuitem" onClick={() => duplicateLayout(variant)}>Duplicate</button>
                  <button type="button" role="menuitem" onClick={() => { store.getState().activateVariant(variant.id); store.getState().addNamedCheckpoint(`Named: ${variant.name}`); setMenuId(null) }}>Create named checkpoint</button>
                  <button type="button" role="menuitem" onClick={() => { store.getState().activateVariant(variant.id); setMenuId(null); onOpenRevisions?.() }}>Revision history</button>
                  <button type="button" role="menuitem" onClick={() => { store.getState().activateVariant(variant.id); setMenuId(null); onCompare?.() }}>Compare</button>
                  <button type="button" role="menuitem" onClick={() => { downloadLayout(project, variant); setMenuId(null) }}>Export this layout</button>
                  <button type="button" role="menuitem" onClick={() => { close(variant.id); setMenuId(null) }} disabled={project.variants.length <= 1}>Delete</button>
                </div>
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
      <div className="layout-add-wrap">
        <button type="button" className="layout-tab-add" aria-label="New layout" aria-expanded={addMenuOpen} title="Add a layout alternative" onClick={() => setAddMenuOpen((open) => !open)}>＋</button>
        {addMenuOpen && (
          <div className="layout-tab-popover layout-add-popover" role="menu" aria-label="New layout">
            <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); add() }}>Duplicate current layout</button>
            <button type="button" role="menuitem" onClick={emptyLayout}>Create empty layout</button>
            <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); onGenerateAlternatives?.() }} disabled={!onGenerateAlternatives}>Generate alternatives</button>
            <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); add() }}>Import layout from another project</button>
          </div>
        )}
      </div>
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
