import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { LayoutWizard } from './LayoutWizard'

const next = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Next' }))

describe('layout wizard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['duplicate', 'Duplicate a layout'],
    ['blank-existing', 'Blank equipment in an existing room'],
    ['rectangle', 'New rectangular room'],
    ['polygon', 'Advanced polygon room'],
  ] as const)('offers the %s starting mode', (_mode, label) => {
    render(<LayoutWizard store={createProjectStore(createSeedProject())} onClose={() => undefined} />)
    expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
  })

  it('captures room geometry and the complete operational profile for review', async () => {
    const user = userEvent.setup()
    render(<LayoutWizard store={createProjectStore(createSeedProject())} onClose={() => undefined} />)

    await user.click(screen.getByRole('radio', { name: 'Advanced polygon room' }))
    await user.clear(screen.getByLabelText('Layout name'))
    await user.type(screen.getByLabelText('Layout name'), 'Jagged dinner service')
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Add service window' }))
    await user.click(screen.getByRole('button', { name: 'Add pillar' }))
    await user.click(screen.getByRole('button', { name: 'Add storage zone' }))
    await next(user)

    await user.clear(screen.getByLabelText('Covers'))
    await user.type(screen.getByLabelText('Covers'), '180')
    await user.clear(screen.getByLabelText('Peak duration (minutes)'))
    await user.type(screen.getByLabelText('Peak duration (minutes)'), '90')
    await user.selectOptions(screen.getByLabelText('Arrival pattern'), 'two-waves')
    await user.selectOptions(screen.getByLabelText('Service style'), 'table-service')
    await user.clear(screen.getByLabelText('Target capacity per hour'))
    await user.type(screen.getByLabelText('Target capacity per hour'), '120')
    await user.type(screen.getByLabelText('Menu and task assumptions'), 'grill, pastry')
    await user.clear(screen.getByLabelText('Head chef count'))
    await user.type(screen.getByLabelText('Head chef count'), '2')
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Start without recommended equipment' }))
    await next(user)

    expect(screen.getByRole('heading', { name: 'Review new layout' })).toBeInTheDocument()
    expect(screen.getByText('Jagged dinner service')).toBeInTheDocument()
    expect(screen.getByText(/180 covers.*two waves/i)).toBeInTheDocument()
    expect(screen.getByText(/1 service window.*1 pillar.*1 storage zone/i)).toBeInTheDocument()
    expect(screen.getByText(/does not certify regulatory compliance/i)).toBeInTheDocument()
  })

  it('cancels without mutating and creates through exactly one public workspace batch', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'wizard-variant' })
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    const original = structuredClone(store.getState().project)
    const applyWorkspaceOperations = vi.spyOn(store.getState(), 'applyWorkspaceOperations')
    const onClose = vi.fn()
    const { rerender } = render(<LayoutWizard store={store} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cancel layout wizard' }))
    expect(store.getState().project).toEqual(original)
    expect(applyWorkspaceOperations).not.toHaveBeenCalled()

    rerender(<LayoutWizard store={store} onClose={onClose} />)
    await next(user)
    await next(user)
    await next(user)
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Create layout' }))

    expect(applyWorkspaceOperations).toHaveBeenCalledTimes(1)
    expect(applyWorkspaceOperations).toHaveBeenCalledWith(expect.any(Array), 'Create layout from wizard')
    expect(store.getState().project.variants).toHaveLength(original.variants.length + 1)
    expect(store.getState().past).toHaveLength(1)
  })
})
