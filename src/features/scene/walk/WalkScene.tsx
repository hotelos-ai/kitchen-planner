import { useEffect, useMemo } from 'react'
import type { Architecture, EquipmentItem } from '../../../domain/project'
import { FirstPersonController } from './FirstPersonController'
import { FirstPersonHands } from './FirstPersonHands'
import { buildWalkColliders, resolveWalkSpawn, type WalkSpawnResolution } from './walk-collision'
import type { WalkPlayerPosition } from './types'

export type WalkAvailability = { status: 'idle' } | WalkSpawnResolution

export function WalkScene({ active, architecture, equipment, staff, reducedMotion, retrySignal = 0, onAvailabilityChange, onLockedChange, onNearbyChange, onPositionChange }: {
  active: boolean
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

  if (!active) return null
  if (resolution.status === 'unavailable') return null
  return <>
    <FirstPersonController active architecture={architecture} equipment={equipment} spawn={resolution.spawn} staff={staff} onLockedChange={onLockedChange} onNearbyChange={onNearbyChange} onPositionChange={onPositionChange} />
    <FirstPersonHands reducedMotion={reducedMotion} />
  </>
}
