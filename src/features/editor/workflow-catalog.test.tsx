import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { WorkflowCatalog } from './WorkflowCatalog'

describe('space workflow catalog', () => {
  it('starts placement for a distinct regular window', async () => {
    const user = userEvent.setup()
    const onBeginPlacement = vi.fn()
    render(<WorkflowCatalog store={createProjectStore(createSeedProject())} stage="space" onBeginPlacement={onBeginPlacement} />)

    await user.click(screen.getByRole('button', { name: 'Add Regular window' }))
    expect(onBeginPlacement).toHaveBeenCalledWith(expect.objectContaining({
      catalogId: 'architecture-window',
      kind: 'window',
      widthMm: 1200,
    }))
  })
})
