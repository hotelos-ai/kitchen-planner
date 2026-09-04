import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentItem } from '../../domain/project'
import { createCatalogEquipmentItem } from '../../domain/catalog/kitchen-catalog'
import { physicalConfigurationDetails } from '../../domain/equipment-configurations'
import { createSeedProject } from '../../domain/seed-project'
import { appStateStore } from '../../state/app-state-store'
import { projectStore } from '../../state/project-store'
import { SceneWorkspace, type SceneRendererProps } from './SceneWorkspace'
import { buildWallSegments } from './ArchitectureMesh'

describe('3D scene synchronization', () => {
  beforeEach(() => {
    projectStore.getState().replaceProject(createSeedProject())
    appStateStore.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

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

  it('keeps the canvas mounted through native context restoration and repeated loss', async () => {
    const user = userEvent.setup()
    let mounts = 0
    const FlakyRenderer = (props: SceneRendererProps) => {
      useEffect(() => { mounts += 1 }, [])
      return <div><button type="button" onClick={props.onContextLost}>Lose WebGL context</button><button type="button" onClick={props.onContextRestored}>Restore WebGL context</button></div>
    }

    render(<SceneWorkspace renderer={FlakyRenderer} />)
    await user.click(screen.getByRole('button', { name: 'Lose WebGL context' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/3D rendering paused/i)
    expect(screen.getByRole('button', { name: 'Restore WebGL context' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore WebGL context' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lose WebGL context' }))
    await user.click(screen.getByRole('button', { name: /Restart 3D renderer/i }))
    expect(mounts).toBe(2)
  })

  it('reports unsupported WebGL without mounting a renderer', () => {
    const Renderer = vi.fn(() => <div>Should not mount</div>)
    render(<SceneWorkspace renderer={Renderer} webglSupported={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/WebGL is not available/i)
    expect(Renderer).not.toHaveBeenCalled()
  })

  it('retries an unexpected scene exception without changing the plan', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const projectBefore = projectStore.getState().project
    const Renderer = ({ rendererGeneration }: SceneRendererProps) => {
      if (rendererGeneration === 0) throw new Error('transient scene failure')
      return <div data-testid="recovered-renderer">Recovered kitchen</div>
    }

    render(<SceneWorkspace renderer={Renderer} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/transient scene failure/i)
    await userEvent.click(screen.getByRole('button', { name: /Retry 3D view/i }))

    expect(screen.getByTestId('recovered-renderer')).toBeInTheDocument()
    expect(projectStore.getState().project).toBe(projectBefore)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '1')
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

  it('synchronizes visible scene controls with shared app state', () => {
    const Renderer = ({ showClearances, wallsTransparent, showLabels, walkMode, walkView }: SceneRendererProps) => (
      <output data-testid="shared-scene-state">{[showClearances, wallsTransparent, showLabels, walkMode, walkView].join(':')}</output>
    )
    render(<SceneWorkspace renderer={Renderer} />)

    act(() => {
      const state = appStateStore.getState()
      state.setShowClearances(true)
      state.setWallsTransparent(true)
      state.setShowLabels(false)
      state.setWalkView('third-person')
      state.setWalkMode(true)
    })

    expect(screen.getByTestId('shared-scene-state')).toHaveTextContent('true:true:false:true:third-person')
    expect(screen.getByRole('button', { name: 'Clearances' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Transparent walls' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Labels' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Third-person view' })).toHaveAttribute('aria-pressed', 'true')
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

    expect(screen.getByTestId('live-fridge-configuration')).toHaveTextContent('Chest freezer:1400:chest-freezer')
    expect(mounts).toBe(1)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')
  })

  it('publishes shelf tier configuration changes to the live 3D renderer', () => {
    const project = createSeedProject()
    project.variants[0].equipment = [createCatalogEquipmentItem({
      catalogId: 'storage-wall-shelf',
      componentId: 'scene-shelf',
      configurationId: 'wall-shelf-one-tier',
      position: { xMm: 400, yMm: 0 },
    })]
    projectStore.getState().replaceProject(project)
    let mounts = 0
    const ShelfRenderer = ({ items }: SceneRendererProps) => {
      useEffect(() => { mounts += 1 }, [])
      return <output data-testid="live-shelf-tiers">{physicalConfigurationDetails(items[0]).tierCount}:{items[0].shelfElevationsMm?.join(',') ?? 'default'}</output>
    }

    render(<SceneWorkspace renderer={ShelfRenderer} />)
    expect(screen.getByTestId('live-shelf-tiers')).toHaveTextContent('1:default')
    act(() => projectStore.getState().applyEquipmentConfiguration('scene-shelf', 'wall-shelf-three-tier'))

    expect(screen.getByTestId('live-shelf-tiers')).toHaveTextContent('3:default')
    act(() => projectStore.getState().updateItem('scene-shelf', { shelfElevationsMm: [300, 650, 1_050] }))
    expect(screen.getByTestId('live-shelf-tiers')).toHaveTextContent('3:300,650,1050')
    expect(mounts).toBe(1)
  })

  it('publishes live x, y, and elevation without remounting the renderer', () => {
    let mounts = 0
    const PoseRenderer = ({ onPlayerPositionChange }: SceneRendererProps) => {
      useEffect(() => {
        mounts += 1
        onPlayerPositionChange({ x: 2100, y: 3200, elevationMm: 850, grounded: false, verticalVelocityMps: 2.4 } as Parameters<typeof onPlayerPositionChange>[0])
      }, [onPlayerPositionChange])
      return null
    }

    render(<SceneWorkspace renderer={PoseRenderer} />)

    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-x-mm', '2100')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-y-mm', '3200')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-elevation-mm', '850')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-grounded', 'false')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-vertical-velocity', '2.4')
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

  it('switches live walk cameras without remounting the renderer or resetting player motion', async () => {
    const user = userEvent.setup()
    let mounts = 0
    const SwitchableRenderer = ({ walkMode, walkView, onPlayerPositionChange }: SceneRendererProps) => {
      useEffect(() => {
        mounts += 1
        onPlayerPositionChange({ x: 2100, y: 3200, elevationMm: 650, grounded: false, verticalVelocityMps: 1.8 })
      }, [onPlayerPositionChange])
      return <output data-testid="live-walk-view">{walkMode ? walkView : 'overview'}</output>
    }
    render(<SceneWorkspace renderer={SwitchableRenderer} />)
    const canvas = screen.getByTestId('kitchen-scene')

    await user.click(screen.getByRole('button', { name: 'Walk kitchen' }))
    expect(screen.getByTestId('live-walk-view')).toHaveTextContent('first-person')
    await user.click(screen.getByRole('button', { name: 'Third-person view' }))

    expect(screen.getByTestId('kitchen-scene')).toBe(canvas)
    expect(screen.getByTestId('live-walk-view')).toHaveTextContent('third-person')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-elevation-mm', '650')
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-player-vertical-velocity', '1.8')
    expect(mounts).toBe(1)
  })

  it('keeps the overview renderer mounted when Walk has no valid spawn', async () => {
    const user = userEvent.setup()
    let mounts = 0
    const UnavailableWalkRenderer = ({ walkMode, onWalkAvailabilityChange }: SceneRendererProps) => {
      useEffect(() => {
        mounts += 1
      }, [])
      useEffect(() => {
        if (walkMode) onWalkAvailabilityChange({
          status: 'unavailable',
          code: 'no-valid-spawn',
          message: 'No safe walkthrough start is available. Add a staff entry or clear space inside the room.',
        })
      }, [onWalkAvailabilityChange, walkMode])
      return <output data-testid="persistent-overview">Kitchen overview</output>
    }

    render(<SceneWorkspace renderer={UnavailableWalkRenderer} />)
    await user.click(screen.getByRole('button', { name: 'Walk kitchen' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/No safe walkthrough start/i)
    expect(screen.getByTestId('persistent-overview')).toBeInTheDocument()
    expect(mounts).toBe(1)
    expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', '0')

    await user.click(screen.getByRole('button', { name: 'Return to 3D overview' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('persistent-overview')).toBeInTheDocument()
    expect(mounts).toBe(1)
  })
})
