import { describe, expect, it } from 'vitest'
import { layoutCommandSchema } from './layout-command'

describe('layout command schema', () => {
  it('accepts exact serializable commands', () => {
    expect(layoutCommandSchema.parse({ type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 } })).toEqual({
      type: 'move-items', ids: ['tandoor'], anchor: { x: 2300, y: 900 },
    })
  })

  it('rejects arbitrary property paths', () => {
    expect(() => layoutCommandSchema.parse({ type: 'set-property', path: '__proto__.admin', value: true })).toThrow()
  })
})
