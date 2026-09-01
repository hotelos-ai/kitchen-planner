import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { completedOrderPose } from './completed-order-flow'

describe('completed order flow', () => {
  it('moves a completed order through the clean service window and out of the room', () => {
    const architecture = createSeedProject().architecture
    const start = completedOrderPose(architecture, 100, 100)
    const finish = completedOrderPose(architecture, 105, 100)

    expect(start).toMatchObject({ visible: true, xMm: 3810, yMm: 2500 })
    expect(finish.visible).toBe(false)
    expect(finish.xMm).toBeGreaterThan(architecture.widthMm)
  })
})
