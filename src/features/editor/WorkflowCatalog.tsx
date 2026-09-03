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

type SpaceTab = 'openings' | 'structure' | 'zones'

const titleCase = (value: string) => value
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')

const SPACE_TAB_FILTERS: Record<SpaceTab, (entry: CatalogEntry) => boolean> = {
  openings: (entry) => entry.category === 'architecture' && entry.tags.includes('opening'),
  structure: (entry) => entry.category === 'architecture' && (entry.tags.includes('fixed') || entry.tags.includes('obstruction')),
  zones: (entry) => entry.category === 'architecture' && entry.tags.includes('zone'),
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
  const [tab, setTab] = useState<SpaceTab>('openings')
  const [placementError, setPlacementError] = useState('')

  const entries = useMemo(() => {
    const searched = searchCatalog(query)
    return filterCatalog(searched, {}).filter(SPACE_TAB_FILTERS[tab])
  }, [query, tab])

  const defaultPosition = (entry: CatalogEntry) => {
    const architecture = variant.architecture
    const centroid = { x: architecture.widthMm / 2, y: architecture.depthMm / 2 }
    if (entry.tags.includes('opening')) return { xMm: centroid.x, yMm: centroid.y }
    const placed = entry.tags.includes('zone') ? architecture.storageZones.length : architecture.pillars.length
    const offset = { x: ((placed % 3) - 1) * 600, y: Math.floor(placed / 3) * 600 - 300 }
    return {
      xMm: Math.min(architecture.widthMm - 300, Math.max(300, centroid.x + offset.x)),
      yMm: Math.min(architecture.depthMm - 300, Math.max(300, centroid.y + offset.y)),
    }
  }

  const addCatalogEntry = (entry: CatalogEntry) => {
    setPlacementError('')
    const isArchitecture = entry.category === 'architecture'
    const position = isArchitecture ? defaultPosition(entry) : suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment: variant.equipment,
      entry,
      snapMm: project.snapMm,
      layoutConstraints: variant.layoutConstraints,
    })
    if (!position) {
      setPlacementError(`No clear position is available for ${entry.displayName}.`)
      return
    }
    const id = store.getState().addCatalogItem(entry.catalogId, { xMm: position.xMm, yMm: position.yMm })
    if (!id) setPlacementError(`Could not add ${entry.displayName} to the shared floor plan.`)
  }

  return (
    <aside className="equipment-library" aria-label="Space components catalog">
      <div className="panel-heading"><span className="eyebrow">Space</span><h2>Build the space</h2></div>
      <p className="stage-summary space-catalog-hint">Drag the outline on the plan to reshape the room, or add openings, structure, and zones here. Every change applies to all layouts.</p>
      <div className="catalog-tabs" role="tablist" aria-label="Space catalog tabs">
        {(['openings', 'structure', 'zones'] as SpaceTab[]).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{titleCase(value)}</button>
        ))}
      </div>
      <label>
        Search
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Door, window, pillar…" />
      </label>
      {placementError && <p role="alert">{placementError}</p>}
      <div className="catalog-grid">
        {entries.map((entry) => <CatalogCard key={entry.catalogId} entry={entry} displayUnit={project.displayUnit} onAdd={() => addCatalogEntry(entry)} />)}
        {entries.length === 0 && <p role="status">No components match this filter.</p>}
      </div>
    </aside>
  )
}

export function WorkflowCatalog({ store, stage }: Props) {
  if (stage === 'space') return <SpaceCatalog store={store} />
  return <EquipmentLibrary store={store} stage={stage} />
}
