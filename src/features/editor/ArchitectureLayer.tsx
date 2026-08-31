import { Group, Layer, Line, Rect, Text } from 'react-konva'
import type { Architecture } from '../../domain/project'

type Props = {
  architecture: Architecture
  pixelsPerMm: number
  originX: number
  originY: number
}

export function ArchitectureLayer({ architecture, pixelsPerMm: scale, originX, originY }: Props) {
  const px = (value: number) => value * scale
  const polygon = architecture.roomPolygon.flatMap((point) => [originX + px(point.x), originY + px(point.y)])

  return (
    <Layer listening={!architecture.locked}>
      <Line points={polygon} closed fill="rgba(255,254,249,.86)" stroke="#25302d" strokeWidth={3} />
      {architecture.storageZones.map((zone) => (
        <Group key={zone.id} x={originX + px(zone.xMm)} y={originY + px(zone.yMm)}>
          <Rect width={px(zone.widthMm)} height={px(zone.depthMm)} fill="rgba(100,144,96,.12)" stroke="#6d8d69" strokeWidth={1.5} dash={[7, 5]} />
          <Text width={px(zone.widthMm)} height={px(zone.depthMm)} align="center" verticalAlign="middle" text={zone.label.toUpperCase()} fill="#526d4f" fontSize={10} fontStyle="bold" />
        </Group>
      ))}
      {architecture.pillars.map((pillar) => (
        <Group key={pillar.id} x={originX + px(pillar.xMm)} y={originY + px(pillar.yMm)}>
          <Rect width={px(pillar.widthMm)} height={px(pillar.depthMm)} fill="#4b514e" stroke="#202623" strokeWidth={2} />
          <Text width={px(pillar.widthMm)} height={px(pillar.depthMm)} align="center" verticalAlign="middle" text="PILLAR" fill="white" fontSize={Math.max(6, Math.min(9, px(pillar.widthMm) / 5))} />
        </Group>
      ))}
      {architecture.openings.map((opening) => {
        const vertical = opening.wall === 'left' || opening.wall === 'right'
        const x = opening.wall === 'left' ? originX : opening.wall === 'right' ? originX + px(architecture.widthMm) : originX + px(opening.offsetMm)
        const y = opening.wall === 'top' ? originY : opening.wall === 'bottom' ? originY + px(architecture.depthMm) : originY + px(opening.offsetMm)
        const length = px(opening.widthMm)
        const color = opening.flow === 'clean-out' ? '#27838a' : opening.flow === 'dirty-in' ? '#aa8435' : opening.flow === 'closed' ? '#b65443' : '#4d665f'
        return (
          <Group key={opening.id}>
            <Line points={vertical ? [x, y, x, y + length] : [x, y, x + length, y]} stroke={color} strokeWidth={opening.kind === 'sealed-opening' ? 7 : 5} dash={opening.kind === 'sealed-opening' ? [5, 4] : undefined} />
            <Text x={vertical ? x - 106 : x} y={vertical ? y + 5 : y - 17} width={vertical ? 100 : length} align={vertical ? 'right' : 'center'} text={opening.label} fill={color} fontSize={8} fontStyle="bold" />
          </Group>
        )
      })}
    </Layer>
  )
}
