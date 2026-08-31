import { useLayoutEffect, useRef, useState } from 'react'
import { Stage } from 'react-konva'
import { useStore } from 'zustand'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'
import { ArchitectureLayer } from './ArchitectureLayer'
import { EquipmentLayer } from './EquipmentNode'
import { GridLayer } from './GridLayer'

type Props = {
  store: ProjectStore
  showReference: boolean
}

export function PlanCanvas({ store, showReference }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 740, height: 720 })
  const project = useStore(store, (state) => state.project)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const variant = useStore(store, getActiveVariant)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setSize({ width: Math.max(360, element.clientWidth), height: Math.max(560, element.clientHeight) })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const margin = 44
  const pixelsPerMm = Math.min(
    (size.width - margin * 2) / project.architecture.widthMm,
    (size.height - margin * 2) / project.architecture.depthMm,
  )
  const planWidth = project.architecture.widthMm * pixelsPerMm
  const planHeight = project.architecture.depthMm * pixelsPerMm
  const originX = (size.width - planWidth) / 2
  const originY = (size.height - planHeight) / 2

  return (
    <div ref={containerRef} className="plan-canvas" data-testid="plan-canvas">
      {showReference && <img className="source-reference" src="/reference/manta-raja-layout.png" alt="Original graph-paper kitchen layout reference" />}
      <Stage width={size.width} height={size.height} onMouseDown={(event) => {
        if (event.target === event.target.getStage()) store.getState().clearSelection()
      }}>
        <GridLayer width={size.width} height={size.height} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} snapMm={project.snapMm} />
        <ArchitectureLayer architecture={project.architecture} pixelsPerMm={pixelsPerMm} originX={originX} originY={originY} />
        <EquipmentLayer
          items={variant.equipment}
          selectedIds={selectedIds}
          displayUnit={project.displayUnit}
          pixelsPerMm={pixelsPerMm}
          originX={originX}
          originY={originY}
          onSelect={(id, additive) => additive ? store.getState().toggleItemSelection(id) : store.getState().selectItems([id])}
          onMove={(id, point) => store.getState().moveItems([id], point)}
        />
      </Stage>
      <div className="canvas-scale"><span />1 metre · 10 squares</div>
    </div>
  )
}
