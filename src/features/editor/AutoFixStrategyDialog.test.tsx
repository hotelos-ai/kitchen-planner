import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import * as orchestrator from './auto-fix-orchestrator'
import { AutoFixStrategyDialog } from './AutoFixStrategyDialog'
import { ValidationAutoFix } from './ValidationAutoFix'

const result = {
  status: 'success',
  strategy: 'layout',
  applied: true,
  message: 'Fixed automatically.',
  addedCount: 0,
  movedCount: 0,
  scenarioAdjusted: false,
  architectureAdjusted: true,
  before: { blockers: 1, layoutErrors: 1, layoutWarnings: 0 },
  after: { blockers: 0, layoutErrors: 0, layoutWarnings: 0 },
  remaining: [],
} as ReturnType<typeof orchestrator.applyAutomaticPlanFixes>

describe('auto-fix strategy dialog', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([
    ['Adjust the layout', 'layout'],
    ['Move equipment', 'equipment'],
  ] as const)('runs the %s strategy and closes', async (buttonName, strategy) => {
    const store = createProjectStore(createSeedProject())
    const apply = vi.spyOn(orchestrator, 'applyAutomaticPlanFixes').mockReturnValue({ ...result, strategy })
    const onClose = vi.fn()
    const onResult = vi.fn()
    render(<AutoFixStrategyDialog store={store} onClose={onClose} onResult={onResult} />)

    await userEvent.click(screen.getByRole('button', { name: buttonName }))

    await waitFor(() => expect(apply).toHaveBeenCalledWith(store, { strategy }))
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ strategy }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays compact, explains both consequences, and cancels without running a fix', async () => {
    const apply = vi.spyOn(orchestrator, 'applyAutomaticPlanFixes')
    const onClose = vi.fn()
    render(<AutoFixStrategyDialog store={createProjectStore(createSeedProject())} onClose={onClose} onResult={vi.fn()} />)

    expect(screen.getByText('Keep equipment where possible; change the room or openings.')).toBeInTheDocument()
    expect(screen.getByText('Keep the room fixed; reposition movable equipment.')).toBeInTheDocument()
    expect(screen.queryByText(/diagnostic|warning|professional review/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(apply).not.toHaveBeenCalled()
  })

  it('opens from the validation action without applying before a strategy is chosen', async () => {
    const project = createSeedProject()
    project.variants[0].equipment.find((item) => item.id === 'mixer')!.xMm = -500
    const apply = vi.spyOn(orchestrator, 'applyAutomaticPlanFixes')
    render(<ValidationAutoFix store={createProjectStore(project)} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fix everything automatically' }))

    expect(screen.getByRole('dialog', { name: 'Choose an auto-fix strategy' })).toBeInTheDocument()
    expect(apply).not.toHaveBeenCalled()
  })
})
