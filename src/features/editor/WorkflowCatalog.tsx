import { useMemo, useState, type DragEvent } from 'react'
import { useStore } from 'zustand'
import type { WorkflowStage } from '../../app/workflow'
import {
  filterCatalog,
  searchCatalog,
} from '../../domain/catalog/kitchen-catalog'
import { CATALOG_DRAG_MIME } from '../../domain/catalog/catalog-drag'
import type { CatalogEntry } from '../../domain/catalog/types'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import type { DisplayUnit } from '../../domain/project'
import { formatDimensions } from '../../domain/units'
import type { ProjectStore } from '../../state/project-store'
import { getActiveVariant } from '../../state/project-store'
import { EquipmentLibrary } from './EquipmentLibrary'

type Props = { store: ProjectStore; stage: WorkflowStage }

type SpaceTab = 'build' | 'services' | 'fixed'

const titleCase = (value: string) => value
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')

const SPACE_TAB_FILTERS: Record<SpaceTab, (entry: CatalogEntry) => boolean> = {
  build: (entry) => entry.category === 'architecture' && (entry.tags.includes('opening') || entry.tags.includes('wall') || entry.tags.includes('zone')),
  services: (entry) => entry.category === 'ventilation-utilities' || entry.tags.includes('utility'),
  fixed: (entry) => entry.category === 'architecture' && (entry.tags.includes('fixed') || entry.tags.includes('obstruction') || entry.tags.includes('structure')),
}

function CatalogCard({ entry, displayUnit, onAdd }: { entry: CatalogEntry; displayUnit: DisplayUnit; onAdd: () => void }) {
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(CATALOG_DRAG_MIME, JSON.stringify({
      catalogId: entry.catalogId,
      dimensions: entry.typicalDimensions,
      placement: 'preferred-point',
    }))
  }
  const utilities = entry.placementRules.utilityRequirements?.join(' · ') ?? ''

  return (
    <article className="catalog-card" data-testid="catalog-card" data-catalog-id={entry.catalogId} draggable onDragStart={handleDragStart}>
      <div>
        <h3>{entry.displayName}</h3>
        <small>{formatDimensions(entry.typicalDimensions, displayUnit)}</small>
        {utilities && <small className="catalog-meta">{utilities}</small>}
      </div>
      <button type="button" onClick={onAdd} aria-label={`Add ${entry.displayName}`}>Add</button>
    </article>
  )
}

function SpaceCatalog({ store }: { store: ProjectStore }) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<SpaceTab>('build')
  const [placementError, setPlacementError] = useState('')

  const entries = useMemo(() => {
    const searched = searchCatalog(query)
    return filterCatalog(searched, {}).filter(SPACE_TAB_FILTERS[tab])
  }, [query, tab])

  const addCatalogEntry = (entry: CatalogEntry) => {
    setPlacementError('')
    const placement = suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment: variant.equipment,
      entry,
      snapMm: project.snapMm,
      layoutConstraints: variant.layoutConstraints,
    })
    if (!placement) {
      setPlacementError(`No clear position is available for ${entry.displayName}.`)
      return
    }
    const id = store.getState().addCatalogItem(entry.catalogId, { xMm: placement.xMm, yMm: placement.yMm })
    if (id) store.getState().selectItems([id])
  }

  return (
    <aside className="equipment-library" aria-label="Space components catalog">
      <div className="panel-heading"><span className="eyebrow">Space</span><h2>Space components</h2></div>
      <div className="catalog-tabs" role="tablist" aria-label="Space catalog tabs">
        {(['build', 'services', 'fixed'] as SpaceTab[]).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{titleCase(value)}</button>
        ))}
      </div>
      <label>
        Search
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wall, door, drain…" />
      </label>
      {placementError && <p role="alert">{placementError}</p>}
      <div className="catalog-grid">
        {entries.map((entry) => <CatalogCard key={entry.catalogId} entry={entry} displayUnit={project.displayUnit} onAdd={() => addCatalogEntry(entry)} />)}
        {entries.length === 0 && <p role="status">No components match this filter.</p>}
      </div>
      <button type="button" className="add-custom-button">＋ Add custom fixed item</button>
    </aside>
  )
}

export function WorkflowCatalog({ store, stage }: Props) {
  if (stage === 'space') return <SpaceCatalog store={store} />
  return <EquipmentLibrary store={store} stage={stage} />
}
