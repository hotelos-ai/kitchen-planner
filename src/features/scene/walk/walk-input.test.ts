import { describe, expect, it } from 'vitest'
import { walkActionForKeyboardEvent } from './walk-input'

describe('walk input', () => {
  it.each([
    ['w', 'forward'], ['ArrowUp', 'forward'], ['s', 'backward'], ['ArrowDown', 'backward'],
    ['a', 'left'], ['ArrowLeft', 'left'], ['d', 'right'], ['ArrowRight', 'right'],
    [' ', 'jump'], ['Shift', 'boost'], ['Escape', 'release'],
  ])('maps %s to %s', (key, control) => {
    expect(walkActionForKeyboardEvent({ key, repeat: false, target: document.body } as unknown as KeyboardEvent, true)?.control).toBe(control)
  })

  it('ignores controls while typing', () => {
    const input = document.createElement('input')
    expect(walkActionForKeyboardEvent({ key: 'w', target: input } as unknown as KeyboardEvent, true)).toBeNull()
  })
})
