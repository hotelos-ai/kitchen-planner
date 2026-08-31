import { Layer, Line } from 'react-konva'

type Props = {
  width: number
  height: number
  pixelsPerMm: number
  originX: number
  originY: number
  snapMm: number
}

export function GridLayer({ width, height, pixelsPerMm, originX, originY, snapMm }: Props) {
  const minorPx = snapMm * pixelsPerMm
  const majorPx = 1000 * pixelsPerMm
  const lines = []

  if (minorPx >= 4) {
    for (let x = originX % minorPx; x <= width; x += minorPx) {
      const major = Math.abs((x - originX) % majorPx) < 0.5
      lines.push(<Line key={`x-${x}`} points={[x, 0, x, height]} stroke={major ? '#78918b' : '#bdc9c4'} strokeWidth={major ? 1.1 : 0.55} opacity={major ? 0.55 : 0.42} listening={false} />)
    }
    for (let y = originY % minorPx; y <= height; y += minorPx) {
      const major = Math.abs((y - originY) % majorPx) < 0.5
      lines.push(<Line key={`y-${y}`} points={[0, y, width, y]} stroke={major ? '#78918b' : '#bdc9c4'} strokeWidth={major ? 1.1 : 0.55} opacity={major ? 0.55 : 0.42} listening={false} />)
    }
  }

  return <Layer listening={false}>{lines}</Layer>
}
