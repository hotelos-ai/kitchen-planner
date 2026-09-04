import type { Architecture, DisplayUnit, EquipmentItem } from '../../domain/project'
import { formatLength } from '../../domain/units'
import { doorSwingGeometry } from '../../domain/opening-geometry'

type Style = { fill: string; outline: string; hatch: string }

export type RectClearanceDescriptor = Style & {
  id: string
  shape: 'rect'
  kind: 'work' | 'heat' | 'service'
  label: string
  xMm: number
  yMm: number
  widthMm: number
  depthMm: number
  frontOffsetMm: number
  rotationDeg: number
}

export type ArcClearanceDescriptor = Style & {
  id: string
  shape: 'arc'
  kind: 'door-swing'
  label: string
  xMm: number
  yMm: number
  radiusMm: number
  rotationDeg: number
  sweepDeg: number
}

export type ClearanceDescriptor = RectClearanceDescriptor | ArcClearanceDescriptor

const STYLES: Record<ClearanceDescriptor['kind'], Style> = {
  heat: { fill: '#ed7652', outline: '#9f321f', hatch: '#b7442b' },
  work: { fill: '#51a99c', outline: '#1f6f67', hatch: '#2d8177' },
  service: { fill: '#7186c4', outline: '#384f91', hatch: '#4e65a7' },
  'door-swing': { fill: '#e1aa42', outline: '#8b5b0d', hatch: '#a66f16' },
}

export function buildClearanceDescriptors(items: readonly EquipmentItem[], architecture: Architecture, unit: DisplayUnit): ClearanceDescriptor[] {
  const descriptors: ClearanceDescriptor[] = items.filter((item) => item.clearance?.frontMm).map((item) => {
    const clearance = item.clearance!
    const kind = clearance.kind === 'heat' ? 'heat' : clearance.kind === 'service' ? 'service' : 'work'
    return {
      id: `clearance-${item.id}`, shape: 'rect' as const, kind,
      label: `${kind === 'heat' ? 'Heat' : kind === 'service' ? 'Service' : 'Work'} clearance · ${formatLength(clearance.frontMm, unit)}`,
      xMm: item.xMm, yMm: item.yMm, widthMm: item.widthMm, depthMm: clearance.frontMm, frontOffsetMm: item.depthMm,
      rotationDeg: item.rotationDeg, ...STYLES[kind],
    }
  })

  architecture.openings.filter((opening) => opening.kind === 'door' && opening.swingDepthMm).forEach((opening) => {
    const swing = doorSwingGeometry(architecture, opening)
    if (!swing) return
    descriptors.push({ id: `swing-${opening.id}`, shape: 'arc', kind: 'door-swing', label: `${opening.label} swing · ${formatLength(opening.swingDepthMm!, unit)}`, xMm: swing.hinge.x, yMm: swing.hinge.y, radiusMm: swing.radiusMm, rotationDeg: swing.startAngleRad * 180 / Math.PI, sweepDeg: swing.sweepAngleRad * 180 / Math.PI, ...STYLES['door-swing'] })
  })

  items.filter((item) => item.category === 'cold' && /fridge|freezer/i.test(item.label)).forEach((item) => {
    const radiusMm = Math.min(item.widthMm, item.clearance?.frontMm ?? item.depthMm)
    descriptors.push({ id: `swing-${item.id}`, shape: 'arc', kind: 'door-swing', label: `Door swing · ${formatLength(radiusMm, unit)}`, xMm: item.xMm, yMm: item.yMm + item.depthMm, radiusMm, rotationDeg: item.rotationDeg, sweepDeg: 90, ...STYLES['door-swing'] })
  })
  return descriptors
}
