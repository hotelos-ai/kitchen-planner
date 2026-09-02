import { useMemo, useState, type DragEvent } from 'react'
import { useStore } from 'zustand'
import {
  filterCatalog,
  KITCHEN_CATALOG,
  searchCatalog,
} from '../../domain/catalog/kitchen-catalog'
import { CATALOG_DRAG_MIME } from '../../domain/catalog/catalog-drag'
import type { CatalogCategory, CatalogEntry } from '../../domain/catalog/types'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import type { DisplayUnit } from '../../domain/project'
import { formatDimensions } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'

type Props = { store: ProjectStore }

export { CATALOG_DRAG_MIME } from '../../domain/catalog/catalog-drag'

const titleCase = (value: string) => value
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')

function CatalogCard({ entry, displayUnit, onAdd }: { entry: CatalogEntry; displayUnit: DisplayUnit; onAdd: () => void }) {
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(CATALOG_DRAG_MIME, JSON.stringify({
      catalogId: entry.catalogId,
      dimensions: entry.typicalDimensions,
      placement: 'preferred-point',
    }))
  }

  return (
    <article
      className="catalog-card"
      data-testid="catalog-card"
      data-catalog-id={entry.catalogId}
      data-category={entry.category}
      data-capabilities={entry.capabilities.join(' ')}
      draggable
      onDragStart={handleDragStart}
    >
      <div>
        <span className="eyebrow">{titleCase(entry.category)}</span>
        <h3>{entry.displayName}</h3>
        <p>{entry.description}</p>
        <small>{formatDimensions(entry.typicalDimensions, displayUnit)}</small>
      </div>
      <button type="button" onClick={onAdd} aria-label={`Add ${entry.displayName}`}>Add</button>
    </article>
  )
}

export function EquipmentLibrary({ store }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CatalogCategory | ''>('')
  const [capability, setCapability] = useState('')
  const [placementError, setPlacementError] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [label, setLabel] = useState('Custom equipment')
  const [widthMm, setWidthMm] = useState(600)
  const [depthMm, setDepthMm] = useState(600)

  const categories = useMemo(
    () => [...new Set(KITCHEN_CATALOG.map((entry) => entry.category))].sort(),
    [],
  )
  const capabilities = useMemo(
    () => [...new Set(KITCHEN_CATALOG.flatMap((entry) => entry.capabilities))].sort(),
    [],
  )
  const entries = useMemo(
    () => filterCatalog(searchCatalog(query), {
      ...(category ? { category } : {}),
      ...(capability ? { capability } : {}),
    }),
    [query, category, capability],
  )

  const addCatalogEntry = (entry: CatalogEntry) => {
    setPlacementError('')
    const placement = suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment: variant.equipment,
      entry,
      snapMm: project.snapMm,
    })
    if (!placement) {
      setPlacementError(`No clear position is available for ${entry.displayName}.`)
      return
    }
    const id = store.getState().addCatalogItem(entry.catalogId, {
      xMm: placement.xMm,
      yMm: placement.yMm,
    })
    if (id) store.getState().selectItems([id])
  }

  const addCustom = () => {
    store.getState().addCustomItem({ label, widthMm, depthMm })
    setShowCustom(false)
  }

  return (
    <aside className="equipment-library" aria-label="Equipment catalog">
      <div className="panel-heading"><span className="eyebrow">Component catalog</span><h2>Equipment</h2></div>
      <label>
        Search equipment catalog
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, synonym, or use"
        />
      </label>
      <div className="field-pair">
        <label>
          Catalog category
          <select value={category} onChange={(event) => setCategory(event.target.value as CatalogCategory | '')}>
            <option value="">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
        </label>
        <label>
          Catalog capability
          <select value={capability} onChange={(event) => setCapability(event.target.value)}>
            <option value="">All capabilities</option>
            {capabilities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
        </label>
      </div>
      {placementError && <p role="alert">{placementError}</p>}
      <div className="catalog-grid">
        {entries.map((entry) => <CatalogCard key={entry.catalogId} entry={entry} displayUnit={project.displayUnit} onAdd={() => addCatalogEntry(entry)} />)}
        {entries.length === 0 && <p role="status">No catalog components match these filters.</p>}
      </div>
      <details open>
        <summary>Current layout · {variant.equipment.length} components</summary>
        <div className="equipment-list">
          {variant.equipment.map((item) => (
            <button
              key={item.id}
              type="button"
              className={selectedIds.includes(item.id) ? 'equipment-row selected' : 'equipment-row'}
              aria-label={`Select ${item.label}, ${item.widthMm} mm by ${item.depthMm} mm`}
              onClick={(event) => event.shiftKey ? store.getState().toggleItemSelection(item.id) : store.getState().selectItems([item.id])}
            >
              <span className={`category-dot ${item.category}`} />
              <span><strong>{item.label}</strong><small>{formatDimensions(item, project.displayUnit)}{item.approximate ? ' · approximate' : ''}</small></span>
            </button>
          ))}
        </div>
      </details>
      <button type="button" className="add-custom-button" onClick={() => setShowCustom((value) => !value)}>＋ Add custom item</button>
      {showCustom && (
        <form className="custom-item-form" onSubmit={(event) => { event.preventDefault(); addCustom() }}>
          <label>New item label<input aria-label="New item label" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <div className="field-pair">
            <label>Width (mm)<input type="number" min="100" step="50" value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} /></label>
            <label>Depth (mm)<input type="number" min="100" step="50" value={depthMm} onChange={(event) => setDepthMm(Number(event.target.value))} /></label>
          </div>
          <button type="submit" className="primary-button">Add to plan</button>
        </form>
      )}
    </aside>
  )
}
