import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { projectStore, type ProjectStore } from '../../state/project-store'
import { EquipmentInspector } from './EquipmentInspector'
import { EquipmentLibrary } from './EquipmentLibrary'
import { LayoutVariants } from './LayoutVariants'
import { PlanCanvas } from './PlanCanvas'
import { ProjectSettings } from './ProjectSettings'

type Props = {
  store?: ProjectStore
  showCanvas?: boolean
}

const isTextEntry = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement

export function PlanWorkspace({ store = projectStore, showCanvas = typeof ResizeObserver !== 'undefined' }: Props) {
  const [showReference, setShowReference] = useState(false)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const canUndo = useStore(store, (state) => state.past.length > 0)
  const canRedo = useStore(store, (state) => state.future.length > 0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return
      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? store.getState().redo() : store.getState().undo()
        return
      }
      if (command && event.key.toLowerCase() === 'd' && selectedIds[0]) {
        event.preventDefault(); store.getState().duplicateItem(selectedIds[0]); return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
        event.preventDefault(); store.getState().removeItems(selectedIds); return
      }
      if (event.key === 'Escape') { store.getState().clearSelection(); return }
      const amount = event.shiftKey ? 10 : store.getState().project.snapMm
      const deltas: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -amount, y: 0 }, ArrowRight: { x: amount, y: 0 }, ArrowUp: { x: 0, y: -amount }, ArrowDown: { x: 0, y: amount },
      }
      if (selectedIds.length && deltas[event.key]) { event.preventDefault(); store.getState().nudgeItems(selectedIds, deltas[event.key]) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, store])

  return (
    <section className="plan-workspace">
      <div className="workspace-toolbar">
        <LayoutVariants store={store} />
        <div className="toolbar-actions">
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={() => store.getState().undo()}>↶ Undo</button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={() => store.getState().redo()}>↷ Redo</button>
          <button type="button" aria-pressed={showReference} onClick={() => setShowReference((value) => !value)}>Source reference</button>
          <button type="button" onClick={() => selectedIds.length && store.getState().rotateItems(selectedIds)}>Rotate 90°</button>
        </div>
      </div>
      <div className="editor-layout">
        <EquipmentLibrary store={store} />
        <div className="canvas-column">
          <div className="canvas-status"><span>10 cm source grid</span><span>Architecture locked by default</span><span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select equipment to edit'}</span></div>
          {showCanvas ? <PlanCanvas store={store} showReference={showReference} /> : <div className="test-canvas-placeholder" />}
        </div>
        <div className="right-panel"><EquipmentInspector store={store} /><ProjectSettings store={store} /></div>
      </div>
    </section>
  )
}
