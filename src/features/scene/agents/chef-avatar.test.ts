import { describe, expect, it } from 'vitest'
import { chefVisualDescriptor } from './ChefAvatar'

describe('ChefAvatar', () => {
  it('describes the approved chef silhouette and player styling', () => {
    const descriptor = chefVisualDescriptor('head-chef', false)
    expect(descriptor.parts).toEqual(expect.arrayContaining([
      'toque-band', 'toque-crown', 'eyes', 'eyebrows', 'smile', 'cheeks', 'ears',
      'nose', 'pupils', 'double-breasted-jacket', 'collar', 'apron', 'neckerchief',
      'cuffed-sleeves', 'trousers', 'non-slip-shoes', 'spatula', 'whisk',
    ]))
    expect(descriptor.proportions).toEqual({ heightM: 1.82, headToHeightRatio: .1, shoulderToHeightRatio: .36 })
    expect(descriptor.visualRegressionViews).toEqual(['front', 'three-quarter'])
    expect(descriptor.uniform).toBe('modern-double-breasted')
    expect(chefVisualDescriptor('head-chef', true).expression).toBe('happy')
    expect(chefVisualDescriptor('head-chef', true).accent).toBe('#b95f47')
  })
})
