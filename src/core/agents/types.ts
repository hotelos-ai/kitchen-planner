export type SpatialAgentState = 'walking' | 'working' | 'waiting' | 'blocked'

export interface SpatialAgentFrame<TRole extends string = string> {
  agentId: string
  role: TRole
  xMm: number
  yMm: number
  state: SpatialAgentState
  taskId?: string
}

export interface SpatialPlaybackFrame<TRole extends string = string> {
  elapsedSeconds: number
  agents: readonly SpatialAgentFrame<TRole>[]
}

export interface AgentRenderPose<TRole extends string = string> extends SpatialAgentFrame<TRole> {
  headingRad: number
  moving: boolean
}
