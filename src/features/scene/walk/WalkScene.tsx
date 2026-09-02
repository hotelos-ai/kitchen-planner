import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Architecture, EquipmentItem } from '../../../domain/project'
import { ChefAvatar } from '../agents/ChefAvatar'
import { FirstPersonController } from './FirstPersonController'
import { FirstPersonHands } from './FirstPersonHands'
import { buildWalkColliders, resolveWalkSpawn, type WalkSpawnResolution } from './walk-collision'
import type { WalkPlayerPose, WalkPlayerPosition, WalkViewMode } from './types'

export type WalkAvailability = { status: 'idle' } | WalkSpawnResolution

export function WalkScene({ active, view = 'first-person', architecture, equipment, staff, reducedMotion, retrySignal = 0, onAvailabilityChange, onLockedChange, onNearbyChange, onPositionChange }: {
  active: boolean
  view?: WalkViewMode
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  staff?: readonly { agentId: string; xMm: number; yMm: number }[]
  reducedMotion?: boolean
  retrySignal?: number
  onAvailabilityChange?(availability: WalkAvailability): void
  onLockedChange?(locked: boolean): void
  onNearbyChange?(nearby: boolean): void
  onPositionChange?(position: WalkPlayerPosition): void
}) {
  const [playerPose, setPlayerPose] = useState<WalkPlayerPose>()
  const resolution = useMemo(
    () => {
      void retrySignal
      return resolveWalkSpawn(architecture, buildWalkColliders(architecture, equipment))
    },
    [architecture, equipment, retrySignal],
  )
  useEffect(() => {
    onAvailabilityChange?.(active ? resolution : { status: 'idle' })
  }, [active, onAvailabilityChange, resolution])
  const handlePoseChange = useCallback((pose: WalkPlayerPose) => {
    setPlayerPose(pose)
    onPositionChange?.(pose)
  }, [onPositionChange])

  if (!active) return null
  if (resolution.status === 'unavailable') return null
  return <>
    <FirstPersonController active view={view} architecture={architecture} equipment={equipment} spawn={resolution.spawn} staff={staff} onLockedChange={onLockedChange} onNearbyChange={onNearbyChange} onPoseChange={handlePoseChange} />
    {view === 'first-person' && <FirstPersonHands pose={playerPose} reducedMotion={reducedMotion} />}
    {view === 'third-person' && playerPose && <group position={[playerPose.x / 1000, playerPose.elevationMm / 1000, playerPose.y / 1000]}>
      <ChefAvatar player reducedMotion={Boolean(reducedMotion)} pose={{ agentId: 'player-chef', role: 'head-chef', xMm: playerPose.x, yMm: playerPose.y, state: playerPose.locomotion === 'idle' ? 'waiting' : 'walking', headingRad: playerPose.headingRad, moving: playerPose.locomotion === 'walking' || playerPose.locomotion === 'running' }} />
    </group>}
  </>
}
