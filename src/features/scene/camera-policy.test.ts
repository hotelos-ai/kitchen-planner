import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { cameraArchitectureKey } from './camera-policy'

it('does not change the camera key for equipment-only edits', () => {
  const first = createSeedProject()
  const second = structuredClone(first)
  second.variants[0].equipment[0].xMm += 100
  expect(cameraArchitectureKey(second.architecture)).toBe(cameraArchitectureKey(first.architecture))
})

it('changes the camera key when the architectural envelope changes', () => {
  const first = createSeedProject()
  const second = structuredClone(first)
  second.architecture.widthMm += 100
  expect(cameraArchitectureKey(second.architecture)).not.toBe(cameraArchitectureKey(first.architecture))
})
