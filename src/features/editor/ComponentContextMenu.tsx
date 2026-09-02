import { useEffect, useRef } from 'react'
import type { EquipmentItem } from '../../domain/project'

export type ComponentContextAction =
  | 'configure'
  | 'skin'
  | 'rotate-left'
  | 'rotate-right'
  | 'duplicate'
  | 'toggle-lock'
  | 'inspect-3d'
  | 'remove'

export type OverlayPosition = { x: number; y: number }

export function ComponentContextMenu({ item, locked, position, onAction, onClose }: {
  item: EquipmentItem
  locked: boolean
  position: OverlayPosition
  onAction(action: ComponentContextAction): void
  onClose(): void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const action = (value: ComponentContextAction) => () => {
    onAction(value)
    onClose()
  }

  return <div
    ref={menuRef}
    role="menu"
    aria-label={`${item.label} actions`}
    className="component-context-menu"
    style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 20 }}
    onMouseDown={(event) => event.stopPropagation()}
    onContextMenu={(event) => event.preventDefault()}
  >
    <button type="button" role="menuitem" onClick={action('configure')}>Configure</button>
    <button type="button" role="menuitem" onClick={action('skin')}>Skin</button>
    <button type="button" role="menuitem" onClick={action('rotate-left')}>Rotate Left</button>
    <button type="button" role="menuitem" onClick={action('rotate-right')}>Rotate Right</button>
    <button type="button" role="menuitem" onClick={action('duplicate')}>Duplicate</button>
    <button type="button" role="menuitem" onClick={action('toggle-lock')}>{locked ? 'Unlock' : 'Lock'}</button>
    <button type="button" role="menuitem" onClick={action('inspect-3d')}>Inspect in 3D</button>
    <button type="button" role="menuitem" disabled={!item.removable} onClick={action('remove')}>Remove</button>
  </div>
}
