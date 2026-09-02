import { Fragment, useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { Group, Layer, Rect, Text, Transformer } from 'react-konva'
import type { DisplayUnit, EquipmentItem, PointMm } from '../../domain/project'
import { snapMm as snapValue } from '../../domain/geometry'
import { formatDimensions, formatLength } from '../../domain/units'
import type { OverlayPosition } from './ComponentContextMenu'
import { equipmentTransformPatch } from './equipment-transform'

const COLORS: Record<EquipmentItem['category'], { fill: string; stroke: string; text: string }> = {
  cooking: { fill: '#efd3ca', stroke: '#a35643', text: '#612c22' },
  cold: { fill: '#d9e8e9', stroke: '#4d7b80', text: '#294e52' },
  prep: { fill: '#dfe6d7', stroke: '#718368', text: '#40503a' },
  washing: { fill: '#e9e0c6', stroke: '#8f7538', text: '#5b4920' },
  landing: { fill: '#eee7d3', stroke: '#9b844e', text: '#5b4b28' },
  storage: { fill: '#e5dfd2', stroke: '#807568', text: '#4d463e' },
  hood: { fill: 'rgba(184, 194, 190, .26)', stroke: '#68726f', text: '#3b4542' },
  custom: { fill: '#e5dcee', stroke: '#79648c', text: '#493a58' },
}

type NodeFeedback = { kind: 'move' | 'resize'; xMm: number; yMm: number; widthMm: number; depthMm: number }

type NodeProps = {
  item: EquipmentItem
  selected: boolean
  displayUnit: DisplayUnit
  pixelsPerMm: number
  originX: number
  originY: number
  snapMm: number
  onSelect(itemId: string, additive: boolean): void
  onQuickConfigure(itemId: string, position: OverlayPosition): void
  onOpenContextMenu(itemId: string, position: OverlayPosition): void
  onMove(itemId: string, point: PointMm): void
  onTransform(itemId: string, patch: Partial<EquipmentItem>): void
  warning?: boolean
}

const eventPosition = (event: MouseEvent | TouchEvent): OverlayPosition => {
  if ('clientX' in event) return { x: event.clientX, y: event.clientY }
  const touch = event.changedTouches[0] ?? event.touches[0]
  return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 }
}

