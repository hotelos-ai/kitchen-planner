import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveVariant } from '../../state/project-store'
import { SpaceItemInspector } from './SpaceItemInspector'

it('commits an opening number on Enter after replacing the controlled value', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  render(<SpaceItemInspector store={store} selection={{ kind: 'opening', id: 'clean-window' }} onClearSelection={vi.fn()} />)

  const width = screen.getByLabelText('Width (mm)')
  await user.clear(width)
  await user.type(width, '1350{Enter}')

  expect(getActiveVariant(store.getState()).architecture.openings.find((opening) => opening.id === 'clean-window')?.widthMm).toBe(1350)
  expect(width).toHaveValue(1350)
})

it('commits a layout number when focus leaves the field', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  render(<SpaceItemInspector store={store} selection={{ kind: 'pillar', id: 'pillar' }} onClearSelection={vi.fn()} />)

  const x = screen.getByLabelText('X (mm)')
  await user.clear(x)
  await user.type(x, '2750')
  expect(getActiveVariant(store.getState()).architecture.pillars[0].xMm).toBe(3100)

  await user.tab()

  expect(getActiveVariant(store.getState()).architecture.pillars[0].xMm).toBe(2750)
  expect(x).toHaveValue(2750)
})

it('restores the saved layout value when a number is invalid', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  render(<SpaceItemInspector store={store} selection={{ kind: 'pillar', id: 'pillar' }} onClearSelection={vi.fn()} />)

  const width = screen.getByLabelText('Width (mm)')
  await user.clear(width)
  await user.tab()

  expect(getActiveVariant(store.getState()).architecture.pillars[0].widthMm).toBe(400)
  expect(width).toHaveValue(400)
})
