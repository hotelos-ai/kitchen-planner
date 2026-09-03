import { Arc, Group, Layer, Line, Rect, Text } from 'react-konva'
import type { Architecture } from '../../domain/project'

export function OpeningOverlayLayer({ architecture, pixelsPerMm: scale, originX, originY }: { architecture: Architecture; pixelsPerMm: number; originX: number; originY: number }) {
  const px = (value: number) => value * scale
  return <Layer listening={false}>{architecture.openings.map((opening) => {
    const vertical = opening.wall === 'left' || opening.wall === 'right'
    const x = opening.wall === 'left' ? originX : opening.wall === 'right' ? originX + px(architecture.widthMm) : originX + px(opening.offsetMm)
    const y = opening.wall === 'top' ? originY : opening.wall === 'bottom' ? originY + px(architecture.depthMm) : originY + px(opening.offsetMm)
    const length = px(opening.widthMm)
    const color = opening.flow === 'clean-out' ? '#4b7ce1' : opening.flow === 'dirty-in' ? '#a47932' : opening.flow === 'closed' ? '#a32f1d' : '#5e6b5a'
    const labelWidth = vertical ? 104 : Math.max(90, length)
    const labelX = vertical ? (opening.wall === 'right' ? x - labelWidth - 5 : x + 5) : x + (length - labelWidth) / 2
    const labelY = vertical ? y + length / 2 - 10 : y - 20
    return <Group key={opening.id}>
      <Line points={vertical ? [x, y, x, y + length] : [x, y, x + length, y]} stroke={color} strokeWidth={opening.kind === 'sealed-opening' ? 7 : 5} dash={opening.kind === 'sealed-opening' ? [5, 4] : undefined} />
      {opening.kind === 'door' && opening.swingDepthMm && <Arc x={x} y={y} innerRadius={px(opening.swingDepthMm) - 1} outerRadius={px(opening.swingDepthMm)} angle={90} rotation={opening.wall === 'left' ? 0 : opening.wall === 'right' ? 90 : opening.wall === 'top' ? 90 : 270} fill={color} opacity={.7} />}
      <Rect x={labelX} y={labelY} width={labelWidth} height={20} cornerRadius={3} fill="rgba(255,254,249,.9)" stroke={color} strokeWidth={.7} />
      <Text x={labelX + 3} y={labelY + 4} width={labelWidth - 6} height={13} align="center" verticalAlign="middle" text={opening.label} fill={color} fontSize={7.5} fontStyle="bold" ellipsis />
    </Group>
  })}</Layer>
}
