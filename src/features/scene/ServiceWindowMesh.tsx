import { Edges, Html } from '@react-three/drei'
import type { ServiceWindowFixture } from './wall-geometry'

const toWorld = (millimetres: number) => millimetres / 1000

export function ServiceWindowMesh({ fixture }: { fixture: ServiceWindowFixture }) {
  const width = toWorld(fixture.widthMm)
  const openingHeight = toWorld(fixture.openingHeightMm)
  const isClean = fixture.flow === 'clean-out'
  const color = isClean ? '#2f827f' : '#b6842c'
  const direction = isClean ? -1 : 1
  return (
    <group position={[toWorld(fixture.centerMm.x), toWorld(fixture.sillHeightMm), toWorld(fixture.centerMm.z)]} rotation={[0, fixture.rotationYRad, 0]}>
      <mesh position={[0, .03, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + .14, .06, .46]} />
        <meshStandardMaterial color="#bfc8c5" metalness={.78} roughness={.28} />
        <Edges color="#30403b" />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * (width / 2 + .025), openingHeight / 2, 0]}>
        <boxGeometry args={[.05, openingHeight, .1]} />
        <meshStandardMaterial color="#8d9995" metalness={.66} roughness={.34} />
        <Edges color="#30403b" />
      </mesh>)}
      <mesh position={[0, openingHeight, 0]}>
        <boxGeometry args={[width + .1, .06, .1]} />
        <meshStandardMaterial color="#8d9995" metalness={.66} roughness={.34} />
        <Edges color="#30403b" />
      </mesh>
      <group position={[0, .09, direction * .52]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, -.12 * direction, 0]}><boxGeometry args={[.09, .32, .025]} /><meshBasicMaterial color={color} /></mesh>
        <mesh position={[0, -.31 * direction, 0]} rotation={[0, 0, direction > 0 ? Math.PI : 0]}><coneGeometry args={[.16, .28, 3]} /><meshBasicMaterial color={color} /></mesh>
      </group>
      <Html position={[0, openingHeight + .18, 0]} center distanceFactor={7} className={`pass-label ${isClean ? 'clean' : 'dirty'}`}>
        <span>{isClean ? 'Clean pass · orders out' : 'Dirty return · dishes in'}</span>
      </Html>
    </group>
  )
}
