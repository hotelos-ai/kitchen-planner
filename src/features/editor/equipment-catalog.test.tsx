import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KITCHEN_CATALOG } from '../../domain/catalog/kitchen-catalog'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore, getActiveVariant } from '../../state/project-store'
import { CATALOG_DRAG_MIME, EquipmentLibrary } from './EquipmentLibrary'

const emptyStore = () => {
  const project = createSeedProject()
  project.variants[0].equipment = []
  return createProjectStore(project)
}

describe('equipment catalog gallery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches display copy and synonyms', async () => {
    const user = userEvent.setup()
    const entry = KITCHEN_CATALOG.find((candidate) => candidate.synonyms.some((synonym) => !candidate.displayName.toLowerCase().includes(synonym.toLowerCase())))!
    const synonym = entry.synonyms.find((candidate) => !entry.displayName.toLowerCase().includes(candidate.toLowerCase()))!
    render(<EquipmentLibrary store={emptyStore()} />)

    await user.type(screen.getByRole('searchbox', { name: /^Search$/i }), synonym)

    expect(screen.getByRole('heading', { name: entry.displayName })).toBeInTheDocument()
  })

  it('filters by category and capability', async () => {
    const user = userEvent.setup()
    const entry = KITCHEN_CATALOG.find((candidate) => candidate.capabilities.length > 0)!
    render(<EquipmentLibrary store={emptyStore()} />)

    await user.selectOptions(screen.getByLabelText(/Catalog category/i), entry.category)
    await user.selectOptions(screen.getByLabelText(/Catalog capability/i), entry.capabilities[0])

    const cards = screen.getAllByTestId('catalog-card')
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-category', entry.category)
      expect(card.getAttribute('data-capabilities')?.split(' ')).toContain(entry.capabilities[0])
    })
  })

  it('renders a useful empty state', async () => {
    render(<EquipmentLibrary store={emptyStore()} />)
    await userEvent.type(screen.getByRole('searchbox', { name: /^Search$/i }), 'no-such-kitchen-component-zzzz')
    expect(screen.getByText(/No catalog components match/i)).toBeInTheDocument()
  })

  it('adds at a deterministic free point through the catalog operation and selects the instance', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'catalog-instance' })
    const user = userEvent.setup()
    const store = emptyStore()
    const entry = KITCHEN_CATALOG.find((candidate) => candidate.typicalDimensions.widthMm <= 1200 && candidate.typicalDimensions.depthMm <= 900)!
    render(<EquipmentLibrary store={store} />)

    await user.type(screen.getByRole('searchbox', { name: /^Search$/i }), entry.displayName)
    await user.click(screen.getByRole('button', { name: `Add ${entry.displayName}` }))

    const selectedId = store.getState().selectedIds[0]
    const added = getActiveVariant(store.getState()).equipment.find((item) => item.id === selectedId)
    expect(selectedId).toBe(`${entry.catalogId}-catalog-instance`)
    expect(added).toMatchObject({
      id: selectedId,
      label: entry.displayName,
      xMm: expect.any(Number),
      yMm: expect.any(Number),
      configurationPreset: entry.configurationIds[0],
      appearanceSkinId: entry.appearanceSkinIds[0],
    })
  })

  it('publishes draggable preferred-point metadata', () => {
    const entry = KITCHEN_CATALOG[0]
    const setData = vi.fn()
    render(<EquipmentLibrary store={emptyStore()} />)
    const card = screen.getAllByTestId('catalog-card').find((candidate) => within(candidate).queryByRole('heading', { name: entry.displayName }))!

    expect(card).toHaveAttribute('draggable', 'true')
    fireEvent.dragStart(card, { dataTransfer: { setData } })

    expect(setData).toHaveBeenCalledWith(CATALOG_DRAG_MIME, JSON.stringify({
      catalogId: entry.catalogId,
      dimensions: entry.typicalDimensions,
      placement: 'preferred-point',
    }))
  })

  it('preserves the custom-component escape hatch', async () => {
    const user = userEvent.setup()
    const store = emptyStore()
    render(<EquipmentLibrary store={store} />)

    await user.click(screen.getByRole('button', { name: /Add custom item/i }))
    await user.clear(screen.getByLabelText(/New item label/i))
    await user.type(screen.getByLabelText(/New item label/i), 'Special warmer')
    await user.click(screen.getByRole('button', { name: /^Add to plan$/i }))

    expect(getActiveVariant(store.getState()).equipment[0]).toMatchObject({ label: 'Special warmer', category: 'custom' })
  })

  it('places a station template as an editable cluster', async () => {
    const user = userEvent.setup()
    const store = emptyStore()
    render(<EquipmentLibrary store={store} />)

    await user.click(screen.getByRole('tab', { name: 'Station templates' }))
    await user.click(screen.getByRole('button', { name: 'Add Plating and pass template' }))

    const equipment = getActiveVariant(store.getState()).equipment
    expect(equipment.length).toBeGreaterThanOrEqual(1)
    expect(equipment.some((item) => /pass|chef/i.test(item.label))).toBe(true)
  })
})
