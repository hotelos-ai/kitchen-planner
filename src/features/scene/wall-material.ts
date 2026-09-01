export type WallSurfaceRenderState = {
  transparent: boolean
  opacity: number
  colorWrite: boolean
  depthWrite: boolean
  castShadow: boolean
}

export const wallSurfaceRenderState = (outlineOnly: boolean): WallSurfaceRenderState => outlineOnly
  ? { transparent: true, opacity: 0, colorWrite: false, depthWrite: false, castShadow: false }
  : { transparent: false, opacity: 1, colorWrite: true, depthWrite: true, castShadow: true }
