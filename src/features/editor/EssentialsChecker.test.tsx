import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { EssentialsChecker } from './EssentialsChecker'

const incompleteProject = () => {
  const project = createSeedProject()
  const variant = project.variants[0]
  variant.equipment = variant.equipment.filter((item) =>
    !item.capabilities.includes('hand-wash') && !item.capabilities.includes('dirty-landing'))
  variant.architecture.openings = variant.architecture.openings.filter((opening) => opening.flow !== 'entry')
  project.architecture = structuredClone(variant.architecture)
  return project
}

describe('essentials checker', () => {
  it('separates blockers, warnings, and professional review without certification claims', () => {
    render(<EssentialsChecker store={createProjectStore(incompleteProject())} />)

    expect(screen.getByRole('heading', { name: 'Blockers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Professional review' })).toBeInTheDocument()
    expect(screen.getByText(/dirty landing station/i)).toBeInTheDocument()
    expect(screen.getAllByText(/qualified professional/i)).toHaveLength(4)
    expect(screen.getByText(/operational guidance, not regulatory certification/i)).toBeInTheDocument()
  })

  it('routes architecture needs to room editing and adds one remedy through the public operation batch', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(incompleteProject())
    const apply = vi.spyOn(store.getState(), 'applyWorkspaceOperations')
    const onEditRoom = vi.fn()
    render(<EssentialsChecker store={store} onEditRoom={onEditRoom} />)

    await user.click(screen.getByRole('button', { name: /edit room.*dedicated staff entry/i }))
    expect(onEditRoom).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /add handwash sink/i }))
    expect(apply).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'add_component', variantId: store.getState().project.activeVariantId, catalogId: 'sanitation-hand-sink' }),
    ], 'Add recommended essential')
  })

  it('adds every placeable missing essential atomically as one history entry', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(incompleteProject())
    const apply = vi.spyOn(store.getState(), 'applyWorkspaceOperations')
    render(<EssentialsChecker store={store} />)

    await user.click(screen.getByRole('button', { name: 'Add all recommended essentials' }))

    expect(apply).toHaveBeenCalledTimes(1)
    const [operations, intent] = apply.mock.calls[0]
    expect(intent).toBe('Add all recommended essentials')
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'add_component', catalogId: 'sanitation-hand-sink' }),
      expect.objectContaining({ type: 'add_component', catalogId: 'wash-dirty-landing' }),
    ]))
    expect(store.getState().past).toHaveLength(1)
  })
})
