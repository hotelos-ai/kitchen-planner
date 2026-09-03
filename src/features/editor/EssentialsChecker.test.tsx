import { render, screen, within } from '@testing-library/react'
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
    expect(screen.getAllByText(/qualified professional/i)).toHaveLength(9)
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

  it('promotes the aggregate action directly below the header for one missing recommendation', () => {
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.equipment = variant.equipment.filter((item) => !item.capabilities.includes('hand-wash'))
    const { container } = render(<EssentialsChecker store={createProjectStore(project)} />)

    const checker = container.querySelector('.essentials-checker')
    const header = checker?.querySelector(':scope > header')
    const quickFixes = screen.getByRole('region', { name: 'Quick fixes' })
    expect(header?.nextElementSibling).toBe(quickFixes)
    expect(within(quickFixes).getByRole('button', { name: 'Auto-fix missing essentials' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Auto-fix missing essentials' })).toHaveLength(1)
  })

  it('adds only the canonical first alternative for a missing cooking requirement', async () => {
    const user = userEvent.setup()
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.equipment = variant.equipment.filter((item) => item.category !== 'cooking')
    const store = createProjectStore(project)
    render(<EssentialsChecker store={store} />)

    await user.click(screen.getByRole('button', { name: 'Auto-fix missing essentials' }))

    const catalogIds = store.getState().project.variants[0].equipment
      .map((item) => item.catalogId)
      .filter(Boolean)
    expect(catalogIds).toContain('hot-six-burner-range')
    expect(catalogIds).not.toContain('hot-griddle')
    expect(catalogIds).toHaveLength(1)
  })

  it('adds every placeable missing requirement atomically as one history entry', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(incompleteProject())
    const apply = vi.spyOn(store.getState(), 'applyWorkspaceOperations')
    render(<EssentialsChecker store={store} />)

    await user.click(screen.getByRole('button', { name: 'Auto-fix missing essentials' }))

    expect(apply).toHaveBeenCalledTimes(1)
    const [operations, intent] = apply.mock.calls[0]
    expect(intent).toBe('Auto-fix missing essentials')
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'add_component', catalogId: 'sanitation-hand-sink' }),
      expect.objectContaining({ type: 'add_component', catalogId: 'wash-dirty-landing' }),
    ]))
    expect(store.getState().past).toHaveLength(1)
  })

  it('offers a top room repair action for blocking architecture findings', async () => {
    const user = userEvent.setup()
    const onEditRoom = vi.fn()
    const project = createSeedProject()
    const variant = project.variants[0]
    variant.architecture.openings = variant.architecture.openings.filter((opening) => opening.flow !== 'entry')
    project.architecture = structuredClone(variant.architecture)
    render(<EssentialsChecker store={createProjectStore(project)} onEditRoom={onEditRoom} />)

    const quickFixes = screen.getByRole('region', { name: 'Quick fixes' })
    await user.click(within(quickFixes).getByRole('button', { name: 'Fix room setup' }))

    expect(onEditRoom).toHaveBeenCalledTimes(1)
  })
})
