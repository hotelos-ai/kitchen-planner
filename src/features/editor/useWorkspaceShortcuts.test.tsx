import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWorkspaceShortcuts, type WorkspaceShortcutOptions } from './useWorkspaceShortcuts'

const makeOptions = (overrides: Partial<WorkspaceShortcutOptions> = {}): WorkspaceShortcutOptions => ({
  selectedIds: ['range-1', 'prep-1'],
  getSnapMm: () => 100,
  undo: vi.fn(),
  redo: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  nudge: vi.fn(),
  rotate: vi.fn(),
  clearSelection: vi.fn(),
  ...overrides,
})

function Harness({ options }: { options: WorkspaceShortcutOptions }) {
  useWorkspaceShortcuts(options)
  return <div>
    <input aria-label="Text input" />
    <textarea aria-label="Text area" />
    <select aria-label="Select control"><option>One</option></select>
    <div role="textbox" contentEditable aria-label="Editable region" suppressContentEditableWarning>Editable</div>
    <button type="button">Native button</button>
    <a href="#target">Native link</a>
  </div>
}

describe('useWorkspaceShortcuts', () => {
  it('supports undo and both redo conventions', () => {
    const options = makeOptions()
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })

    expect(options.undo).toHaveBeenCalledOnce()
    expect(options.redo).toHaveBeenCalledTimes(2)
  })

  it('duplicates, removes, and rotates the current selection', () => {
    const options = makeOptions()
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'd', metaKey: true })
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    fireEvent.keyDown(window, { key: '[' })
    fireEvent.keyDown(window, { key: ']' })

    expect(options.duplicate).toHaveBeenCalledWith(['range-1', 'prep-1'])
    expect(options.remove).toHaveBeenNthCalledWith(1, ['range-1', 'prep-1'])
    expect(options.remove).toHaveBeenNthCalledWith(2, ['range-1', 'prep-1'])
    expect(options.rotate).toHaveBeenNthCalledWith(1, ['range-1', 'prep-1'], -90)
    expect(options.rotate).toHaveBeenNthCalledWith(2, ['range-1', 'prep-1'], 90)
  })

  it('nudges by snap and uses a larger coarse Shift step', () => {
    const options = makeOptions()
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true })

    expect(options.nudge).toHaveBeenNthCalledWith(1, ['range-1', 'prep-1'], { x: -100, y: 0 })
    expect(options.nudge).toHaveBeenNthCalledWith(2, ['range-1', 'prep-1'], { x: 0, y: 500 })
  })

  it('offers Escape to transient UI before clearing selection', () => {
    const order: string[] = []
    const onEscape = vi.fn()
      .mockImplementationOnce(() => { order.push('transient'); return true })
      .mockImplementationOnce(() => { order.push('transient'); return false })
    const options = makeOptions({
      onEscape,
      clearSelection: vi.fn(() => { order.push('selection') }),
    })
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(options.clearSelection).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(order).toEqual(['transient', 'transient', 'selection'])
  })

  it('leaves selection intact while a workspace menu or dialog handles Escape', () => {
    const options = makeOptions()
    render(<Harness options={options} />)
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.append(menu)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(options.clearSelection).not.toHaveBeenCalled()
    menu.remove()
  })

  it.each([
    ['Text input', 'textbox'],
    ['Text area', 'textbox'],
    ['Select control', 'combobox'],
    ['Editable region', 'textbox'],
    ['Native button', 'button'],
    ['Native link', 'link'],
  ])('suppresses shortcuts inside %s', (_label, role) => {
    const options = makeOptions()
    render(<Harness options={options} />)
    const controls = screen.getAllByRole(role as 'textbox' | 'combobox' | 'button' | 'link')
    const target = controls.find((control) => control.getAttribute('aria-label') === _label || control.textContent === _label)
    expect(target).toBeDefined()

    fireEvent.keyDown(target!, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(target!, { key: 'Delete' })
    fireEvent.keyDown(target!, { key: ']' })
    fireEvent.keyDown(target!, { key: 'Escape' })

    expect(options.undo).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
    expect(options.rotate).not.toHaveBeenCalled()
    expect(options.clearSelection).not.toHaveBeenCalled()
  })

  it('does not handle shortcuts while the workspace mode is disabled', () => {
    const options = makeOptions({ enabled: false })
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(options.undo).not.toHaveBeenCalled()
    expect(options.duplicate).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
    expect(options.nudge).not.toHaveBeenCalled()
    expect(options.clearSelection).not.toHaveBeenCalled()
  })

  it('allows Delete from an explicit equipment selection control', () => {
    const options = makeOptions()
    render(<Harness options={options} />)
    const control = document.createElement('button')
    control.dataset.workspaceDeleteSelection = 'true'
    document.body.append(control)

    fireEvent.keyDown(control, { key: 'Delete' })

    expect(options.remove).toHaveBeenCalledWith(['range-1', 'prep-1'])
    control.remove()
  })

  it('does not intercept selection commands when nothing is selected', () => {
    const options = makeOptions({ selectedIds: [] })
    render(<Harness options={options} />)

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(options.duplicate).not.toHaveBeenCalled()
    expect(options.nudge).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
  })
})
