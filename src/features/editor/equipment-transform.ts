import { normalizeRotation, snapMm as snapValue } from '../../domain/geometry'
import type { EquipmentItem } from '../../domain/project'

type CanvasTransform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
type TransformContext = {
  widthMm: number
  depthMm: number
  originX: number
  originY: number
  pixelsPerMm: number
  snapMm: number
}

export function equipmentTransformPatch(transform: CanvasTransform, context: TransformContext): Pick<EquipmentItem, 'xMm' | 'yMm' | 'widthMm' | 'depthMm' | 'rotationDeg'> {
  const snap = context.snapMm
  return {
    xMm: snapValue((transform.x - context.originX) / context.pixelsPerMm, snap),
    yMm: snapValue((transform.y - context.originY) / context.pixelsPerMm, snap),
    widthMm: Math.max(snap, snapValue(context.widthMm * Math.abs(transform.scaleX), snap)),
    depthMm: Math.max(snap, snapValue(context.depthMm * Math.abs(transform.scaleY), snap)),
    rotationDeg: normalizeRotation(transform.rotation),
  }
}
