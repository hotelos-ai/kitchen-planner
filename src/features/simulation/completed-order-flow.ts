import type { Architecture, Opening } from '../../domain/project'

export const ORDER_EXIT_ANIMATION_SECONDS = 5

const cleanPass = (architecture: Architecture): Opening | undefined => architecture.openings.find((opening) => opening.kind === 'service-window' && opening.flow === 'clean-out')

export type CompletedOrderPose = { xMm: number; yMm: number; progress: number; visible: boolean; headingRad: number }

export function completedOrderPose(architecture: Architecture, elapsedSeconds: number, completedAtSeconds: number): CompletedOrderPose {
  const opening = cleanPass(architecture)
  const rawProgress = Math.max(0, (elapsedSeconds - completedAtSeconds) / ORDER_EXIT_ANIMATION_SECONDS)
  const progress = Math.min(1, rawProgress)
  if (!opening) return { xMm: architecture.widthMm / 2, yMm: architecture.depthMm / 2, progress, visible: rawProgress < 1, headingRad: 0 }
  const middle = opening.offsetMm + opening.widthMm / 2
  const inside = 90
  const distance = 760
  if (opening.wall === 'right') return { xMm: architecture.widthMm - inside + progress * distance, yMm: middle, progress, visible: rawProgress < 1, headingRad: 0 }
  if (opening.wall === 'left') return { xMm: inside - progress * distance, yMm: middle, progress, visible: rawProgress < 1, headingRad: Math.PI }
  if (opening.wall === 'top') return { xMm: middle, yMm: inside - progress * distance, progress, visible: rawProgress < 1, headingRad: -Math.PI / 2 }
  return { xMm: middle, yMm: architecture.depthMm - inside + progress * distance, progress, visible: rawProgress < 1, headingRad: Math.PI / 2 }
}
