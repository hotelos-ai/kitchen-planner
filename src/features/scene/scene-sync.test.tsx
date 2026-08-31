import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EquipmentItem } from '../../domain/project'
import { createSeedProject } from '../../domain/seed-project'
import { projectStore } from '../../state/project-store'
import { SceneWorkspace } from './SceneWorkspace'
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
})
