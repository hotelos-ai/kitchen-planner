import { describe, expect, it } from 'vitest'
import { EMPTY_WALK_INPUT, walkActionForKeyboardEvent, walkActionForPrimaryPointerEvent, walkInputReducer } from './walk-input'

describe('walk input', () => {
  it.each([
    ['w', 'forward'], ['ArrowUp', 'forward'], ['s', 'backward'], ['ArrowDown', 'backward'],
    ['a', 'left'], ['ArrowLeft', 'turnLeft'], ['d', 'right'], ['ArrowRight', 'turnRight'],
    [' ', 'jump'], ['Shift', 'boost'], ['Escape', 'release'],
  ])('maps %s to %s', (key, control) => {
    expect(walkActionForKeyboardEvent({ key, repeat: false, target: document.body } as unknown as KeyboardEvent, true)?.control).toBe(control)
  })

  it('ignores controls while typing', () => {
    const input = document.createElement('input')
    expect(walkActionForKeyboardEvent({ key: 'w', target: input } as unknown as KeyboardEvent, true)).toBeNull()
  })

  it('maps a non-repeating F keydown to one deliberate swing', () => {
    const event = (repeat: boolean) => ({ key: 'f', repeat, target: document.body } as unknown as KeyboardEvent)
    expect(walkActionForKeyboardEvent(event(false), true)).toEqual({ control: 'swing', pressed: true })
    expect(walkActionForKeyboardEvent(event(false), false)).toBeNull()
    expect(walkActionForKeyboardEvent(event(true), true)).toBeNull()
    expect(walkInputReducer(EMPTY_WALK_INPUT, { control: 'swing', pressed: true })).toBe(EMPTY_WALK_INPUT)
  })

  it('suppresses the pointer-lock acquisition click and accepts later primary clicks', () => {
    expect(walkActionForPrimaryPointerEvent({ button: 0 } as MouseEvent, false)).toBeNull()
    expect(walkActionForPrimaryPointerEvent({ button: 0 } as MouseEvent, true)).toEqual({ control: 'swing', pressed: true })
    expect(walkActionForPrimaryPointerEvent({ button: 2 } as MouseEvent, true)).toBeNull()
  })
})