export function EquipmentNode({ item, selected, warning = false, displayUnit, pixelsPerMm: scale, originX, originY, snapMm, onSelect, onQuickConfigure, onOpenContextMenu, onMove, onTransform }: NodeProps) {
  const nodeRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [feedback, setFeedback] = useState<NodeFeedback | null>(null)
  const colors = COLORS[item.category]
  const width = item.widthMm * scale
  const height = item.depthMm * scale
  const label = `${item.label}\n${formatDimensions(item, displayUnit)}`

  const liveFeedback = (kind: NodeFeedback['kind'], node: Konva.Node, scaleX: number, scaleY: number): NodeFeedback => ({
    kind,
    xMm: snapValue((node.x() - originX) / scale, snapMm),
    yMm: snapValue((node.y() - originY) / scale, snapMm),
    widthMm: Math.max(snapMm, snapValue(item.widthMm * Math.abs(scaleX), snapMm)),
    depthMm: Math.max(snapMm, snapValue(item.depthMm * Math.abs(scaleY), snapMm)),
  })

  useEffect(() => {
    if (!selected || item.dimensionsLocked || !nodeRef.current || !transformerRef.current) return
    transformerRef.current.nodes([nodeRef.current])
    transformerRef.current.forceUpdate()
    transformerRef.current.getLayer()?.batchDraw()
  }, [item.dimensionsLocked, item.widthMm, item.depthMm, item.xMm, item.yMm, item.rotationDeg, selected])

  return <Fragment>
    <Group
      ref={nodeRef}
      x={originX + item.xMm * scale}
      y={originY + item.yMm * scale}
      rotation={item.rotationDeg}
      draggable={item.movable}
      onClick={(event) => onSelect(item.id, Boolean(event.evt.shiftKey))}
      onTap={() => onSelect(item.id, false)}
      onDblClick={(event) => {
        event.evt.preventDefault()
        event.cancelBubble = true
        onQuickConfigure(item.id, eventPosition(event.evt))
      }}
      onDblTap={(event) => {
        event.evt.preventDefault()
        event.cancelBubble = true
        onQuickConfigure(item.id, eventPosition(event.evt))
      }}
      onContextMenu={(event) => {
        event.evt.preventDefault()
        event.cancelBubble = true
        onOpenContextMenu(item.id, eventPosition(event.evt))
      }}
      onMouseEnter={() => {
        if (!item.movable) return
        const stage = nodeRef.current?.getStage()
        if (stage) stage.container().style.cursor = 'move'
      }}
      onMouseLeave={() => {
        const stage = nodeRef.current?.getStage()
        if (stage && stage.container().style.cursor === 'move') stage.container().style.cursor = ''
      }}
      onDragStart={(event) => {
        if ('button' in event.evt && event.evt.button !== 0) {
          event.target.stopDrag()
          event.cancelBubble = true
          return
        }
        setFeedback(liveFeedback('move', event.target, 1, 1))
      }}
      onDragMove={(event) => setFeedback(liveFeedback('move', event.target, 1, 1))}
      onDragEnd={(event) => {
        onMove(item.id, { x: (event.target.x() - originX) / scale, y: (event.target.y() - originY) / scale })
        setFeedback(null)
      }}
      onTransform={() => {
        const node = nodeRef.current
        if (!node) return
        setFeedback(liveFeedback('resize', node, node.scaleX(), node.scaleY()))
      }}
      onTransformEnd={() => {
        const node = nodeRef.current
        if (!node) return
        const patch = equipmentTransformPatch({ x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation() }, { widthMm: item.widthMm, depthMm: item.depthMm, originX, originY, pixelsPerMm: scale, snapMm })
        node.scale({ x: 1, y: 1 })
        transformerRef.current?.forceUpdate()
        node.getLayer()?.batchDraw()
        onTransform(item.id, patch)
        setFeedback(null)
      }}
    >
      <Rect x={-6} y={-6} width={width + 12} height={height + 12} fill="transparent" />
      <Rect
        width={width}
        height={height}
        fill={colors.fill}
        stroke={selected ? '#d46847' : warning ? '#d29122' : colors.stroke}
        strokeWidth={selected ? 3 : 1.5}
        dash={item.category === 'hood' || warning ? [7, 4] : undefined}
        shadowColor="#101513"
        shadowOpacity={item.category === 'hood' ? 0 : 0.13}
        shadowBlur={selected ? 8 : 3}
      />
      <Text text={label} width={width} height={height} padding={4} align="center" verticalAlign="middle" fill={colors.text} fontSize={Math.max(7, Math.min(11, Math.min(width, height) / 7))} fontStyle="bold" wrap="word" ellipsis />
      {item.approximate && <Text x={width - 16} y={3} width={13} text="~" fill={colors.stroke} fontSize={10} fontStyle="bold" align="right" />}
      {feedback && <Group x={0} y={-26} rotation={-item.rotationDeg}>
        <Rect width={170} height={20} fill="#17211e" cornerRadius={3} opacity={.94} />
        <Text x={5} y={4} width={160} height={13} text={feedback.kind === 'move'
          ? `X ${formatLength(feedback.xMm, displayUnit)} · Y ${formatLength(feedback.yMm, displayUnit)}`
          : `W ${formatLength(feedback.widthMm, displayUnit)} · D ${formatLength(feedback.depthMm, displayUnit)}`} fill="#fffaf0" fontSize={8} align="center" />
      </Group>}
    </Group>
    {selected && !item.dimensionsLocked && <Transformer
      ref={transformerRef}
      rotateEnabled={false}
      enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
      anchorFill="#fffaf0"
      anchorStroke="#d46847"
      anchorCornerRadius={2}
      borderStroke="#d46847"
      anchorSize={9}
      padding={3}
      flipEnabled={false}
      boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < snapMm * scale || Math.abs(newBox.height) < snapMm * scale ? oldBox : newBox}
    />}
  </Fragment>
}

type LayerProps = Omit<NodeProps, 'item' | 'selected'> & {
  items: EquipmentItem[]
  selectedIds: string[]
  warningIds: string[]
}

// Shared with a focused draw-order regression test.
// eslint-disable-next-line react-refresh/only-export-components
export function orderEquipmentForPlan(items: EquipmentItem[]) {
  return [...items].sort((left, right) => Number(left.category !== 'hood') - Number(right.category !== 'hood'))
}

export function EquipmentLayer({ items, selectedIds, warningIds, ...nodeProps }: LayerProps) {
  return <Layer>{orderEquipmentForPlan(items).map((item) => <EquipmentNode key={item.id} item={item} selected={selectedIds.includes(item.id)} warning={warningIds.includes(item.id)} {...nodeProps} />)}</Layer>
}
