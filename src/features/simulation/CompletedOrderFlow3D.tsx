import { Html } from '@react-three/drei'
import type { Architecture } from '../../domain/project'
import type { deriveLiveServiceState } from '../../simulation/live-state'
import { completedOrderPose } from './completed-order-flow'

type LiveState = ReturnType<typeof deriveLiveServiceState>

export function CompletedOrderFlow3D({ architecture, liveState, elapsedSeconds }: { architecture: Architecture; liveState: LiveState; elapsedSeconds: number }) {
  return <group>
    {liveState.recentlyCompleted.map((order, index) => {
      const pose = completedOrderPose(architecture, elapsedSeconds, order.completedAtSeconds ?? elapsedSeconds)
      if (!pose.visible) return null
      return <group key={order.id} position={[pose.xMm / 1000, .96 + index * .035, pose.yMm / 1000]} rotation={[0, -pose.headingRad, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[.34, .055, .24]} /><meshStandardMaterial color="#d8d9d2" metalness={.75} roughness={.22} transparent opacity={1 - pose.progress * .5} /></mesh>
        <mesh position={[0, .055, 0]} castShadow><cylinderGeometry args={[.105, .12, .035, 24]} /><meshStandardMaterial color="#d76f50" roughness={.6} /></mesh>
        <Html center position={[0, .18, 0]} className="outgoing-order-label"><span>{order.id.replace('order-', '#')} · OUT</span></Html>
      </group>
    })}
  </group>
}
