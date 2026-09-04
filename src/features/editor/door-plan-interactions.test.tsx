import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveVariant } from '../../state/project-store'

vi.mock('./PlanCanvas', () => ({
  PlanCanvas: ({ onSelectItem }: { onSelectItem(selection: { kind: 'opening'; id: string }): void }) => (
    <button type="button" onClick={() => onSelectItem({ kind: 'opening', id: 'd2' })}>Select staff door on plan</button>
  ),
}))

import { PlanWorkspace } from './PlanWorkspace'

describe('door interactions in the plan view', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens door settings from the fit-out plan and applies edits', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    store.getState().selectItems(['tandoor'])
    const { container } = render(<PlanWorkspace store={store} stage="equipment" showCanvas includeToolbar />)
    const inspector = container.querySelector('[data-editor-drawer="inspector"]')

    expect(inspector).toHaveAttribute('aria-hidden', 'true')
    await user.click(screen.getByRole('button', { name: 'Select staff door on plan' }))

    expect(inspector).toHaveAttribute('aria-hidden', 'false')
    expect(store.getState().selectedIds).toEqual([])
    expect(screen.getByRole('complementary', { name: 'Selected opening' })).toBeInTheDocument()
    expect(screen.getByLabelText('Swing depth (mm)')).toHaveValue(900)
    expect(screen.queryByRole('region', { name: 'Layout checks' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Display units')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Door hinge side'), 'end')
    await user.selectOptions(screen.getByLabelText('Door opening direction'), 'outward')
    expect(getActiveVariant(store.getState()).architecture.openings.find((opening) => opening.id === 'd2')).toMatchObject({
      swingHinge: 'end',
      swingDirection: 'outward',
    })

    const label = screen.getByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'Moved staff door')
    await user.tab()

    expect(getActiveVariant(store.getState()).architecture.openings.find((opening) => opening.id === 'd2')?.label).toBe('Moved staff door')
  })
})
