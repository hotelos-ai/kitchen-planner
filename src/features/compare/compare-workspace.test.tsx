import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, projectStore } from '../../state/project-store'
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

  it('renders and simulates each variant against its own architecture', () => {
    const project = createSeedProject()
    const candidate = structuredClone(project.variants[0])
    candidate.id = 'different-room'
    candidate.name = 'Different room'
    candidate.architecture.widthMm = 8000
    candidate.architecture.depthMm = 8000
    candidate.architecture.roomPolygon = [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 8000 }, { x: 0, y: 8000 }]
    project.variants.push(candidate)
    const store = createProjectStore(project)

    render(<CompareWorkspace store={store} />)

    expect(screen.getByLabelText('Different room plan preview')).toHaveAttribute('viewBox', '-80 -80 8160 8160')
  })

  it('prepares ReportView print and HTML export from the shared report generator', async () => {
    render(<CompareWorkspace />)

    await userEvent.click(screen.getByRole('button', { name: 'Report' }))

    const generated = screen.getByTitle('Generated planning report for print').getAttribute('srcdoc') ?? ''
    expect(generated).toMatch(/^<!doctype html>/)
    expect(generated).toMatch(/<svg[\s\S]*Scenario and menu assumptions/)
    expect(generated).toMatch(/Station utilization and queues[\s\S]*Ranked findings/)
    expect(screen.getByRole('button', { name: 'Print / save PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeInTheDocument()
  })
})
