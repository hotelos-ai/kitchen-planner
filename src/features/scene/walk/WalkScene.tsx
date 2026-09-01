import type { Architecture, EquipmentItem } from '../../../domain/project'
import { FirstPersonController } from './FirstPersonController'
import { FirstPersonHands } from './FirstPersonHands'
import type { WalkPlayerPosition } from './types'

export function WalkScene({ active, architecture, equipment, staff, reducedMotion, onLockedChange, onNearbyChange, onPositionChange }: {
  active: boolean
  architecture: Architecture
  equipment: readonly EquipmentItem[]
  staff?: readonly { agentId: string; xMm: number; yMm: number }[]
  reducedMotion?: boolean
  onLockedChange?(locked: boolean): void
  onNearbyChange?(nearby: boolean): void
  onPositionChange?(position: WalkPlayerPosition): void
}) {
  if (!active) return null
  return <>
    <FirstPersonController active architecture={architecture} equipment={equipment} staff={staff} onLockedChange={onLockedChange} onNearbyChange={onNearbyChange} onPositionChange={onPositionChange} />
    <FirstPersonHands reducedMotion={reducedMotion} />
  </>
}
