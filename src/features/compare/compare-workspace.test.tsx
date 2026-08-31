import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { projectStore } from '../../state/project-store'
import { CompareWorkspace } from './CompareWorkspace'

describe('layout comparison workspace', () => {
  beforeEach(() => {
    projectStore.getState().replaceProject(createSeedProject())
    const variantId = projectStore.getState().createVariant('Candidate B')
    projectStore.getState().activateVariant(variantId)
  })

  it('compares two variants and keeps assumptions visible', async () => {
    render(<CompareWorkspace />)
    await userEvent.selectOptions(screen.getByLabelText(/Baseline layout/i), 'baseline-trace')
    expect(screen.getByLabelText(/Candidate layout/i)).toHaveDisplayValue('Candidate B')
    expect(screen.getByText(/50 covers over 60 minutes/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Priority findings/i })).toBeInTheDocument()
  })
})
