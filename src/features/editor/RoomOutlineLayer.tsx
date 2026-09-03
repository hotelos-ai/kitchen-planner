import { useState } from 'react'
import { Circle, Group, Layer, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Architecture, PointMm } from '../../domain/project'
import { edgeMidpoint, insertVertexOnSegment, moveOpening, movePillar, moveVertex, openingCenter, slideEdge } from './room-outline'

type Props = {
  architecture: Architecture
  pixelsPerMm: number
  originX: number
  originY: number
  snapMm: number
  onCommit(next: Architecture): void
}

const HANDLE_RADIUS = 8
const INSERT_RADIUS = 11
const OPENING_RADIUS = 9
const PILLAR_HALF = 8

const setCursor = (node: Konva.Node, cursor: string) => {
  const stage = node.getStage()
  stage?.container().style.setProperty('cursor', cursor)
}

export function RoomOutlineLayer({ architecture, pixelsPerMm, originX, originY, snapMm, onCommit }: Props) {
  const [dragPolygon, setDragPolygon] = useState<PointMm[] | null>(null)
  const [draggingEdge, setDraggingEdge] = useState<number | null>(null)
  const polygon = dragPolygon ?? architecture.roomPolygon

  const toPx = (point: PointMm) => ({ x: originX + point.x * pixelsPerMm, y: originY + point.y * pixelsPerMm })
  const toMm = (x: number, y: number) => ({ x: (x - originX) / pixelsPerMm, y: (y - originY) / pixelsPerMm })

  const commitVertex = (index: number, node: Konva.Node) => {
    setDragPolygon(null)
    onCommit(moveVertex(architecture, index, toMm(node.x(), node.y()), snapMm))
  }

  return (
    <Layer>
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
              onMouseEnter={(event) => { const stage = event.target.getStage(); stage?.container().style.setProperty('cursor', 'copy') }}
              onMouseLeave={(event) => { const stage = event.target.getStage(); stage?.container().style.setProperty('cursor', 'default') }}
              onClick={() => onCommit(insertVertexOnSegment(architecture, index, edgeMidpoint(architecture.roomPolygon, index), snapMm))}
            />
          </Group>
        )
      })}
      {polygon.map((vertex, index) => {
        const position = toPx(vertex)
        return (
          <Circle
            key={`outline-vertex-${index}`}
            x={position.x}
            y={position.y}
            radius={HANDLE_RADIUS}
            fill="#fbfaf5"
            stroke="#1b3a36"
            strokeWidth={2.5}
            draggable
            hitStrokeWidth={24}
            onMouseEnter={(event) => { const stage = event.target.getStage(); stage?.container().style.setProperty('cursor', 'grab') }}
            onMouseLeave={(event) => { const stage = event.target.getStage(); stage?.container().style.setProperty('cursor', 'default') }}
            onDragMove={(event) => {
              const node = event.target
              const point = toMm(node.x(), node.y())
              const snapped = { x: Math.max(0, Math.round(point.x / snapMm) * snapMm), y: Math.max(0, Math.round(point.y / snapMm) * snapMm) }
              setDragPolygon(architecture.roomPolygon.map((candidate, position) => position === index ? snapped : candidate))
            }}
            onDragEnd={(event) => commitVertex(index, event.target)}
          />
        )
      })}
      {architecture.openings.map((opening, index) => {
        const position = toPx(openingCenter(architecture, opening))
        return (
          <Group key={`outline-opening-${opening.id}`} draggable
            onDragStart={(event) => setCursor(event.target, 'move')}
            onDragEnd={(event) => {
              const node = event.target
              const point = toMm(node.x() + position.x, node.y() + position.y)
              node.position({ x: 0, y: 0 })
              setCursor(node, 'default')
              onCommit(moveOpening(architecture, index, point, snapMm))
            }}
          >
            <Circle x={position.x} y={position.y} radius={OPENING_RADIUS} fill="#ca4e8e" opacity={0.9} stroke="#fbfaf5" strokeWidth={2} hitStrokeWidth={22} />
            <Circle x={position.x} y={position.y} radius={3} fill="#fbfaf5" listening={false} />
          </Group>
        )
      })}
      {architecture.pillars.map((pillar, index) => {
        const position = toPx({ x: pillar.xMm + pillar.widthMm / 2, y: pillar.yMm + pillar.depthMm / 2 })
        return (
          <Rect key={`outline-pillar-${pillar.id}`} x={position.x - PILLAR_HALF} y={position.y - PILLAR_HALF}
            width={PILLAR_HALF * 2} height={PILLAR_HALF * 2} cornerRadius={3}
            fill="#fbfaf5" stroke="#1b3a36" strokeWidth={2.5} draggable hitStrokeWidth={22}
            onMouseEnter={(event) => setCursor(event.target, 'move')}
            onMouseLeave={(event) => setCursor(event.target, 'default')}
            onDragEnd={(event) => {
              const node = event.target
              const point = toMm(node.x() + PILLAR_HALF, node.y() + PILLAR_HALF)
              onCommit(movePillar(architecture, index, point, snapMm))
            }}
          />
        )
      })}
    </Layer>
  )
}
