import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PointMm } from '../../domain/project'

export type WorkspaceShortcutOptions = {
  enabled?: boolean
  selectedIds: readonly string[]
  getSnapMm(): number
  undo(): void
  redo(): void
  duplicate(ids: string[]): void
  remove(ids: string[]): void
  nudge(ids: string[], delta: PointMm): void
  rotate(ids: string[], deltaDeg: number): void
  clearSelection(): void
  onEscape?: () => boolean | void
}

const INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'option',
  'button',
  'a[href]',
  'area[href]',
  'summary',
  'details',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const TRANSIENT_SELECTOR = [
  '[role="menu"]',
  '.quick-configuration-popover',
  '.layout-wizard',
  '.essentials-dialog',
  '.workspace-toast',
].join(',')

export function isWorkspaceShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

export function useWorkspaceShortcuts(options: WorkspaceShortcutOptions): void {
  const optionsRef = useRef(options)

  useLayoutEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = optionsRef.current
      if (current.enabled === false) return

      const key = event.key.toLowerCase()
      const command = event.metaKey || event.ctrlKey
      const selectedIds = [...current.selectedIds]
      const selectionDelete = !command && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length > 0
      const deleteEnabledControl = event.target instanceof Element
        && event.target.closest('[data-workspace-delete-selection="true"]') !== null
      if (isWorkspaceShortcutTarget(event.target) && !(selectionDelete && deleteEnabledControl)) return

      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) current.redo()
        else current.undo()
        return
      }

      if (command && key === 'y') {
        event.preventDefault()
        current.redo()
        return
      }

      if (command && key === 'd' && selectedIds.length) {
        event.preventDefault()
        current.duplicate(selectedIds)
        return
      }

      if (selectionDelete) {
        event.preventDefault()
        current.remove(selectedIds)
        return
      }

      if (!command && !event.altKey && event.key === 'Escape') {
        if (current.onEscape?.() === true) {
          event.preventDefault()
          return
        }
        if (document.querySelector(TRANSIENT_SELECTOR)) return
        event.preventDefault()
        current.clearSelection()
        return
      }

      if (!command && !event.altKey && selectedIds.length && (event.key === '[' || event.key === ']')) {
        event.preventDefault()
        current.rotate(selectedIds, event.key === '[' ? -90 : 90)
        return
      }

      if (command || event.altKey || !selectedIds.length) return
      const configuredSnap = current.getSnapMm()
      const snapMm = Number.isFinite(configuredSnap) && configuredSnap > 0 ? configuredSnap : 1
      const amount = event.shiftKey ? snapMm * 5 : snapMm
      const deltas: Partial<Record<string, PointMm>> = {
        ArrowLeft: { x: -amount, y: 0 },
        ArrowRight: { x: amount, y: 0 },
        ArrowUp: { x: 0, y: -amount },
        ArrowDown: { x: 0, y: amount },
      }
      const delta = deltas[event.key]
      if (!delta) return
      event.preventDefault()
      current.nudge(selectedIds, delta)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
