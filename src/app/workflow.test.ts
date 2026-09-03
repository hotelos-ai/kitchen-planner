import { describe, expect, it } from 'vitest'
import { workflowStageFromDigit, workflowStageLabel } from './workflow'

describe('workflow helpers', () => {
  it('maps digits 1 2 3 onto Space, Equipment, and Simulate', () => {
    expect(workflowStageFromDigit('1')).toBe('space')
    expect(workflowStageFromDigit('2')).toBe('equipment')
    expect(workflowStageFromDigit('3')).toBe('simulate')
    expect(workflowStageFromDigit('4')).toBeUndefined()
    expect(workflowStageLabel('space')).toBe('Space')
  })
})
