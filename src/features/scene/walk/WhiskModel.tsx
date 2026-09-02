/* eslint-disable react-refresh/only-export-components */
export function whiskVisualDescriptor() {
  return {
    reusable: true as const,
    parts: ['grip', 'tang', 'wires', 'tip'] as const,
    lengthM: .26,
  }
}

export function WhiskModel({ depthTest = false }: { depthTest?: boolean }) {
  return <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh position={[0, .07, 0]} castShadow>
      <capsuleGeometry args={[.015, .1, 5, 10]} />
      <meshStandardMaterial color="#252a29" roughness={.72} depthTest={depthTest} />
    </mesh>
    <mesh position={[0, -.005, 0]} castShadow>
      <cylinderGeometry args={[.008, .008, .05, 10]} />
      <meshStandardMaterial color="#aeb7b6" metalness={.78} roughness={.28} depthTest={depthTest} />
    </mesh>
    {[0, 1, 2].map((wire) => <mesh key={wire} position={[0, -.075, 0]} rotation={[0, (wire * Math.PI) / 3, 0]} scale={[1, 1.3, 1]} castShadow>
      <torusGeometry args={[.024, .0032, 6, 14]} />
      <meshStandardMaterial color="#8f9997" metalness={.7} roughness={.32} depthTest={depthTest} />
    </mesh>)}
    <mesh position={[0, -.115, 0]}>
      <sphereGeometry args={[.007, 8, 8]} />
      <meshStandardMaterial color="#8f9997" metalness={.7} roughness={.32} depthTest={depthTest} />
    </mesh>
  </group>
}

WhiskModel.displayName = 'WhiskModel'
