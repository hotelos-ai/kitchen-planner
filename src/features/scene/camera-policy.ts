import type { Architecture } from '../../domain/project'

export function cameraArchitectureKey(architecture: Architecture): string {
  return JSON.stringify({
    widthMm: architecture.widthMm,
    depthMm: architecture.depthMm,
    wallHeightMm: architecture.wallHeightMm,
    roomPolygon: architecture.roomPolygon,
  })
}
