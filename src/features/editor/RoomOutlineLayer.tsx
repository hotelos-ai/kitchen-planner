import { useEffect, useState } from 'react'
import { Circle, Group, Layer, Line, Rect } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Architecture, PointMm } from '../../domain/project'
import {
  constrainToAxes,
  createOpeningAt,
  createRectItemAt,
  edgeMidpoint,
  insertVertexOnSegment,
  moveOpening,
  movePillar,
  moveVertex,
  moveZoneRect,
  openingCenter,
  openingEnds,
  rectHandles,
  removeVertex,
  resizeOpening,
  resizePillarRect,
  resizeZoneRect,
  slideEdge,
  squarePointAround,
  type PlacementSpec,
  type RectHandle,
} from './room-outline'

type Props = {
  architecture: Architecture
  pixelsPerMm: number
  originX: number
  originY: number
  snapMm: number
  placement: PlacementSpec | null
  onCommit(next: Architecture): void
  onPlacementDone(): void
}

const HANDLE_RADIUS = 8
const INSERT_RADIUS = 11
const OPENING_RADIUS = 9
const PILLAR_HALF = 8
const RESIZE_HALF = 7

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null

type SelectedItem = { kind: 'pillar' | 'zone' | 'opening'; id: string }

export function RoomOutlineLayer({ architecture, pixelsPerMm, originX, originY, snapMm, placement, onCommit, onPlacementDone }: Props) {
  const [dragPolygon, setDragPolygon] = useState<PointMm[] | null>(null)
  const [draggingEdge, setDraggingEdge] = useState<number | null>(null)
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [placing, setPlacing] = useState<{ from: PointMm; to: PointMm } | null>(null)
  const polygon = dragPolygon ?? architecture.roomPolygon

  useEffect(() => {
    if (!placement) return
    const stage = document.querySelector<HTMLElement>('.plan-canvas')
    stage?.style.setProperty('cursor', 'crosshair')
    return () => { stage?.style.setProperty('cursor', 'default') }
  }, [placement])

  useEffect(() => {
    if (selectedVertex === null && selectedItem === null && !placement) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedVertex(null)
        setSelectedItem(null)
        setPlacing(null)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (selectedVertex === null) return
      event.preventDefault()
      const index = selectedVertex
      setSelectedVertex(null)
      onCommit(removeVertex(architecture, index))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedVertex, selectedItem, placement, architecture, onCommit])

  const toPx = (point: PointMm) => ({ x: originX + point.x * pixelsPerMm, y: originY + point.y * pixelsPerMm })
  const toMm = (x: number, y: number) => ({ x: (x - originX) / pixelsPerMm, y: (y - originY) / pixelsPerMm })
  const snapPointLocal = (point: PointMm): PointMm => ({ x: Math.max(0, Math.round(point.x / snapMm) * snapMm), y: Math.max(0, Math.round(point.y / snapMm) * snapMm) })

  const commitPlacement = (shiftKey: boolean) => {
    if (!placement || !placing) { onPlacementDone(); return }
    let to = placing.to
    if (shiftKey) to = constrainToAxes(placing.from, to)
    const next = placement.kind === 'door' || placement.kind === 'service-window'
      ? createOpeningAt(architecture, { label: placement.label, kind: placement.kind, widthMm: placement.widthMm }, placing.from, to, snapMm)
      : createRectItemAt(architecture, { id: placement.catalogId, label: placement.label, kind: placement.kind === 'zone' ? 'zone' : 'pillar', widthMm: placement.widthMm, depthMm: placement.depthMm }, placing.from, to, snapMm)
    onCommit(next)
    setPlacing(null)
    onPlacementDone()
  }

  const pillarIndex = selectedItem?.kind === 'pillar' ? architecture.pillars.findIndex((pillar) => pillar.id === selectedItem.id) : -1
  const zoneIndex = selectedItem?.kind === 'zone' ? architecture.storageZones.findIndex((zone) => zone.id === selectedItem.id) : -1
  const openingIndex = selectedItem?.kind === 'opening' ? architecture.openings.findIndex((opening) => opening.id === selectedItem.id) : -1
  const selectedRect = pillarIndex >= 0
    ? { xMm: architecture.pillars[pillarIndex].xMm, yMm: architecture.pillars[pillarIndex].yMm, widthMm: architecture.pillars[pillarIndex].widthMm, depthMm: architecture.pillars[pillarIndex].depthMm }
    : zoneIndex >= 0
      ? { xMm: architecture.storageZones[zoneIndex].xMm, yMm: architecture.storageZones[zoneIndex].yMm, widthMm: architecture.storageZones[zoneIndex].widthMm, depthMm: architecture.storageZones[zoneIndex].depthMm }
      : null

  const rectResizeCommit = (handle: RectHandle) => (event: KonvaEventObject<DragEvent>) => {
    const node = event.target
    let point = toMm(node.x() + RESIZE_HALF, node.y() + RESIZE_HALF)
    const isCorner = handle.length === 2
    if (event.evt.shiftKey && isCorner && selectedRect) {
      const anchor = { x: handle.includes('l') ? selectedRect.xMm + selectedRect.widthMm : selectedRect.xMm, y: handle.includes('t') ? selectedRect.yMm + selectedRect.depthMm : selectedRect.yMm }
      point = squarePointAround(anchor, point)
    }
    if (pillarIndex >= 0) onCommit(resizePillarRect(architecture, pillarIndex, handle, point, snapMm))
    else if (zoneIndex >= 0) onCommit(resizeZoneRect(architecture, zoneIndex, handle, point, snapMm))
    node.position({ x: 0, y: 0 })
  }

  return (
    <Layer
      listening
      onMouseDown={(event) => {
        if (!placement) return
        if (event.target !== event.target.getStage()) return
        const stage = event.target.getStage()
        const pointer = stage?.getPointerPosition()
        if (!pointer) return
        setPlacing({ from: toMm(pointer.x, pointer.y), to: toMm(pointer.x, pointer.y) })
      }}
      onMouseMove={(event) => {
        if (!placement || !placing) return
        const stage = event.target.getStage()
        const pointer = stage?.getPointerPosition()
        if (!pointer) return
        let to = toMm(pointer.x, pointer.y)
        if (event.evt.shiftKey) to = constrainToAxes(placing.from, to)
        setPlacing({ ...placing, to })
      }}
      onMouseUp={(event) => { if (placement && placing) commitPlacement(event.evt.shiftKey) }}
    >
      {placement && placing && (() => {
        const a = toPx(placing.from)
        const b = toPx(placing.to)
        return placement.kind === 'door' || placement.kind === 'service-window'
          ? <Line points={[a.x, a.y, b.x, b.y]} stroke="#ca4e8e" strokeWidth={10} opacity={0.55} lineCap="round" listening={false} />
          : <Rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="rgba(202,78,142,0.10)" stroke="#ca4e8e" strokeWidth={2} dash={[9, 7]} listening={false} />
      })()}

      {polygon.map((start, index) => {
        const end = polygon[(index + 1) % polygon.length]
        const a = toPx(start)
        const b = toPx(end)
        const mid = toPx(edgeMidpoint(polygon, index))
        return (
          <Group
            key={`outline-edge-${index}`}
            draggable
            onDragStart={() => setDraggingEdge(index)}
            onDragMove={(event) => {
              const node = event.target
              const deltaMm = { x: node.x() / pixelsPerMm, y: node.y() / pixelsPerMm }
              const snapped = { x: Math.round(deltaMm.x / snapMm) * snapMm, y: Math.round(deltaMm.y / snapMm) * snapMm }
              const next = architecture.roomPolygon.map((vertex, position) => (
                position === index || position === (index + 1) % polygon.length
                  ? { x: Math.max(0, vertex.x + snapped.x), y: Math.max(0, vertex.y + snapped.y) }
                  : vertex
              ))
              setDragPolygon(next)
              node.position({ x: 0, y: 0 })
            }}
            onDragEnd={(event) => {
              const node = event.target
              const deltaMm = { x: node.x() / pixelsPerMm, y: node.y() / pixelsPerMm }
              node.position({ x: 0, y: 0 })
              setDraggingEdge(null)
              onCommit(slideEdge(architecture, index, deltaMm, snapMm))
            }}
          >
            <Line points={[a.x, a.y, b.x, b.y]} stroke="rgba(0,0,0,0)" strokeWidth={1} hitStrokeWidth={26} />
            <Line
              points={[a.x, a.y, b.x, b.y]}
              stroke={draggingEdge === index ? '#ca4e8e' : 'rgba(12,30,3,0)'}
              dash={[10, 8]}
              strokeWidth={3}
              hitStrokeWidth={0}
              listening={false}
              opacity={draggingEdge === index ? 0.85 : 0}
            />
            <Circle
              x={mid.x}
              y={mid.y}
              radius={INSERT_RADIUS}
              fill="#fbfaf5"
              stroke="#ca4e8e"
              strokeWidth={2}
              dash={[5, 4]}
              hitStrokeWidth={20}
              onClick={() => onCommit(insertVertexOnSegment(architecture, index, edgeMidpoint(architecture.roomPolygon, index), snapMm))}
            />
          </Group>
        )
      })}

      {polygon.map((vertex, index) => {
        const position = toPx(vertex)
        const isSelected = selectedVertex === index
        return (
          <Circle
            key={`outline-vertex-${index}`}
            x={position.x}
            y={position.y}
            radius={isSelected ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
            fill={isSelected ? '#ca4e8e' : '#fbfaf5'}
            stroke={isSelected ? '#fbfaf5' : '#1b3a36'}
            strokeWidth={2.5}
            draggable
            hitStrokeWidth={24}
            onClick={() => setSelectedVertex((current) => current === index ? null : index)}
            onDragStart={() => setSelectedVertex(index)}
            onDragMove={(event) => {
              const node = event.target
              let point = toMm(node.x(), node.y())
              if (event.evt.shiftKey) point = constrainToAxes(architecture.roomPolygon[index], point)
              const snapped = snapPointLocal(point)
              node.position(toPx(snapped))
              setDragPolygon(architecture.roomPolygon.map((candidate, position) => position === index ? snapped : candidate))
            }}
            onDragEnd={(event) => {
              setDragPolygon(null)
              onCommit(moveVertex(architecture, index, toMm(event.target.x(), event.target.y()), snapMm))
            }}
          />
        )
      })}

      {architecture.openings.map((opening, index) => {
        const position = toPx(openingCenter(architecture, opening))
        const isSelected = openingIndex === index
        const ends = openingEnds(architecture, opening)
        const startPx = toPx(ends.start)
        const endPx = toPx(ends.end)
        return (
          <Group key={`outline-opening-${opening.id}`}>
            <Group draggable
              onDragEnd={(event) => {
                const node = event.target
                const point = toMm(node.x() + position.x, node.y() + position.y)
                node.position({ x: 0, y: 0 })
                onCommit(moveOpening(architecture, index, point, snapMm))
              }}
            >
              <Circle x={position.x} y={position.y} radius={OPENING_RADIUS} fill="#ca4e8e" opacity={isSelected ? 1 : 0.9} stroke="#fbfaf5" strokeWidth={2} hitStrokeWidth={22}
                onClick={() => setSelectedItem((current) => current?.id === opening.id ? null : { kind: 'opening', id: opening.id })} />
              <Circle x={position.x} y={position.y} radius={3} fill="#fbfaf5" listening={false} />
            </Group>
            {isSelected && (['start', 'end'] as const).map((end) => {
              const at = end === 'start' ? startPx : endPx
              return (
                <Circle key={end} x={at.x} y={at.y} radius={RESIZE_HALF} fill="#fbfaf5" stroke="#ca4e8e" strokeWidth={2.5} draggable hitStrokeWidth={22}
                  onDragMove={(event) => {
                    const node = event.target
                    const snapped = snapPointLocal(toMm(node.x(), node.y()))
                    node.position(toPx(snapped))
                  }}
                  onDragEnd={(event) => {
                    const node = event.target
                    onCommit(resizeOpening(architecture, index, end, toMm(node.x(), node.y()), snapMm))
                    node.position({ x: 0, y: 0 })
                  }}
                />
              )
            })}
          </Group>
        )
      })}

      {architecture.pillars.map((pillar, index) => {
        const position = toPx({ x: pillar.xMm + pillar.widthMm / 2, y: pillar.yMm + pillar.depthMm / 2 })
        const isSelected = pillarIndex === index
        return (
          <Rect key={pillar.id} x={position.x - PILLAR_HALF} y={position.y - PILLAR_HALF}
            width={PILLAR_HALF * 2} height={PILLAR_HALF * 2} cornerRadius={3}
            fill={isSelected ? '#ca4e8e' : '#1b3a36'} stroke="#1b3a36" strokeWidth={2.5} draggable hitStrokeWidth={22}
            onClick={() => setSelectedItem((current) => current?.id === pillar.id ? null : { kind: 'pillar', id: pillar.id })}
            onDragEnd={(event) => {
              const node = event.target
              const point = toMm(node.x() + PILLAR_HALF, node.y() + PILLAR_HALF)
              onCommit(movePillar(architecture, index, point, snapMm))
            }}
          />
        )
      })}

      {architecture.storageZones.map((zone, index) => {
        const a = toPx({ x: zone.xMm, y: zone.yMm })
        const size = toPx({ x: zone.xMm + zone.widthMm, y: zone.yMm + zone.depthMm })
        const isSelected = zoneIndex === index
        return (
          <Rect key={zone.id} x={a.x} y={a.y} width={size.x - a.x} height={size.y - a.y}
            fill={isSelected ? 'rgba(202,78,142,0.08)' : 'rgba(0,0,0,0)'} stroke={isSelected ? '#ca4e8e' : 'rgba(0,0,0,0)'} strokeWidth={2} dash={[8, 6]} draggable hitStrokeWidth={24}
            onClick={() => setSelectedItem((current) => current?.id === zone.id ? null : { kind: 'zone', id: zone.id })}
            onDragEnd={(event) => {
              const node = event.target
              const point = toMm(node.x(), node.y())
              onCommit(moveZoneRect(architecture, index, point, snapMm))
            }}
          />
        )
      })}

      {selectedRect && rectHandles(selectedRect).map(({ handle, at }) => {
        const px = toPx(at)
        const isCorner = handle.length === 2
        return (
          <Rect key={handle} x={px.x - RESIZE_HALF} y={px.y - RESIZE_HALF} width={RESIZE_HALF * 2} height={RESIZE_HALF * 2}
            fill="#fbfaf5" stroke="#ca4e8e" strokeWidth={2.5} cornerRadius={isCorner ? 2 : 999} draggable hitStrokeWidth={22}
            onDragMove={(event) => {
              const node = event.target
              const snapped = snapPointLocal(toMm(node.x() + RESIZE_HALF, node.y() + RESIZE_HALF))
              node.position({ x: toPx(snapped).x - RESIZE_HALF, y: toPx(snapped).y - RESIZE_HALF })
            }}
            onDragEnd={rectResizeCommit(handle)}
          />
        )
      })}
    </Layer>
  )
}
