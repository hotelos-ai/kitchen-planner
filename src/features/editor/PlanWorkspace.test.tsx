import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { PlanWorkspace } from './PlanWorkspace'

describe('PlanWorkspace', () => {
  it('offers a non-blocking Undo action after closing a layout tab', async () => {
    const store = createProjectStore(createSeedProject())
    store.getState().createVariant('Closing layout')
    const user = userEvent.setup()
    render(<PlanWorkspace store={store} showCanvas={false} includeToolbar />)

    await user.click(screen.getByRole('button', { name: 'Close Closing layout' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Closing layout closed/i)
    expect(store.getState().project.variants).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Undo close Closing layout' }))
    expect(store.getState().project.variants).toHaveLength(2)
    expect(screen.getByRole('tab', { name: /Closing layout/i })).toBeVisible()
  })
})
