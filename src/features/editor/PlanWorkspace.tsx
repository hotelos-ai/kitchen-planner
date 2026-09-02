import { useState } from 'react'
import { useStore } from 'zustand'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { EquipmentInspector } from './EquipmentInspector'
import { EquipmentLibrary } from './EquipmentLibrary'
import { EssentialsChecker } from './EssentialsChecker'
import { LayoutVariants } from './LayoutVariants'
import { LayoutWizard } from './LayoutWizard'
import { LayoutDiagnostics } from './LayoutDiagnostics'
import { PlanCanvas } from './PlanCanvas'
import { ProjectSettings } from './ProjectSettings'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'

type Props = {
  store?: ProjectStore
  showCanvas?: boolean
  compact?: boolean
  shortcutEnabled?: boolean
  onInspectComponentIn3D?(itemId: string): void
}

const drawersInitiallyOpen = () => typeof globalThis.matchMedia !== 'function' || !globalThis.matchMedia('(max-width: 760px)').matches

const duplicateId = (sourceId: string, index: number) => `${sourceId}-copy-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}-${index + 1}`

export function PlanWorkspace({ store = projectStore, showCanvas = typeof ResizeObserver !== 'undefined', compact = false, shortcutEnabled = true, onInspectComponentIn3D }: Props) {
  const [showReference, setShowReference] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(drawersInitiallyOpen)
  const [inspectorOpen, setInspectorOpen] = useState(drawersInitiallyOpen)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStartsAtRoom, setWizardStartsAtRoom] = useState(false)
  const [essentialsOpen, setEssentialsOpen] = useState(false)
  const [closedLayout, setClosedLayout] = useState<{ name: string; revision: number; undo(): boolean } | null>(null)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const revision = useStore(store, (state) => state.revision)
  const canUndo = useStore(store, (state) => state.past.length > 0)
  const canRedo = useStore(store, (state) => state.future.length > 0)
  const selectedItem = useStore(store, (state) => getActiveVariant(state).equipment.find((item) => item.id === state.selectedIds[0]))
  const dragResizeEnabled = Boolean(selectedItem && !selectedItem.dimensionsLocked)

  useWorkspaceShortcuts({
    enabled: shortcutEnabled,
    selectedIds,
    getSnapMm: () => store.getState().project.snapMm,
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    duplicate: (ids) => {
      const variantId = store.getState().project.activeVariantId
      const components = ids.map((componentId, index) => ({ componentId, duplicateId: duplicateId(componentId, index) }))
      const result = store.getState().applyWorkspaceOperations([{ type: 'duplicate_components', variantId, components }], 'Duplicate components')
      if (result.ok) store.getState().selectItems(components.map((component) => component.duplicateId))
    },
    remove: (ids) => store.getState().removeItems(ids),
    nudge: (ids, delta) => store.getState().nudgeItems(ids, delta),
    rotate: (ids, deltaDeg) => store.getState().rotateItems(ids, deltaDeg),
    clearSelection: () => store.getState().clearSelection(),
    onEscape: () => {
      if (essentialsOpen) { setEssentialsOpen(false); return true }
      if (wizardOpen) { setWizardOpen(false); setWizardStartsAtRoom(false); return true }
      if (closedLayout) { setClosedLayout(null); return true }
      return false
    },
  })

  return (
    <>
    <section className={`plan-workspace${compact ? ' compact' : ''}`} aria-label="2D plan workspace">
      {!compact && <div key="toolbar" className="workspace-toolbar">
        <LayoutVariants store={store} onAdd={() => { setWizardStartsAtRoom(false); setWizardOpen(true) }} onClosed={(closed) => setClosedLayout(closed)} />
        <div className="toolbar-actions">
          <button type="button" aria-label="Toggle equipment catalog" aria-pressed={catalogOpen} onClick={() => setCatalogOpen((open) => !open)}>Catalog</button>
          <button type="button" aria-label="Toggle inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>Inspector</button>
          <button type="button" onClick={() => setEssentialsOpen(true)}>Check essentials</button>
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={() => store.getState().undo()}>↶ Undo</button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={() => store.getState().redo()}>↷ Redo</button>
          <button type="button" aria-pressed={showReference} onClick={() => setShowReference((value) => !value)}>Source reference</button>
          <span className="transform-actions" role="group" aria-label="Selected item transforms">
            <button type="button" className="icon-action" aria-label="Rotate selected left 90 degrees" title="Rotate left 90°" disabled={!selectedIds.length} onClick={() => store.getState().rotateItems(selectedIds, -90)}><b aria-hidden="true">↶</b><small>Left</small></button>
            <button type="button" className="icon-action" aria-label="Rotate selected right 90 degrees" title="Rotate right 90°" disabled={!selectedIds.length} onClick={() => store.getState().rotateItems(selectedIds, 90)}><b aria-hidden="true">↷</b><small>Right</small></button>
            <button type="button" className="icon-action resize-action" aria-label={dragResizeEnabled ? 'Disable drag resize' : 'Enable drag resize'} title={dragResizeEnabled ? 'Lock dimensions' : 'Enable click-and-drag resize handles'} aria-pressed={dragResizeEnabled} disabled={!selectedItem} onClick={() => selectedItem && store.getState().setDimensionsLocked(selectedItem.id, !selectedItem.dimensionsLocked)}><b aria-hidden="true">↔</b><small>{dragResizeEnabled ? 'Lock' : 'Resize'}</small></button>
          </span>
        </div>
      </div>}
      <div key="editor" className={`editor-layout${catalogOpen ? '' : ' catalog-collapsed'}${inspectorOpen ? '' : ' inspector-collapsed'}`}>
        {!compact && <div key="library" className="editor-drawer catalog-drawer" data-editor-drawer="catalog" aria-hidden={!catalogOpen}><EquipmentLibrary store={store} /></div>}
        <div key="canvas" className="canvas-column">
          <div className="canvas-status">
            <span>{compact ? '2D plan · 10 cm grid' : '10 cm source grid'}</span>
            {!compact && <span>Architecture locked by default</span>}
            <span>{selectedIds.length ? `${selectedIds.length} selected` : compact ? 'Select equipment' : 'Select equipment to edit'}</span>
          </div>
          {showCanvas ? <PlanCanvas store={store} showReference={compact ? false : showReference} onInspectComponentIn3D={onInspectComponentIn3D} /> : <div className="test-canvas-placeholder" />}
        </div>
        {!compact && <div key="inspector" className="editor-drawer right-panel inspector-drawer" data-editor-drawer="inspector" aria-hidden={!inspectorOpen}><EquipmentInspector store={store} /><LayoutDiagnostics store={store} /><ProjectSettings store={store} /></div>}
      </div>
    </section>
    {!compact && closedLayout && <div className="workspace-toast" role="status"><span>{closedLayout.name} closed.</span><button type="button" aria-label={`Undo close ${closedLayout.name}`} disabled={revision !== closedLayout.revision} title={revision === closedLayout.revision ? 'Restore the closed layout' : 'Undo is unavailable after another edit'} onClick={() => { if (closedLayout.undo()) setClosedLayout(null) }}>Undo</button><button type="button" aria-label="Dismiss closed layout message" onClick={() => setClosedLayout(null)}>×</button></div>}
    {!compact && wizardOpen && <LayoutWizard
      store={store}
      initialStep={wizardStartsAtRoom ? 1 : 0}
      initialMode={wizardStartsAtRoom ? 'polygon' : 'duplicate'}
      onClose={() => { setWizardOpen(false); setWizardStartsAtRoom(false) }}
    />}
    {!compact && essentialsOpen && <div className="workspace-modal-backdrop">
      <section className="essentials-dialog" role="dialog" aria-modal="true" aria-label="Check essentials">
        <button type="button" className="workspace-modal-close" aria-label="Close essentials checker" onClick={() => setEssentialsOpen(false)}>×</button>
        <EssentialsChecker store={store} onEditRoom={() => {
          setEssentialsOpen(false)
          setWizardStartsAtRoom(true)
          setWizardOpen(true)
        }} />
      </section>
    </div>}
    </>
  )
}
