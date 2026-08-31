import { describe, expect, it } from 'vitest'
import { equipmentTransformPatch } from './equipment-transform'

describe('equipment canvas transforms', () => {
  it('snaps resized dimensions and position while normalizing rotation', () => {
    expect(equipmentTransformPatch({ x: 187, y: 243, scaleX: 1.34, scaleY: .73, rotation: -90 }, {
      widthMm: 700,
      depthMm: 800,
      originX: 40,
      originY: 50,
      pixelsPerMm: .1,
      snapMm: 100,
    })).toEqual({ xMm: 1500, yMm: 1900, widthMm: 900, depthMm: 600, rotationDeg: 270 })
  })

  it('keeps transformed equipment at least one snap square wide and deep', () => {
    expect(equipmentTransformPatch({ x: 0, y: 0, scaleX: .01, scaleY: .01, rotation: 0 }, {
      widthMm: 700,
      depthMm: 800,
      originX: 0,
      originY: 0,
      pixelsPerMm: 1,
      snapMm: 100,
    })).toMatchObject({ widthMm: 100, depthMm: 100 })
  })
})
