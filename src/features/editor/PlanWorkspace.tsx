import { useState } from 'react'
import { useStore } from 'zustand'
import type { WorkflowStage } from '../../app/workflow'
import { StageToolbar } from '../../app/AppHeader'
import { getActiveVariant, projectStore, type ProjectStore } from '../../state/project-store'
import { CanvasFooter } from './CanvasFooter'
import { EquipmentInspector } from './EquipmentInspector'
import { EssentialsChecker } from './EssentialsChecker'
import { LayoutWizard } from './LayoutWizard'
import { LayoutDiagnostics } from './LayoutDiagnostics'
import { PlanCanvas } from './PlanCanvas'
import { ProjectSettings } from './ProjectSettings'
import { RevisionHistory } from './RevisionHistory'
import { SpaceImpactDialog } from './SpaceImpactDialog'
import { StageOverview } from './StageOverview'
import { AutoFixStrategyDialog } from './AutoFixStrategyDialog'
import { ValidationAutoFix } from './ValidationAutoFix'
import { RoomEditorPanel } from './RoomEditorPanel'
import type { PlacementSpec } from './room-outline'
import type { SpaceSelection } from './SpaceItemInspector'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'
import { WorkflowCatalog } from './WorkflowCatalog'

type Props = {
  store?: ProjectStore
  stage?: WorkflowStage
  showCanvas?: boolean
  compact?: boolean
  shortcutEnabled?: boolean
  showReference?: boolean
  catalogOpen?: boolean
  inspectorOpen?: boolean
  essentialsOpen?: boolean
  revisionsOpen?: boolean
  wizardOpen?: boolean
  wizardStartsAtRoom?: boolean
  closedLayout?: { name: string; revision: number; undo(): boolean } | null
  onInspectComponentIn3D?(itemId: string): void
  onStageChange?(stage: WorkflowStage): void
  onCatalogOpenChange?(open: boolean): void
  onInspectorOpenChange?(open: boolean): void
  onEssentialsOpenChange?(open: boolean): void
  onRevisionsOpenChange?(open: boolean): void
  sourceImageUrl?: string
  onSourceImageUrlChange?(url: string): void
  onWizardOpenChange?(open: boolean): void
  onWizardStartsAtRoomChange?(startsAtRoom: boolean): void
  onClosedLayoutChange?(layout: { name: string; revision: number; undo(): boolean } | null): void
  onAddLayout?(): void
  includeToolbar?: boolean
}

const drawersInitiallyOpen = () => typeof globalThis.matchMedia !== 'function' || !globalThis.matchMedia('(max-width: 760px)').matches

const duplicateId = (sourceId: string, index: number) => `${sourceId}-copy-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}-${index + 1}`

const DEFAULT_SOURCE_IMAGE_URL = '/reference/kitchen-sketch.webp'

type SourceReferencePopoverProps = {
  sourceOpacity: number
  sourceLocked: boolean
  onDisable(): void
  onOpacityChange(opacity: number): void
  onLockedChange(locked: boolean): void
  onSourceImageUrlChange(url: string): void
}

function SourceReferencePopover({ sourceOpacity, sourceLocked, onDisable, onOpacityChange, onLockedChange, onSourceImageUrlChange }: SourceReferencePopoverProps) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <div className="source-reference-popover" role="dialog" aria-label="Source reference">
      <strong>Source reference</strong>
      <label>On <input type="checkbox" checked onChange={() => { onDisable(); setOpen(false) }} /></label>
      <label>Opacity {sourceOpacity}% <input aria-label="Source opacity" type="range" min="10" max="80" value={sourceOpacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /></label>
      <label>Lock reference <input type="checkbox" checked={sourceLocked} onChange={(event) => onLockedChange(event.target.checked)} /></label>
      <label>Replace
        <input
          type="file"
          accept="image/*,application/pdf"
          aria-label="Replace source drawing"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onSourceImageUrlChange(URL.createObjectURL(file))
          }}
        />
      </label>
      <button type="button" onClick={() => onSourceImageUrlChange(DEFAULT_SOURCE_IMAGE_URL)}>Remove</button>
      <button type="button" onClick={() => setOpen(false)}>Close</button>
    </div>
  )
}

