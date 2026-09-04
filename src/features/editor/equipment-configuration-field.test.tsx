import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createCatalogEquipmentItem } from '../../domain/catalog/kitchen-catalog'
import { createProjectStore, getActiveItem } from '../../state/project-store'
import { EquipmentInspector } from './EquipmentInspector'

it('offers and applies typical configurations to the selected component', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['two-door-fridge'])
  render(<EquipmentInspector store={store} />)

  const field = screen.getByRole('combobox', { name: /Equipment configuration/i })
  expect(field).toHaveValue('cold-upright-double')
  expect(screen.getByText(/Typical configuration · modified/i)).toBeInTheDocument()

  await user.selectOptions(field, 'cold-chest-freezer')

  expect(getActiveItem(store.getState(), 'two-door-fridge')).toMatchObject({
    label: 'Chest freezer',
    widthMm: 1200,
    depthMm: 700,
    heightMm: 850,
    visualPreset: 'chest-freezer',
  })
  expect(screen.getByLabelText(/^Width \(mm\)$/i)).toHaveValue('1200')
  expect(screen.getByLabelText(/^Depth \(mm\)$/i)).toHaveValue('700')
  expect(screen.getByLabelText(/^Height \(mm\)$/i)).toHaveValue('850')
  expect(screen.getByText(/Applies typical size, clearance, capabilities, and 3D skin/i)).toBeInTheDocument()
})

it('offers all known configurations for a custom component', () => {
  const store = createProjectStore(createSeedProject())
  const customId = store.getState().addCustomItem({ label: 'Imported block', widthMm: 600, depthMm: 500 })
  render(<EquipmentInspector store={store} />)

  expect(screen.getByRole('option', { name: 'Chest freezer' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Tandoor' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Pass-through dishwasher' })).toBeInTheDocument()
  expect(getActiveItem(store.getState(), customId).configurationPreset).toBeUndefined()
})

it('configures a dishwasher with a front input and side output', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['dishwasher'])
  render(<EquipmentInspector store={store} />)

  expect(screen.getByLabelText('Dishwasher input side')).toHaveValue('front')
  await user.selectOptions(screen.getByLabelText('Dishwasher output side'), 'left')

  expect(getActiveItem(store.getState(), 'dishwasher').accessFlow).toEqual({
    inputFace: 'front',
    outputFace: 'left',
  })
})

it('allows an industrial stainless-steel shelf height to be edited', async () => {
  const user = userEvent.setup()
  const project = createSeedProject()
  project.variants[0].equipment = [createCatalogEquipmentItem({
    catalogId: 'storage-freestanding-shelving',
    componentId: 'ss-shelf',
    position: { xMm: 500, yMm: 500 },
  })]
  const store = createProjectStore(project)
  store.getState().selectItems(['ss-shelf'])
  render(<EquipmentInspector store={store} />)

  const height = screen.getByLabelText(/^Height \(mm\)$/i)
  await user.clear(height)
  await user.type(height, '2200')
  await user.tab()

  expect(getActiveItem(store.getState(), 'ss-shelf').heightMm).toBe(2200)
})
