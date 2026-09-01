import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EquipmentItem } from '../../domain/project'
import { createSeedProject } from '../../domain/seed-project'
import { projectStore } from '../../state/project-store'
import { SceneWorkspace, type SceneRendererProps } from './SceneWorkspace'
import { buildWallSegments } from './ArchitectureMesh'

describe('3D scene synchronization', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))

  it('uses the active item geometry and synchronizes selection', async () => {
    const FakeSceneRenderer = ({ items, onSelect }: { items: EquipmentItem[]; onSelect(id: string): void }) => (
      <div>{items.map((item) => (
        <button
          key={item.id}
          data-testid={`mesh-${item.id}`}
          data-size={`${item.widthMm / 1000},${item.heightMm / 1000},${item.depthMm / 1000}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}</div>
    )

    render(<SceneWorkspace renderer={FakeSceneRenderer} />)
    expect(screen.getByTestId('mesh-tandoor')).toHaveAttribute('data-size', '0.7,0.9,0.7')
    await userEvent.click(screen.getByTestId('mesh-tandoor'))
    expect(projectStore.getState().selectedIds).toEqual(['tandoor'])
  })

  it('keeps sealed D6 walled while leaving the D2 entry open', () => {
    const architecture = createSeedProject().architecture
    const walls = buildWallSegments(architecture)
    const crosses = (axis: 'x' | 'y', fixed: number, position: number) => walls.some(({ start, end }) => {
      const otherAxis = axis === 'x' ? 'y' : 'x'
      return start[axis] === fixed && end[axis] === fixed && Math.min(start[otherAxis], end[otherAxis]) <= position && Math.max(start[otherAxis], end[otherAxis]) >= position
    })

    expect(crosses('y', 0, 2900)).toBe(true)
    expect(crosses('x', 0, 6000)).toBe(false)
  })

  it('keeps every camera and clearance control wired around the renderer', async () => {
    const user = userEvent.setup()
    const FakeRenderer = (props: SceneRendererProps & { cameraMode?: string; fitSignal?: number; showClearances?: boolean }) => (
      <output data-testid="renderer-state">{props.cameraMode}:{props.fitSignal}:{String(props.showClearances)}</output>
    )

    render(<SceneWorkspace renderer={FakeRenderer} />)
    expect(screen.getByTestId('renderer-state')).toHaveTextContent('perspective:0:false')
    await user.click(screen.getByRole('button', { name: 'Top' }))
    expect(screen.getByTestId('renderer-state')).toHaveTextContent('top:1:false')
    await user.click(screen.getByRole('button', { name: 'Fit room' }))
    expect(screen.getByTestId('renderer-state')).toHaveTextContent('top:2:false')
    await user.click(screen.getByRole('button', { name: 'Clearances' }))
    expect(screen.getByTestId('renderer-state')).toHaveTextContent('top:2:true')
    await user.click(screen.getByRole('button', { name: 'Perspective' }))
    expect(screen.getByTestId('renderer-state')).toHaveTextContent('perspective:3:true')
  })

  it('replaces detached labels with a recoverable context-loss message', async () => {
    const user = userEvent.setup()
    const FlakyRenderer = (props: SceneRendererProps & { onContextLost?: () => void }) => <button type="button" onClick={props.onContextLost}>Lose WebGL context</button>

    render(<SceneWorkspace renderer={FlakyRenderer} />)
    await user.click(screen.getByRole('button', { name: 'Lose WebGL context' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/3D rendering paused/i)
    await user.click(screen.getByRole('button', { name: /Restart 3D renderer/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('toggles transparent wall surfaces without hiding their borders', async () => {
    const user = userEvent.setup()
    const FakeRenderer = (props: SceneRendererProps) => <output data-testid="wall-state">{String(props.wallsTransparent)}</output>
    render(<SceneWorkspace renderer={FakeRenderer} />)
    expect(screen.getByTestId('wall-state')).toHaveTextContent('false')
    await user.click(screen.getByRole('button', { name: 'Transparent walls' }))
    expect(screen.getByTestId('wall-state')).toHaveTextContent('true')
    expect(screen.getByRole('button', { name: 'Transparent walls' })).toHaveAttribute('aria-pressed', 'true')
  })
})
