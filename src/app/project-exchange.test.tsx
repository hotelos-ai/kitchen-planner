import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { exportProject } from '../state/persistence'
import { projectStore } from '../state/project-store'
import { ProjectExchange } from './ProjectExchange'

describe('project exchange', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('imports a validated project without reloading the app', async () => {
    const imported = { ...createSeedProject(), name: 'Imported Manta Raja option' }
    render(<ProjectExchange />)
    await userEvent.upload(screen.getByLabelText(/Import project JSON/i), new File([exportProject(imported)], 'kitchen.json', { type: 'application/json' }))
    expect(projectStore.getState().project.name).toBe('Imported Manta Raja option')
    expect(screen.getByText(/Imported kitchen.json/i)).toBeInTheDocument()
  })

  it('keeps the current project when an import is invalid', async () => {
    render(<ProjectExchange />)
    await userEvent.upload(screen.getByLabelText(/Import project JSON/i), new File(['{"bad":true}'], 'bad.json', { type: 'application/json' }))
    expect(projectStore.getState().project.name).toBe('Manta Raja Kitchen Lab')
    expect(screen.getByRole('alert')).toHaveTextContent(/not a valid kitchen project/i)
  })

  it('exports the current validated project', async () => {
    const createObjectURL = vi.fn(() => 'blob:kitchen-project')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<ProjectExchange />)
    await userEvent.click(screen.getByRole('button', { name: /Export project/i }))
    expect(createObjectURL).toHaveBeenCalledOnce()
  })
})
