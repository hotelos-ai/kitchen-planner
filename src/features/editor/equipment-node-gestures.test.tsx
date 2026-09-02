import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'

vi.mock('react-konva', async () => {
  const React = await import('react')
  const Group = React.forwardRef((props: Record<string, unknown>, ref) => {
    React.useImperativeHandle(ref, () => ({
      x: () => props.x ?? 0,
      y: () => props.y ?? 0,
      scaleX: () => 1,
      scaleY: () => 1,
      rotation: () => props.rotation ?? 0,
      scale: vi.fn(),
    }))
    return <div
      data-testid={props.draggable === undefined ? 'nested-group' : 'equipment-node'}
      onClick={(event) => (props.onClick as ((event: unknown) => void) | undefined)?.({ evt: event.nativeEvent, cancelBubble: false })}
      onDoubleClick={(event) => (props.onDblClick as ((event: unknown) => void) | undefined)?.({ evt: event.nativeEvent, cancelBubble: false })}
      onContextMenu={(event) => (props.onContextMenu as ((event: unknown) => void) | undefined)?.({ evt: event.nativeEvent, cancelBubble: false })}
    >{props.children as React.ReactNode}</div>
  })
  const Transformer = React.forwardRef((props: Record<string, unknown>, ref) => {
    React.useImperativeHandle(ref, () => ({ nodes: vi.fn(), getLayer: () => ({ batchDraw: vi.fn() }) }))
    return <div data-testid="transformer" data-rotate-enabled={String(props.rotateEnabled)} data-rotation-snaps={props.rotationSnaps ? 'present' : 'absent'} />
  })
  const Primitive = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Group, Transformer, Layer: Primitive, Rect: Primitive, Text: Primitive }
})

import { EquipmentNode } from './EquipmentNode'

const item = createSeedProject().variants[0].equipment.find((candidate) => candidate.id === 'tandoor')!
const requiredProps = {
  item,
  displayUnit: 'mm' as const,
  pixelsPerMm: .1,
  originX: 0,
  originY: 0,
  snapMm: 100,
  onMove: vi.fn(),
  onTransform: vi.fn(),
}

describe('EquipmentNode gestures', () => {
  it('keeps selection, quick configuration, and context requests distinct', () => {
    const onSelect = vi.fn()
    const onQuickConfigure = vi.fn()
    const onOpenContextMenu = vi.fn()
    render(<EquipmentNode {...requiredProps} selected={false} onSelect={onSelect} onQuickConfigure={onQuickConfigure} onOpenContextMenu={onOpenContextMenu} />)
    const node = screen.getByTestId('equipment-node')

    fireEvent.click(node, { shiftKey: true })
    expect(onSelect).toHaveBeenCalledWith('tandoor', true)
    expect(onQuickConfigure).not.toHaveBeenCalled()
    expect(onOpenContextMenu).not.toHaveBeenCalled()

    onSelect.mockClear()
    fireEvent.doubleClick(node, { clientX: 120, clientY: 160 })
    expect(onQuickConfigure).toHaveBeenCalledWith('tandoor', { x: 120, y: 160 })
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.contextMenu(node, { clientX: 220, clientY: 260 })
    expect(onOpenContextMenu).toHaveBeenCalledWith('tandoor', { x: 220, y: 260 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps resize handles but disables the Konva free-rotation handle', () => {
    render(<EquipmentNode {...requiredProps} item={{ ...item, dimensionsLocked: false }} selected onSelect={vi.fn()} onQuickConfigure={vi.fn()} onOpenContextMenu={vi.fn()} />)
    expect(screen.getByTestId('transformer')).toHaveAttribute('data-rotate-enabled', 'false')
    expect(screen.getByTestId('transformer')).toHaveAttribute('data-rotation-snaps', 'absent')
  })
})
