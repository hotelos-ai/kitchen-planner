import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Architecture, Opening, PointMm } from '../../domain/project'
import { ServiceWindowMesh } from './ServiceWindowMesh'
import { buildWallPanels, serviceWindowFixtures, type WallPanel } from './wall-geometry'

// Shared by procedural scene modules and synchronization tests.
// eslint-disable-next-line react-refresh/only-export-components
export const toWorld = (millimetres: number) => millimetres / 1000

type WallSegment = {
  id: string
  start: PointMm
  end: PointMm
}

const pointOnEdge = (start: PointMm, end: PointMm, distanceMm: number): PointMm => {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const ratio = length ? distanceMm / length : 0
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
}

const wallName = (start: PointMm, end: PointMm, architecture: Architecture): Opening['wall'] | null => {
  if (start.y === 0 && end.y === 0) return 'top'
  if (start.x === architecture.widthMm && end.x === architecture.widthMm) return 'right'
  if (start.y === architecture.depthMm && end.y === architecture.depthMm) return 'bottom'
  if (start.x === 0 && end.x === 0) return 'left'
  return null
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildWallSegments(architecture: Architecture): WallSegment[] {
  const segments: WallSegment[] = []
  const points = architecture.roomPolygon
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length]
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y)
    const wall = wallName(start, end, architecture)
    const runsInOffsetDirection = !wall || (wall === 'top' || wall === 'bottom' ? end.x >= start.x : end.y >= start.y)
    const openings = wall
      ? architecture.openings
        .filter((opening) => opening.wall === wall && opening.kind !== 'sealed-opening')
        .map((opening) => runsInOffsetDirection
          ? { start: opening.offsetMm, end: opening.offsetMm + opening.widthMm }
          : { start: edgeLength - opening.offsetMm - opening.widthMm, end: edgeLength - opening.offsetMm })
        .filter((opening) => opening.start < edgeLength && opening.end > 0)
        .sort((left, right) => left.start - right.start)
      : []
    let cursor = 0
    openings.forEach((opening, openingIndex) => {
      const gapStart = Math.max(0, opening.start)
      const gapEnd = Math.min(edgeLength, opening.end)
      if (gapStart > cursor) segments.push({ id: `wall-${index}-${openingIndex}`, start: pointOnEdge(start, end, cursor), end: pointOnEdge(start, end, gapStart) })
      cursor = Math.max(cursor, gapEnd)
    })
    if (cursor < edgeLength) segments.push({ id: `wall-${index}-end`, start: pointOnEdge(start, end, cursor), end })
  })
  return segments
}

function FloorMesh({ polygon }: { polygon: PointMm[] }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    polygon.forEach((point, index) => {
      const x = toWorld(point.x)
      const y = -toWorld(point.y)
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [polygon])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#d9d3c7" roughness={0.95} />
    </mesh>
  )
}

function WallMesh({ panel, transparent }: { panel: WallPanel; transparent: boolean }) {
  return (
    <mesh position={[toWorld(panel.centerMm.x), toWorld(panel.centerMm.y), toWorld(panel.centerMm.z)]} rotation={[0, panel.rotationYRad, 0]} castShadow receiveShadow>
      <boxGeometry args={[toWorld(panel.sizeMm.width), toWorld(panel.sizeMm.height), toWorld(panel.sizeMm.depth)]} />
      <meshStandardMaterial color="#f3efe5" roughness={0.88} transparent={transparent} opacity={transparent ? .16 : 1} depthWrite={!transparent} />
      <Edges color="#34413d" threshold={15} />
    </mesh>
  )
}

export function ArchitectureMesh({ architecture, wallsTransparent = false }: { architecture: Architecture; wallsTransparent?: boolean }) {
  const heightM = toWorld(architecture.wallHeightMm)
  return (
    <group>
      <FloorMesh polygon={architecture.roomPolygon} />
      {buildWallPanels(architecture).map((panel) => <WallMesh key={panel.id} panel={panel} transparent={wallsTransparent} />)}
      {serviceWindowFixtures(architecture).map((fixture) => <ServiceWindowMesh key={fixture.id} fixture={fixture} />)}
      {architecture.pillars.map((pillar) => (
        <mesh key={pillar.id} position={[toWorld(pillar.xMm + pillar.widthMm / 2), heightM / 2, toWorld(pillar.yMm + pillar.depthMm / 2)]} castShadow receiveShadow>
          <boxGeometry args={[toWorld(pillar.widthMm), heightM, toWorld(pillar.depthMm)]} />
          <meshStandardMaterial color="#555d59" roughness={0.82} />
        </mesh>
      ))}
      {architecture.storageZones.map((zone) => (
        <mesh key={zone.id} position={[toWorld(zone.xMm + zone.widthMm / 2), 0.012, toWorld(zone.yMm + zone.depthMm / 2)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[toWorld(zone.widthMm), toWorld(zone.depthMm)]} />
          <meshStandardMaterial color="#789472" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
