import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
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
      <Line points={polygon} closed fill="rgba(251,250,245,.92)" stroke="#25302d" strokeWidth={3} />
      {architecture.storageZones.map((zone) => (
        <Group key={zone.id} x={originX + px(zone.xMm)} y={originY + px(zone.yMm)}>
          <Rect width={px(zone.widthMm)} height={px(zone.depthMm)} fill="rgba(100,144,96,.12)" stroke="#6d8d69" strokeWidth={1.5} dash={[7, 5]} />
          <Text width={px(zone.widthMm)} height={px(zone.depthMm)} align="center" verticalAlign="middle" text={zone.label.toUpperCase()} fill="#526d4f" fontSize={10} fontStyle="bold" />
        </Group>
      ))}
      {architecture.pillars.map((pillar) => (
        <Group key={pillar.id} x={originX + px(pillar.xMm)} y={originY + px(pillar.yMm)}>
          {pillar.shape === 'round'
            ? <Circle x={px(pillar.widthMm) / 2} y={px(pillar.depthMm) / 2} radius={px(Math.min(pillar.widthMm, pillar.depthMm)) / 2} fill="#1b3a36" />
            : <Rect width={px(pillar.widthMm)} height={px(pillar.depthMm)} fill="#1b3a36" stroke="#1b3a36" strokeWidth={2} />}
          <Text width={px(pillar.widthMm)} height={px(pillar.depthMm)} align="center" verticalAlign="middle" text="PILLAR" fill="white" fontSize={Math.max(6, Math.min(9, px(pillar.widthMm) / 5))} />
        </Group>
      ))}
      {architecture.openings.map((opening) => {
        const vertical = opening.wall === 'left' || opening.wall === 'right'
        const x = opening.wall === 'left' ? originX : opening.wall === 'right' ? originX + px(architecture.widthMm) : originX + px(opening.offsetMm)
        const y = opening.wall === 'top' ? originY : opening.wall === 'bottom' ? originY + px(architecture.depthMm) : originY + px(opening.offsetMm)
        const length = px(opening.widthMm)
        const color = opening.flow === 'clean-out' ? '#4b7ce1' : opening.flow === 'dirty-in' ? '#a47932' : opening.flow === 'closed' ? '#a32f1d' : '#5e6b5a'
        return (
          <Group key={opening.id}>
            <Line points={vertical ? [x, y, x, y + length] : [x, y, x + length, y]} stroke={color} strokeWidth={opening.kind === 'sealed-opening' ? 7 : 5} dash={opening.kind === 'sealed-opening' ? [5, 4] : undefined} />
          </Group>
        )
      })}
    </Layer>
  )
}
