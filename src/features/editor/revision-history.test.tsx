import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { RevisionHistory } from './RevisionHistory'

describe('revision history', () => {
  it('creates a named checkpoint and restores it as a new revision', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(createSeedProject())
    render(<RevisionHistory store={store} />)

    await user.click(screen.getByRole('button', { name: 'Create named checkpoint' }))
    expect(store.getState().project.variants[0].checkpoints).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Restore as new revision' })).toBeInTheDocument()

    store.getState().nudgeItems(['tandoor'], { x: 200, y: 0 })
    const moved = store.getState().project.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm
    await user.click(screen.getByRole('button', { name: 'Restore as new revision' }))
    expect(store.getState().project.variants[0].equipment.find((item) => item.id === 'tandoor')!.xMm).not.toBe(moved)
  })
})
