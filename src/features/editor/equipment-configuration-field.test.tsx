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
  expect(screen.getByText(/Configuration active · custom size or settings preserved/i)).toBeInTheDocument()

  await user.selectOptions(field, 'cold-chest-freezer')

  expect(getActiveItem(store.getState(), 'two-door-fridge')).toMatchObject({
    label: 'Chest freezer',
    widthMm: 1400,
    depthMm: 850,
    heightMm: 1000,
    visualPreset: 'chest-freezer',
  })
  expect(screen.getByLabelText(/^Width \(mm\)$/i)).toHaveValue('1400')
  expect(screen.getByLabelText(/^Depth \(mm\)$/i)).toHaveValue('850')
  expect(screen.getByLabelText(/^Height \(mm\)$/i)).toHaveValue('1000')
  expect(screen.getByText(/Configuration active · custom size or settings preserved/i)).toBeInTheDocument()
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

it('commits inspector dimensions when Enter is pressed', async () => {
  const user = userEvent.setup()
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['tandoor'])
  render(<EquipmentInspector store={store} />)

  const width = screen.getByLabelText(/^Width \(mm\)$/i)
  await user.clear(width)
  await user.type(width, '1350{Enter}')

  expect(getActiveItem(store.getState(), 'tandoor').widthMm).toBe(1350)
  expect(screen.getByLabelText(/^Width \(mm\)$/i)).toHaveValue('1350')
})

it('allows every shelf tier elevation to be customized without resizing the rack', async () => {
  const user = userEvent.setup()
  const project = createSeedProject()
  project.displayUnit = 'in'
  project.variants[0].equipment = [createCatalogEquipmentItem({
    catalogId: 'storage-freestanding-shelving',
    componentId: 'ss-shelf',
    configurationId: 'shelving-four-tier',
    position: { xMm: 500, yMm: 500 },
  })]
  const store = createProjectStore(project)
  const before = getActiveItem(store.getState(), 'ss-shelf')
  store.getState().selectItems(['ss-shelf'])
  render(<EquipmentInspector store={store} />)

  const shelfA = screen.getByLabelText('Shelf A elevation (in)')
  await user.clear(shelfA)
  await user.type(shelfA, '12{Enter}')

  const updated = getActiveItem(store.getState(), 'ss-shelf')
  expect(updated.shelfElevationsMm?.[0]).toBeCloseTo(304.8)
  expect(updated).toMatchObject({ widthMm: before.widthMm, depthMm: before.depthMm, heightMm: before.heightMm })
  expect(screen.getByLabelText('Shelf D elevation (in)')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Equipment configuration'), 'shelving-six-tier')
  expect(screen.getByLabelText('Shelf F elevation (in)')).toBeInTheDocument()
  const reconfigured = getActiveItem(store.getState(), 'ss-shelf')
  expect(reconfigured).toMatchObject({
    widthMm: before.widthMm,
    depthMm: before.depthMm,
    heightMm: before.heightMm,
  })
  expect(reconfigured.shelfElevationsMm).toHaveLength(4)
  expect(reconfigured.shelfElevationsMm?.[0]).toBeCloseTo(updated.shelfElevationsMm![0])
})

it('moves a complete shelf assembly to an explicit height from the floor', async () => {
  const user = userEvent.setup()
  const project = createSeedProject()
  project.variants[0].equipment = [createCatalogEquipmentItem({
    catalogId: 'storage-freestanding-shelving',
    componentId: 'raised-shelf',
    position: { xMm: 500, yMm: 500 },
  })]
  const store = createProjectStore(project)
  store.getState().selectItems(['raised-shelf'])
  render(<EquipmentInspector store={store} />)

  const floorHeight = screen.getByLabelText('Height from floor (mm)')
  await user.clear(floorHeight)
  await user.type(floorHeight, '900{Enter}')

  expect(getActiveItem(store.getState(), 'raised-shelf').baseElevationMm).toBe(900)
  expect(screen.getByLabelText('Shelf A elevation (mm)')).toHaveValue('940')
})
