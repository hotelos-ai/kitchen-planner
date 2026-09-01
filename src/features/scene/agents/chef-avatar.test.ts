import { describe, expect, it } from 'vitest'
import { chefVisualDescriptor } from './ChefAvatar'

describe('ChefAvatar', () => {
  it('describes the approved chef silhouette and player styling', () => {
    expect(chefVisualDescriptor('head-chef', false).parts).toEqual(expect.arrayContaining([
      'toque', 'double-breasted-jacket', 'neckerchief', 'trousers', 'kitchen-shoes',
    ]))
    expect(chefVisualDescriptor('head-chef', true).accent).toBe('#b95f47')
  })
})
