import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
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

  it('updates an edited mesh without remounting the renderer', () => {
    let mounts = 0
    const StableRenderer = ({ items }: SceneRendererProps) => {
      useEffect(() => { mounts += 1 }, [])
      return <output data-testid="live-tandoor-x">{items.find((item) => item.id === 'tandoor')?.xMm}</output>
    }
    render(<SceneWorkspace renderer={StableRenderer} />)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')
    act(() => projectStore.getState().moveItems(['tandoor'], { x: 2300, y: 900 }))
    expect(screen.getByTestId('live-tandoor-x')).toHaveTextContent('2300')
    expect(mounts).toBe(1)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')
  })

  it('updates an equipment configuration without remounting the renderer', () => {
    let mounts = 0
    const StableRenderer = ({ items }: SceneRendererProps) => {
      useEffect(() => { mounts += 1 }, [])
      const fridge = items.find((item) => item.id === 'two-door-fridge')
      return <output data-testid="live-fridge-configuration">{fridge?.label}:{fridge?.widthMm}:{fridge?.visualPreset}</output>
    }

    render(<SceneWorkspace renderer={StableRenderer} />)
    act(() => projectStore.getState().applyEquipmentConfiguration('two-door-fridge', 'cold-chest-freezer'))

    expect(screen.getByTestId('live-fridge-configuration')).toHaveTextContent('Chest freezer:1200:chest-freezer')
    expect(mounts).toBe(1)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')
  })

  it('publishes live x, y, and elevation without remounting the renderer', () => {
    let mounts = 0
    const PoseRenderer = ({ onPlayerPositionChange }: SceneRendererProps) => {
      useEffect(() => {
        mounts += 1
        onPlayerPositionChange({ x: 2100, y: 3200, elevationMm: 850 } as Parameters<typeof onPlayerPositionChange>[0])
      }, [onPlayerPositionChange])
      return null
    }

    render(<SceneWorkspace renderer={PoseRenderer} />)

    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-x-mm', '2100')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-y-mm', '3200')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-elevation-mm', '850')
    expect(mounts).toBe(1)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')
  })

  it('enters and exits Walk Kitchen from the regular 3D workspace without remounting', async () => {
    const user = userEvent.setup()
    const FakeWalkRenderer = ({ walkMode }: SceneRendererProps) => <output data-testid="walk-state">{String(walkMode)}</output>
    render(<SceneWorkspace renderer={FakeWalkRenderer} />)
    const generation = screen.getByTestId('kitchen-scene').getAttribute('data-renderer-generation')
    await user.click(screen.getByRole('button', { name: 'Walk kitchen' }))
    expect(screen.getByTestId('walk-state')).toHaveTextContent('true')
    expect(screen.getByLabelText('Walk kitchen controls')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Exit walk mode' }))
    expect(screen.getByTestId('walk-state')).toHaveTextContent('false')
    expect(screen.getByRole('button', { name: 'Perspective' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', generation)
  })
})
