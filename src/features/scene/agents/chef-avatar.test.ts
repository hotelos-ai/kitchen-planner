import { describe, expect, it } from 'vitest'
import { chefVisualDescriptor } from './ChefAvatar'

describe('ChefAvatar', () => {
  it('describes the approved chef silhouette and player styling', () => {
    expect(chefVisualDescriptor('head-chef', false).parts).toEqual(expect.arrayContaining([
      'toque-band', 'toque-crown', 'eyes', 'eyebrows', 'smile', 'cheeks', 'ears',
      'double-breasted-jacket', 'apron', 'neckerchief', 'trousers', 'non-slip-shoes',
    ]))
    expect(chefVisualDescriptor('head-chef', true).expression).toBe('happy')
    expect(chefVisualDescriptor('head-chef', true).accent).toBe('#b95f47')
  })
})
