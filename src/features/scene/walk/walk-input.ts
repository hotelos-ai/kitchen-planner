export type WalkControl = 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'boost' | 'release'
export type WalkInputState = Record<Exclude<WalkControl, 'release'>, boolean>
export type WalkInputAction = { control: WalkControl; pressed: boolean }

export const EMPTY_WALK_INPUT: WalkInputState = { forward: false, backward: false, left: false, right: false, jump: false, boost: false }

const KEY_CONTROLS: Record<string, WalkControl> = {
  w: 'forward', W: 'forward', ArrowUp: 'forward',
  s: 'backward', S: 'backward', ArrowDown: 'backward',
  a: 'left', A: 'left', ArrowLeft: 'left',
  d: 'right', D: 'right', ArrowRight: 'right',
  ' ': 'jump', Spacebar: 'jump', Shift: 'boost', Escape: 'release',
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
}

export function walkActionForKeyboardEvent(event: KeyboardEvent, pressed: boolean): WalkInputAction | null {
  if (isTextEntryTarget(event.target)) return null
  const control = KEY_CONTROLS[event.key]
  if (!control) return null
  return { control, pressed: control === 'release' ? true : pressed }
}

export function walkInputReducer(state: WalkInputState, action: WalkInputAction | { control: 'clear' }): WalkInputState {
  if (action.control === 'clear' || action.control === 'release') return { ...EMPTY_WALK_INPUT }
  return { ...state, [action.control]: action.pressed }
}
