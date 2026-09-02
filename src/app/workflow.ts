export type WorkflowStage = 'space' | 'equipment' | 'simulate'

export type ViewMode = 'plan' | 'scene' | 'split'

export type WorkspaceOverlay = 'compare' | 'auto-layout' | null

export const WORKFLOW_STAGES: { id: WorkflowStage; step: number; label: string }[] = [
  { id: 'space', step: 1, label: 'Space' },
  { id: 'equipment', step: 2, label: 'Equipment' },
  { id: 'simulate', step: 3, label: 'Simulate' },
]

export const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'scene', label: '3D' },
  { id: 'split', label: 'Split' },
]

export function workflowStageLabel(stage: WorkflowStage): string {
  return WORKFLOW_STAGES.find((entry) => entry.id === stage)?.label ?? stage
}