export function PlanWorkspace({
  store = projectStore,
  stage = 'equipment',
  showCanvas = typeof ResizeObserver !== 'undefined',
  compact = false,
  shortcutEnabled = true,
  showReference = false,
  catalogOpen = true,
  inspectorOpen = true,
  essentialsOpen = false,
  revisionsOpen = false,
  wizardOpen = false,
  wizardStartsAtRoom = false,
  closedLayout = null,
  onInspectComponentIn3D,
  onStageChange,
  onInspectorOpenChange,
  onEssentialsOpenChange,
  onRevisionsOpenChange,
  sourceImageUrl,
  onSourceImageUrlChange,
  onWizardOpenChange,
  onWizardStartsAtRoomChange,
  onClosedLayoutChange,
  onAddLayout,
  includeToolbar = false,
}: Props) {
  const [internalClosedLayout, setInternalClosedLayout] = useState<{ name: string; revision: number; undo(): boolean } | null>(null)
  const [internalWizardOpen, setInternalWizardOpen] = useState(false)
  const [internalWizardStartsAtRoom, setInternalWizardStartsAtRoom] = useState(false)
  const [internalEssentialsOpen, setInternalEssentialsOpen] = useState(false)
  const [internalRevisionsOpen, setInternalRevisionsOpen] = useState(false)
  const [autoFixStatus, setAutoFixStatus] = useState('')
  const [autoFixStrategyOpen, setAutoFixStrategyOpen] = useState(false)
  const [spaceImpactOpen, setSpaceImpactOpen] = useState(false)
  const [sourceOpacity, setSourceOpacity] = useState(35)
  const [sourceLocked, setSourceLocked] = useState(false)
  const [sourceImage, setSourceImage] = useState(() => ({ prop: sourceImageUrl, url: sourceImageUrl ?? DEFAULT_SOURCE_IMAGE_URL }))
  const [equipmentPromptOpen, setEquipmentPromptOpen] = useState(true)
  const [checksFocusId, setChecksFocusId] = useState<string | undefined>()
  const activeClosedLayout = closedLayout ?? internalClosedLayout
  const wizardVisible = wizardOpen || internalWizardOpen
  const wizardRoomStep = wizardStartsAtRoom || internalWizardStartsAtRoom
  const essentialsVisible = essentialsOpen || internalEssentialsOpen
  const revisionsVisible = revisionsOpen || internalRevisionsOpen

  if (sourceImage.prop !== sourceImageUrl) {
    setSourceImage({ prop: sourceImageUrl, url: sourceImageUrl || sourceImage.url })
  }

  const setLocalSourceUrl = (url: string) => {
    setSourceImage({ prop: sourceImageUrl, url })
    onSourceImageUrlChange?.(url)
  }

  const setEssentialsVisible = (open: boolean) => {
    setInternalEssentialsOpen(open)
    onEssentialsOpenChange?.(open)
    if (open) {
      setInternalRevisionsOpen(false)
      onRevisionsOpenChange?.(false)
    } else {
      setChecksFocusId(undefined)
    }
  }

  const setRevisionsVisible = (open: boolean) => {
    setInternalRevisionsOpen(open)
    onRevisionsOpenChange?.(open)
    if (open) {
      setInternalEssentialsOpen(false)
      onEssentialsOpenChange?.(false)
    }
  }

  const openChecksForItem = (itemId: string) => {
    setChecksFocusId(itemId)
    setEssentialsVisible(true)
  }

  const openLayoutWizard = (startsAtRoom = false) => {
    if (onAddLayout && !startsAtRoom) {
      onAddLayout()
      return
    }
    setInternalWizardStartsAtRoom(startsAtRoom)
    setInternalWizardOpen(true)
    onWizardStartsAtRoomChange?.(startsAtRoom)
    onWizardOpenChange?.(true)
  }

  const closeLayoutWizard = () => {
    setInternalWizardOpen(false)
    setInternalWizardStartsAtRoom(false)
    onWizardOpenChange?.(false)
    onWizardStartsAtRoomChange?.(false)
  }
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const revision = useStore(store, (state) => state.revision)
  const canUndo = useStore(store, (state) => state.past.length > 0)
  const canRedo = useStore(store, (state) => state.future.length > 0)
  const selectedItem = useStore(store, (state) => getActiveVariant(state).equipment.find((item) => item.id === state.selectedIds[0]))
  const dragResizeEnabled = Boolean(selectedItem && !selectedItem.dimensionsLocked)
  const [localReference, setLocalReference] = useState(showReference)
  const [placement, setPlacement] = useState<PlacementSpec | null>(null)
  const [spaceSelection, setSpaceSelection] = useState<SpaceSelection>(null)
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false)
  const [localCatalogOpen, setLocalCatalogOpen] = useState(includeToolbar ? drawersInitiallyOpen() : catalogOpen)
  const [localInspectorOpen, setLocalInspectorOpen] = useState(includeToolbar ? drawersInitiallyOpen() : inspectorOpen)

  const selectSpaceItem = (selection: SpaceSelection) => {
    setSpaceSelection(selection)
    if (!selection) return
    store.getState().clearSelection()
    if (compact) setCompactInspectorOpen(true)
    setLocalInspectorOpen(true)
    onInspectorOpenChange?.(true)
  }

  const referenceVisible = includeToolbar ? localReference : showReference
  const catalogVisible = includeToolbar ? localCatalogOpen : catalogOpen
  const inspectorVisible = (compact ? compactInspectorOpen : includeToolbar ? localInspectorOpen : inspectorOpen) || essentialsVisible || revisionsVisible

  const continueToEquipment = () => {
    const layouts = store.getState().project.variants.length
    if (stage === 'space' && layouts > 1) {
      setSpaceImpactOpen(true)
      return
    }
    onStageChange?.('equipment')
  }

  const editRoomForValidation = () => {
    setEssentialsVisible(false)
    openLayoutWizard(true)
    onStageChange?.('space')
  }
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
      if (autoFixStrategyOpen) { setAutoFixStrategyOpen(false); return true }
      if (essentialsVisible) { setEssentialsVisible(false); return true }
      if (internalRevisionsOpen || revisionsOpen) { setRevisionsVisible(false); return true }
      if (spaceImpactOpen) { setSpaceImpactOpen(false); return true }
      if (wizardVisible) { closeLayoutWizard(); return true }
      if (activeClosedLayout) { onClosedLayoutChange?.(null); setInternalClosedLayout(null); return true }
      return false
    },
  })

  const showInspectorContent = !selectedIds.length

  return (
    <>
      <section className={`plan-workspace${compact ? ' compact' : ''}`} aria-label="2D plan workspace">
        {includeToolbar && !compact && (
          <StageToolbar
            store={store}
            stage={stage}
            catalogOpen={catalogVisible}
            inspectorOpen={inspectorVisible}
            essentialsCount={0}
            showReference={referenceVisible}
            canUndo={canUndo}
            canRedo={canRedo}
            dragResizeEnabled={dragResizeEnabled}
            hasSelection={selectedIds.length > 0}
            onToggleCatalog={() => setLocalCatalogOpen((open) => !open)}
            onToggleInspector={() => setLocalInspectorOpen((open) => !open)}
            onAutoFix={() => setAutoFixStrategyOpen(true)}
            onOpenEssentials={() => setEssentialsVisible(true)}
            onOpenRevisions={() => setRevisionsVisible(true)}
            onUndo={() => store.getState().undo()}
            onRedo={() => store.getState().redo()}
            onToggleReference={() => setLocalReference((value) => !value)}
            onRotateLeft={() => store.getState().rotateItems(selectedIds, -90)}
            onRotateRight={() => store.getState().rotateItems(selectedIds, 90)}
            onToggleResize={() => selectedItem && store.getState().setDimensionsLocked(selectedItem.id, !selectedItem.dimensionsLocked)}
            onAddLayout={() => openLayoutWizard(false)}
            onClosedLayout={(closed) => {
              onClosedLayoutChange?.(closed)
              if (!onClosedLayoutChange) setInternalClosedLayout(closed)
            }}
          />
        )}
        <div className={`editor-layout${compact ? ' split-pane' : ''}${!compact && catalogVisible ? '' : ' catalog-collapsed'}${inspectorVisible ? '' : ' inspector-collapsed'}`}>
          {!compact && (
            <div className="editor-drawer catalog-drawer" data-editor-drawer="catalog" aria-hidden={!catalogVisible}>
              <WorkflowCatalog store={store} stage={stage} onBeginPlacement={setPlacement} />
            </div>
          )}
          <div className="canvas-column">
            {showCanvas ? (
              <PlanCanvas
                store={store}
                mode={stage === 'space' ? 'space' : 'layout'}
                placement={stage === 'space' ? placement : null}
                onPlacementDone={() => setPlacement(null)}
                selectedSpaceItem={spaceSelection}
                onSelectItem={selectSpaceItem}
                onEquipmentSelect={() => { if (compact) setCompactInspectorOpen(true) }}
                showReference={compact ? false : referenceVisible}
                sourceImageUrl={sourceImage.url}
                sourceOpacity={sourceOpacity}
                onInspectComponentIn3D={onInspectComponentIn3D}
                onWarningBadgeClick={openChecksForItem}
              />
            ) : (
              <div className="test-canvas-placeholder" />
            )}
            {referenceVisible && (
              <SourceReferencePopover
                sourceOpacity={sourceOpacity}
                sourceLocked={sourceLocked}
                onDisable={() => setLocalReference(false)}
                onOpacityChange={setSourceOpacity}
                onLockedChange={setSourceLocked}
                onSourceImageUrlChange={setLocalSourceUrl}
              />
            )}
            {stage === 'equipment' && equipmentPromptOpen && !compact && (
              <div className="equipment-start-prompt" role="note">
                <p>Add equipment from the catalog, or begin with a station template. Your room can still be edited from the Space stage.</p>
                <button type="button" onClick={() => setEquipmentPromptOpen(false)}>Dismiss</button>
              </div>
            )}
            {!compact && (
              <CanvasFooter
                store={store}
                stage={stage}
                selectedCount={selectedIds.length}
                onEditSpace={() => onStageChange?.('space')}
              />
            )}
          </div>
          {compact && !inspectorVisible && <button type="button" className="compact-inspector-toggle" aria-label="Open split-view inspector" onClick={() => setCompactInspectorOpen(true)}>Inspector</button>}
          <div className={`editor-drawer right-panel inspector-drawer${compact ? ' compact-inspector-drawer' : ''}`} data-editor-drawer="inspector" aria-hidden={!inspectorVisible}>
              {compact && <button type="button" className="compact-inspector-close" aria-label="Collapse split-view inspector" onClick={() => setCompactInspectorOpen(false)}>×</button>}
              {essentialsVisible && (
                <section className="essentials-dialog in-panel" role="dialog" aria-modal="true" aria-label="Validate plan">
                  <button type="button" className="workspace-modal-close" aria-label="Close essentials checker" onClick={() => setEssentialsVisible(false)}>×</button>
                  <ValidationAutoFix store={store} onEditRoom={editRoomForValidation} />
                  <details className="validation-review-details">
                    <summary>Review details</summary>
                    <div>
                      <LayoutDiagnostics store={store} />
                      <EssentialsChecker store={store} focusItemId={checksFocusId} onEditRoom={editRoomForValidation} showQuickFixes={false} />
                    </div>
                  </details>
                </section>
              )}
              {revisionsVisible && <RevisionHistory store={store} />}
              {!essentialsVisible && !revisionsVisible && (spaceSelection ? (
                <RoomEditorPanel store={store} selection={spaceSelection} onClearSelection={() => setSpaceSelection(null)} onSelectItem={selectSpaceItem} onContinueToEquipment={continueToEquipment} />
              ) : selectedIds.length > 0 ? (
                <EquipmentInspector store={store} />
              ) : stage === 'space' ? (
                <RoomEditorPanel store={store} selection={null} onClearSelection={() => setSpaceSelection(null)} onSelectItem={selectSpaceItem} onContinueToEquipment={continueToEquipment} />
              ) : showInspectorContent ? (
                <StageOverview
                  store={store}
                  stage={stage}
                  hideToolbarActions={includeToolbar}
                  onContinueToEquipment={continueToEquipment}
                  onCheckEssentials={() => setEssentialsVisible(true)}
                  onSetUpSimulation={() => onStageChange?.('simulate')}
                />
              ) : (
                <EquipmentInspector store={store} />
              ))}
              {selectedIds.length === 0 && !spaceSelection && !essentialsVisible && <LayoutDiagnostics store={store} />}
              {selectedIds.length === 0 && !spaceSelection && <ProjectSettings store={store} stage={stage} />}
            </div>
        </div>
      </section>
      {!compact && activeClosedLayout && (
        <div className="workspace-toast" role="status">
          <span>{activeClosedLayout.name} closed.</span>
          <button type="button" aria-label={`Undo close ${activeClosedLayout.name}`} disabled={revision !== activeClosedLayout.revision} title={revision === activeClosedLayout.revision ? 'Restore the closed layout' : 'Undo is unavailable after another edit'} onClick={() => { if (activeClosedLayout.undo()) { onClosedLayoutChange?.(null); setInternalClosedLayout(null) } }}>Undo</button>
          <button type="button" aria-label="Dismiss closed layout message" onClick={() => { onClosedLayoutChange?.(null); setInternalClosedLayout(null) }}>×</button>
        </div>
      )}
      {!compact && autoFixStatus && (
        <div className="workspace-toast autofix-result-toast" role="status">
          <span>{autoFixStatus}</span>
          <button type="button" aria-label="Dismiss automatic fix result" onClick={() => setAutoFixStatus('')}>×</button>
        </div>
      )}
      {!compact && autoFixStrategyOpen && (
        <AutoFixStrategyDialog
          store={store}
          onClose={() => setAutoFixStrategyOpen(false)}
          onResult={(result) => setAutoFixStatus(result.message)}
        />
      )}
      {!compact && wizardVisible && (
        <LayoutWizard
          store={store}
          initialStep={wizardRoomStep ? 1 : 0}
          initialMode={wizardRoomStep ? 'polygon' : 'duplicate'}
          onClose={closeLayoutWizard}
        />
      )}
      {!compact && spaceImpactOpen && (
        <SpaceImpactDialog
          project={store.getState().project}
          nextArchitecture={getActiveVariant(store.getState()).architecture}
          onCancel={() => setSpaceImpactOpen(false)}
          onApply={() => {
            const architecture = getActiveVariant(store.getState()).architecture
            store.getState().checkpointAllLayouts('Before a shared-space change')
            store.getState().applySharedArchitecture(architecture)
            setSpaceImpactOpen(false)
            onStageChange?.('equipment')
          }}
        />
      )}
    </>
  )
}
