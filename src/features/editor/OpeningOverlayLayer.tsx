import { Arrow, Group, Layer, Line, Rect, Text } from 'react-konva'
import type { Architecture } from '../../domain/project'
import { doorSwingGeometries } from '../../domain/opening-geometry'
import { openingEnds } from './room-outline'

export function OpeningOverlayLayer({ architecture, pixelsPerMm: scale, originX, originY }: { architecture: Architecture; pixelsPerMm: number; originX: number; originY: number }) {
  const px = (value: number) => value * scale
  return <Layer listening={false}>{architecture.openings.map((opening) => {
    const ends = openingEnds(architecture, opening)
    const start = { x: originX + px(ends.start.x), y: originY + px(ends.start.y) }
    const end = { x: originX + px(ends.end.x), y: originY + px(ends.end.y) }
    const vertical = Math.abs(end.y - start.y) > Math.abs(end.x - start.x)
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    const color = opening.kind === 'window' ? '#56879b' : opening.flow === 'clean-out' ? '#4b7ce1' : opening.flow === 'dirty-in' ? '#a47932' : opening.flow === 'closed' ? '#a32f1d' : '#5e6b5a'
    const labelWidth = vertical ? 104 : Math.max(90, length)
    const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const labelX = vertical ? (opening.wall === 'right' ? center.x - labelWidth - 5 : center.x + 5) : center.x - labelWidth / 2
    const labelY = vertical ? center.y - 10 : center.y - 20
    const swings = doorSwingGeometries(architecture, opening)
    const sliding = opening.kind === 'door' && (opening.doorType === 'sliding' || opening.doorType === 'double-sliding')
    const slideOffset = length ? { x: -(end.y - start.y) / length * 7, y: (end.x - start.x) / length * 7 } : { x: 0, y: 0 }
    const slideStart = { x: start.x + slideOffset.x, y: start.y + slideOffset.y }
    const slideEnd = { x: end.x + slideOffset.x, y: end.y + slideOffset.y }
    const slideCenter = { x: (slideStart.x + slideEnd.x) / 2, y: (slideStart.y + slideEnd.y) / 2 }
    return <Group key={opening.id}>
      <Line points={[start.x, start.y, end.x, end.y]} stroke={color} strokeWidth={opening.kind === 'sealed-opening' ? 7 : 5} dash={opening.kind === 'sealed-opening' ? [5, 4] : undefined} />
      {swings.map((swing, index) => <Group key={`swing-${index}`}>
        <Line points={swing.arc.flatMap((point) => [originX + px(point.x), originY + px(point.y)])} stroke={color} strokeWidth={1.5} opacity={.75} />
        <Line points={[originX + px(swing.hinge.x), originY + px(swing.hinge.y), originX + px(swing.openEnd.x), originY + px(swing.openEnd.y)]} stroke={color} strokeWidth={2} opacity={.75} />
      </Group>)}
      {sliding && opening.doorType === 'sliding' && <Arrow
        points={(opening.swingHinge ?? 'start') === 'start' ? [slideEnd.x, slideEnd.y, slideStart.x, slideStart.y] : [slideStart.x, slideStart.y, slideEnd.x, slideEnd.y]}
        stroke={color} fill={color} strokeWidth={1.5} pointerLength={5} pointerWidth={5} opacity={.8}
      />}
      {sliding && opening.doorType === 'double-sliding' && <>
        <Arrow points={[slideCenter.x, slideCenter.y, slideStart.x, slideStart.y]} stroke={color} fill={color} strokeWidth={1.5} pointerLength={5} pointerWidth={5} opacity={.8} />
        <Arrow points={[slideCenter.x, slideCenter.y, slideEnd.x, slideEnd.y]} stroke={color} fill={color} strokeWidth={1.5} pointerLength={5} pointerWidth={5} opacity={.8} />
      </>}
      <Rect x={labelX} y={labelY} width={labelWidth} height={20} cornerRadius={3} fill="rgba(255,254,249,.9)" stroke={color} strokeWidth={.7} />
      <Text x={labelX + 3} y={labelY + 4} width={labelWidth - 6} height={13} align="center" verticalAlign="middle" text={opening.label} fill={color} fontSize={7.5} fontStyle="bold" ellipsis />
    </Group>
  })}</Layer>
}
