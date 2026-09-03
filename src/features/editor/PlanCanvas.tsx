import { useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { Stage } from 'react-konva'
import { useStore } from 'zustand'
import { CATALOG_DRAG_MIME, parseCatalogDragPayload } from '../../domain/catalog/catalog-drag'
import { getCatalogEntry } from '../../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import type { LayoutVariant } from '../../domain/project'
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
  sourceImageUrl?: string
  sourceOpacity?: number
  mode?: 'layout' | 'space'
  variantOverride?: LayoutVariant
  readOnly?: boolean
  onInspectComponentIn3D?(itemId: string): void
  onComponentLockChange?(itemId: string, locked: boolean): void
  onSkinChange?(itemId: string, skinId: string): void
  onWarningBadgeClick?(itemId: string): void
}

type ContextRequest = { itemId: string; position: OverlayPosition }
type QuickRequest = ContextRequest & { mode: QuickConfigurationMode }

export function PlanCanvas({ store, showReference, sourceImageUrl = '/reference/kitchen-sketch.png', sourceOpacity = 22, mode = 'layout', variantOverride, readOnly = false, onInspectComponentIn3D, onComponentLockChange, onSkinChange, onWarningBadgeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 740, height: 720 })
  const [contextRequest, setContextRequest] = useState<ContextRequest>()
  const [quickRequest, setQuickRequest] = useState<QuickRequest>()
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[]>([])
  const project = useStore(store, (state) => state.project)
  const storeSelectedIds = useStore(store, (state) => state.selectedIds)
  const storeVariant = useStore(store, getActiveVariant)
  const variant = variantOverride ?? storeVariant
  const selectedIds = readOnly ? previewSelectedIds : storeSelectedIds
  const showEquipment = mode !== 'space'
  const issues = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
  const warningCounts = issues.reduce((counts, issue) => {
    issue.itemIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
    return counts
  }, new Map<string, number>())
  const warningIds = [...warningCounts.keys()]
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
    if (readOnly || !placement) return
    store.getState().addCatalogItem(entry.catalogId, { xMm: placement.xMm, yMm: placement.yMm })
  }

  const selectItems = (ids: string[]) => {
    if (readOnly) setPreviewSelectedIds(ids)
    else store.getState().selectItems(ids)
  }
  const selectForOverlay = (itemId: string) => selectItems([itemId])
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
    if (readOnly || !contextItem || !contextRequest) return
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
    <div ref={containerRef} className="plan-canvas" data-testid="plan-canvas" onDragOver={(event) => { if (!readOnly) event.preventDefault() }} onDrop={readOnly ? undefined : addDroppedCatalogItem}>
      {showReference && <img className="source-reference" src={sourceImageUrl} alt="Source drawing overlay" style={{ opacity: sourceOpacity / 100 }} />}
      <Stage width={size.width} height={size.height} onMouseDown={(event) => {
        if (event.target === event.target.getStage()) {
          if (readOnly) setPreviewSelectedIds([])
          else store.getState().clearSelection()
          setContextRequest(undefined)
          setQuickRequest(undefined)
        }
      }}>
        <ArchitectureLayer architecture={variant.architecture} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} />
        <GridLayer width={size.width} height={size.height} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} snapMm={project.snapMm} />
        {showEquipment && (
          <EquipmentLayer
            items={variant.equipment}
            selectedIds={selectedIds}
            warningIds={warningIds}
            displayUnit={project.displayUnit}
            pixelsPerMm={pixelsPerMm}
            originX={originX}
            originY={originY}
            snapMm={project.snapMm}
            onSelect={(id, additive) => {
              if (readOnly) setPreviewSelectedIds(additive && previewSelectedIds.includes(id) ? previewSelectedIds.filter((value) => value !== id) : additive ? [...previewSelectedIds, id] : [id])
              else if (additive) store.getState().toggleItemSelection(id)
              else store.getState().selectItems([id])
            }}
            onQuickConfigure={(id, position) => { if (!readOnly) openQuick(id, position) }}
            onOpenContextMenu={(id, position) => { if (!readOnly) openContextMenu(id, position) }}
            onMove={(id, point) => { if (!readOnly) store.getState().moveItems([id], point) }}
            onTransform={(id, patch) => { if (!readOnly) store.getState().updateItem(id, patch) }}
          />
        )}
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
      {showEquipment && (
        <div className="plan-warning-badges">
          {variant.equipment.map((item) => {
            const count = warningCounts.get(item.id)
            if (!count) return null
            return (
              <button
                key={item.id}
                type="button"
                className="plan-warning-badge"
                style={{
                  left: originX + (item.xMm + item.widthMm) * pixelsPerMm - 8,
                  top: originY + item.yMm * pixelsPerMm - 8,
                }}
                aria-label={`${count} checks for ${item.label}`}
                onClick={() => {
                  selectItems([item.id])
                  if (!readOnly) onWarningBadgeClick?.(item.id)
                }}
              >
                ⚠{count}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
