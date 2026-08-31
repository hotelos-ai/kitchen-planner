import { Group, Layer, Rect, Text } from 'react-konva'
import type { DisplayUnit, EquipmentItem, PointMm } from '../../domain/project'
import { formatDimensions } from '../../domain/units'

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

type NodeProps = {
  item: EquipmentItem
  selected: boolean
  displayUnit: DisplayUnit
  pixelsPerMm: number
  originX: number
  originY: number
  onSelect(itemId: string, additive: boolean): void
  onMove(itemId: string, point: PointMm): void
}

export function EquipmentNode({ item, selected, displayUnit, pixelsPerMm: scale, originX, originY, onSelect, onMove }: NodeProps) {
  const colors = COLORS[item.category]
  const width = item.widthMm * scale
  const height = item.depthMm * scale
  const label = `${item.label}\n${formatDimensions(item, displayUnit)}`

  return (
    <Group
      x={originX + item.xMm * scale}
      y={originY + item.yMm * scale}
      rotation={item.rotationDeg}
      draggable={item.movable}
      onClick={(event) => onSelect(item.id, Boolean(event.evt.shiftKey))}
      onTap={() => onSelect(item.id, false)}
      onDragEnd={(event) => onMove(item.id, {
        x: (event.target.x() - originX) / scale,
        y: (event.target.y() - originY) / scale,
      })}
    >
      <Rect x={-6} y={-6} width={width + 12} height={height + 12} fill="transparent" />
      <Rect
        width={width}
        height={height}
        fill={colors.fill}
        stroke={selected ? '#d46847' : colors.stroke}
        strokeWidth={selected ? 3 : 1.5}
        dash={item.category === 'hood' ? [7, 4] : undefined}
        shadowColor="#101513"
        shadowOpacity={item.category === 'hood' ? 0 : 0.13}
        shadowBlur={selected ? 8 : 3}
      />
      <Text text={label} width={width} height={height} padding={4} align="center" verticalAlign="middle" fill={colors.text} fontSize={Math.max(7, Math.min(11, Math.min(width, height) / 7))} fontStyle="bold" wrap="word" ellipsis />
      {item.approximate && <Text x={width - 16} y={3} width={13} text="~" fill={colors.stroke} fontSize={10} fontStyle="bold" align="right" />}
    </Group>
  )
}

type LayerProps = Omit<NodeProps, 'item' | 'selected'> & {
  items: EquipmentItem[]
  selectedIds: string[]
}

export function orderEquipmentForPlan(items: EquipmentItem[]) {
  return [...items].sort((left, right) => Number(left.category !== 'hood') - Number(right.category !== 'hood'))
}

export function EquipmentLayer({ items, selectedIds, ...nodeProps }: LayerProps) {
  return <Layer>{orderEquipmentForPlan(items).map((item) => <EquipmentNode key={item.id} item={item} selected={selectedIds.includes(item.id)} {...nodeProps} />)}</Layer>
}
