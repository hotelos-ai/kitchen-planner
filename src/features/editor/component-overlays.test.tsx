import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { ComponentContextMenu } from './ComponentContextMenu'
import { QuickConfigurationPopover } from './QuickConfigurationPopover'

const project = createSeedProject()
const item = project.variants[0].equipment.find((candidate) => candidate.id === 'tandoor')!

describe('component editing overlays', () => {
  it('exposes the complete accessible context action set', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<ComponentContextMenu item={item} locked={false} position={{ x: 20, y: 30 }} onAction={onAction} onClose={vi.fn()} />)

    for (const name of ['Configure', 'Skin', 'Rotate left', 'Rotate right', 'Duplicate', 'Lock', 'Inspect in 3D', 'Remove']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('menuitem', { name: 'Rotate left' }))
    expect(onAction).toHaveBeenCalledWith('rotate-left')
  })

  it('labels a locked component action as Unlock', () => {
    render(<ComponentContextMenu item={item} locked position={{ x: 20, y: 30 }} onAction={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('menuitem', { name: 'Unlock' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Lock' })).not.toBeInTheDocument()
  })

  it('opens compact physical configuration and appearance-skin dialogs', async () => {
    const user = userEvent.setup()
    const store = createProjectStore(project)
    const onSkinChange = vi.fn()
    const { rerender } = render(<QuickConfigurationPopover item={item} store={store} mode="configure" position={{ x: 10, y: 10 }} onClose={vi.fn()} onSkinChange={onSkinChange} />)
    expect(screen.getByRole('dialog', { name: /Quick configure Tandoor/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Equipment configuration')).toBeInTheDocument()

    rerender(<QuickConfigurationPopover item={item} store={store} mode="skin" position={{ x: 10, y: 10 }} onClose={vi.fn()} onSkinChange={onSkinChange} />)
    expect(screen.getByRole('dialog', { name: /Choose skin for Tandoor/i })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Appearance skin'), 'stainless-polished')
    await user.click(screen.getByRole('button', { name: 'Apply skin' }))
    expect(onSkinChange).toHaveBeenCalledWith('tandoor', 'stainless-polished')
  })
})
