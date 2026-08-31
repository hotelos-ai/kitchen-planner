import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { projectStore } from '../../state/project-store'
import { SimulationWorkspace } from './SimulationWorkspace'

describe('simulation workspace', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))

  it('runs the approved five-person 50-cover scenario and displays metrics', async () => {
    render(<SimulationWorkspace run={runSimulation} />)
    expect(screen.getByLabelText(/Covers/i)).toHaveValue(50)
    expect(screen.getByText(/Head chef/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByText(/Dirty-clean crossings/i)).toBeInTheDocument()
  })
})
