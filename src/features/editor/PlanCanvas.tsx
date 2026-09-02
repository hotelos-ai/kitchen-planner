import { useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { Stage } from 'react-konva'
import { useStore } from 'zustand'
import { CATALOG_DRAG_MIME, parseCatalogDragPayload } from '../../domain/catalog/catalog-drag'
import { getCatalogEntry } from '../../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { ArchitectureLayer } from './ArchitectureLayer'
import { EquipmentLayer } from './EquipmentNode'
import { GridLayer } from './GridLayer'
import { OpeningOverlayLayer } from './OpeningOverlayLayer'
import { ComponentContextMenu, type ComponentContextAction, type OverlayPosition } from './ComponentContextMenu'
import { QuickConfigurationPopover, type QuickConfigurationMode } from './QuickConfigurationPopover'

type Props = {
  store: ProjectStore
  showReference: boolean
  onInspectComponentIn3D?(itemId: string): void
  onComponentLockChange?(itemId: string, locked: boolean): void
  onSkinChange?(itemId: string, skinId: string): void
}

type ContextRequest = { itemId: string; position: OverlayPosition }
type QuickRequest = ContextRequest & { mode: QuickConfigurationMode }

export function PlanCanvas({ store, showReference, onInspectComponentIn3D, onComponentLockChange, onSkinChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 740, height: 720 })
  const [contextRequest, setContextRequest] = useState<ContextRequest>()
  const [quickRequest, setQuickRequest] = useState<QuickRequest>()
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const variant = useStore(store, getActiveVariant)
  const warningIds = [...new Set(analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints }).flatMap((issue) => issue.itemIds))]
  const contextItem = contextRequest ? variant.equipment.find((item) => item.id === contextRequest.itemId) : undefined
  const quickItem = quickRequest ? variant.equipment.find((item) => item.id === quickRequest.itemId) : undefined

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setSize({ width: element.clientWidth || 360, height: element.clientHeight || 560 })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const margin = 44
  const pixelsPerMm = Math.min(
    (size.width - margin * 2) / variant.architecture.widthMm,
    (size.height - margin * 2) / variant.architecture.depthMm,
  )
  const planWidth = variant.architecture.widthMm * pixelsPerMm
  const planHeight = variant.architecture.depthMm * pixelsPerMm
  const originX = (size.width - planWidth) / 2
  const originY = (size.height - planHeight) / 2

  const addDroppedCatalogItem = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const payload = parseCatalogDragPayload(event.dataTransfer.getData(CATALOG_DRAG_MIME))
    const entry = payload ? getCatalogEntry(payload.catalogId) : undefined
    if (!payload || !entry) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const placement = suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment: variant.equipment,
      entry,
      snapMm: project.snapMm,
      layoutConstraints: variant.layoutConstraints,
      preferredPoint: {
        xMm: (event.clientX - bounds.left - originX) / pixelsPerMm,
        yMm: (event.clientY - bounds.top - originY) / pixelsPerMm,
      },
    })
    if (placement) store.getState().addCatalogItem(entry.catalogId, { xMm: placement.xMm, yMm: placement.yMm })
  }

  const selectForOverlay = (itemId: string) => store.getState().selectItems([itemId])
  const openQuick = (itemId: string, position: OverlayPosition, mode: QuickConfigurationMode = 'configure') => {
    selectForOverlay(itemId)
    setContextRequest(undefined)
    setQuickRequest({ itemId, position, mode })
  }
  const openContextMenu = (itemId: string, position: OverlayPosition) => {
    selectForOverlay(itemId)
    setQuickRequest(undefined)
    setContextRequest({ itemId, position })
  }
  const contextLocked = Boolean(contextItem && (
    !contextItem.movable || variant.layoutConstraints?.lockedComponentIds?.includes(contextItem.id)
  ))
  const performContextAction = (action: ComponentContextAction) => {
    if (!contextItem || !contextRequest) return
    const id = contextItem.id
    if (action === 'configure') openQuick(id, contextRequest.position, 'configure')
    else if (action === 'skin') openQuick(id, contextRequest.position, 'skin')
    else if (action === 'rotate-left') store.getState().rotateItems([id], -90)
    else if (action === 'rotate-right') store.getState().rotateItems([id], 90)
    else if (action === 'duplicate') store.getState().duplicateItem(id)
    else if (action === 'toggle-lock') {
      if (onComponentLockChange) onComponentLockChange(id, !contextLocked)
      else store.getState().setComponentLocked(id, !contextLocked)
    }
    else if (action === 'inspect-3d') onInspectComponentIn3D?.(id)
    else if (action === 'remove') store.getState().removeItems([id])
  }

  return (
    <div ref={containerRef} className="plan-canvas" data-testid="plan-canvas" onDragOver={(event) => event.preventDefault()} onDrop={addDroppedCatalogItem}>
      {showReference && <img className="source-reference" src="/reference/manta-raja-layout.png" alt="Original graph-paper kitchen layout reference" />}
      <Stage width={size.width} height={size.height} onMouseDown={(event) => {
        if (event.target === event.target.getStage()) {
          store.getState().clearSelection()
          setContextRequest(undefined)
          setQuickRequest(undefined)
        }
      }}>
        <ArchitectureLayer architecture={variant.architecture} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} />
        <GridLayer width={size.width} height={size.height} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} snapMm={project.snapMm} />
        <EquipmentLayer
          items={variant.equipment}
          selectedIds={selectedIds}
          warningIds={warningIds}
          displayUnit={project.displayUnit}
          pixelsPerMm={pixelsPerMm}
          originX={originX}
          originY={originY}
          snapMm={project.snapMm}
          onSelect={(id, additive) => additive ? store.getState().toggleItemSelection(id) : store.getState().selectItems([id])}
          onQuickConfigure={(id, position) => openQuick(id, position)}
          onOpenContextMenu={openContextMenu}
          onMove={(id, point) => store.getState().moveItems([id], point)}
          onTransform={(id, patch) => store.getState().updateItem(id, patch)}
        />
        <OpeningOverlayLayer architecture={variant.architecture} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} />
      </Stage>
      {contextRequest && contextItem && <ComponentContextMenu
        item={contextItem}
        locked={contextLocked}
        position={contextRequest.position}
        onAction={performContextAction}
        onClose={() => setContextRequest(undefined)}
      />}
      {quickRequest && quickItem && <QuickConfigurationPopover
        key={`${quickItem.id}-${quickRequest.mode}`}
        item={quickItem}
        store={store}
        mode={quickRequest.mode}
        position={quickRequest.position}
        onClose={() => setQuickRequest(undefined)}
        onSkinChange={onSkinChange ?? ((itemId, skinId) => store.getState().setAppearanceSkin(itemId, skinId))}
      />}
      <div className="canvas-scale"><span />1 metre · 10 squares</div>
    </div>
  )
}
