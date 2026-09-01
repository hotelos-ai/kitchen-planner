import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByLabelText(/Head chef count/i)).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
    expect(await screen.findByText(/Total staff travel/i)).toBeInTheDocument()
    expect(screen.getByText(/Dirty-clean crossings/i)).toBeInTheDocument()
    expect(screen.getByText(/Live backlog/i)).toBeInTheDocument()
    expect(screen.getByText(/Average served wait/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Wait-time distribution/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Layout verdict/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Playback speed/i)).toHaveValue('25')
    fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '2000' } })
    expect(screen.getAllByLabelText(/live queue/i).length).toBeGreaterThan(0)
  })
})
