import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

export function FirstPersonHands({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const group = useRef<Group>(null)
  const camera = useThree((state) => state.camera)
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.position.copy(camera.position)
    group.current.quaternion.copy(camera.quaternion)
    group.current.translateZ(-.48)
    group.current.translateY(-.36 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2) * .004))
  })
  return <group ref={group} renderOrder={20}>
    {[-1, 1].map((side) => <group key={side} position={[side * .24, 0, 0]} rotation={[.16, 0, side * -.12]}>
      <mesh><capsuleGeometry args={[.055, .24, 5, 10]} /><meshStandardMaterial color="#fff9ef" roughness={.62} depthTest={false} /></mesh>
      <mesh position={[0, -.17, 0]}><cylinderGeometry args={[.061, .061, .045, 12]} /><meshStandardMaterial color="#b95f47" roughness={.55} depthTest={false} /></mesh>
      <mesh position={[0, -.25, 0]}><sphereGeometry args={[.062, 12, 10]} /><meshStandardMaterial color="#bc8766" roughness={.78} depthTest={false} /></mesh>
    </group>)}
  </group>
}
