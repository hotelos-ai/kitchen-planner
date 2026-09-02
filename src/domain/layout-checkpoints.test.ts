import { describe, expect, it } from 'vitest'
import { createCheckpoint, restoreCheckpointOnto } from './layout-checkpoints'
import { createBlankProject } from './blank-project'

describe('layout checkpoints', () => {
  it('restores architecture and equipment onto a later revision', () => {
    const variant = createBlankProject().variants[0]
    const checkpoint = createCheckpoint(variant, 2, 'Before moving tables', () => '2026-09-02T00:00:00.000Z')
    const changed = {
      ...variant,
      architecture: { ...variant.architecture, widthMm: 9000 },
    }
    const restored = restoreCheckpointOnto(changed, checkpoint)
    expect(restored.architecture.widthMm).toBe(variant.architecture.widthMm)
    expect(restored.equipment).toEqual(checkpoint.equipment)
    expect(checkpoint.label).toBe('Before moving tables')
  })
})
