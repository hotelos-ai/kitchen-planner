/* eslint-disable react-refresh/only-export-components */
export function spatulaVisualDescriptor() {
  return {
    reusable: true as const,
    parts: ['grip', 'tang', 'blade', 'blade-slots'] as const,
    lengthM: .34,
  }
}

export function SpatulaModel({ depthTest = false }: { depthTest?: boolean }) {
  return <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh position={[0, .09, 0]} castShadow>
      <capsuleGeometry args={[.018, .13, 5, 10]} />
      <meshStandardMaterial color="#252a29" roughness={.72} depthTest={depthTest} />
    </mesh>
    <mesh position={[0, -.015, 0]} castShadow>
      <cylinderGeometry args={[.009, .009, .08, 10]} />
      <meshStandardMaterial color="#aeb7b6" metalness={.78} roughness={.28} depthTest={depthTest} />
    </mesh>
    <mesh position={[0, -.115, 0]} scale={[1, 1, .22]} castShadow>
      <boxGeometry args={[.105, .14, .018]} />
      <meshStandardMaterial color="#2e3436" metalness={.6} roughness={.35} depthTest={depthTest} />
    </mesh>
    {[-.028, 0, .028].map((x) => <mesh key={x} position={[x, -.115, -.003]}>
      <boxGeometry args={[.01, .085, .008]} />
      <meshStandardMaterial color="#c9d2d0" metalness={.7} roughness={.3} depthTest={depthTest} />
    </mesh>)}
  </group>
}

SpatulaModel.displayName = 'SpatulaModel'
