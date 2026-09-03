import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { createCatalogEquipmentItem, getCatalogEntry } from '../../domain/catalog/kitchen-catalog'
import { suggestCatalogPlacement } from '../../domain/catalog/suggest-placement'
import {
  evaluateOperationalRequirements,
  type OperationalRequirementResult,
} from '../../domain/requirements/operational-requirements'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

type AddOperation = {
  type: 'add_component'
  variantId: string
  componentId: string
  catalogId: string
  position: { xMm: number; yMm: number }
  configurationId?: string
  skinId?: string
}

const componentId = (catalogId: string) =>
  `${catalogId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

const recommendedCatalogIds = (results: readonly OperationalRequirementResult[]) => [
  ...new Set(results
    .filter((result) => result.scope === 'equipment')
    .map((result) => result.recommendedCatalogIds.find((catalogId) => getCatalogEntry(catalogId)))
    .filter((catalogId): catalogId is string => Boolean(catalogId))),
]

function buildRecommendedOperations({
  results,
  variant,
  snapMm,
  onlyCatalogId,
}: {
  results: readonly OperationalRequirementResult[]
  variant: ReturnType<typeof getActiveVariant>
  snapMm: number
  onlyCatalogId?: string
}): AddOperation[] {
  const operations: AddOperation[] = []
  const plannedEquipment = [...variant.equipment]
  const catalogIds = onlyCatalogId ? [onlyCatalogId] : recommendedCatalogIds(results)

  catalogIds.forEach((catalogId) => {
    const entry = getCatalogEntry(catalogId)
    if (!entry) return
    const placement = suggestCatalogPlacement({
      architecture: variant.architecture,
      equipment: plannedEquipment,
      entry,
      snapMm,
      layoutConstraints: variant.layoutConstraints,
    })
    if (!placement) return
    const id = componentId(catalogId)
    const configurationId = entry.configurationIds[0]
    const skinId = entry.appearanceSkinIds[0]
    const operation: AddOperation = {
      type: 'add_component',
      variantId: variant.id,
      componentId: id,
      catalogId,
      position: { xMm: placement.xMm, yMm: placement.yMm },
      ...(configurationId ? { configurationId } : {}),
      ...(skinId ? { skinId } : {}),
    }
    operations.push(operation)
    plannedEquipment.push(createCatalogEquipmentItem({
      catalogId,
      componentId: id,
      position: operation.position,
      ...(configurationId ? { configurationId } : {}),
      ...(skinId ? { skinId } : {}),
    }))
  })

  return operations
}

const titleFor = (severity: OperationalRequirementResult['severity']) => {
  if (severity === 'professional-review') return 'Professional review'
  return severity === 'blocker' ? 'Blockers' : 'Warnings'
}

export function EssentialsChecker({ store, onEditRoom, focusItemId, showQuickFixes = true }: { store: ProjectStore; onEditRoom?(): void; focusItemId?: string; showQuickFixes?: boolean }) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const [message, setMessage] = useState('')
  const scenario = project.scenarios.find((candidate) => candidate.id === project.activeScenarioId) ?? project.scenarios[0]
  const results = useMemo(() => scenario ? evaluateOperationalRequirements({
    architecture: variant.architecture,
    equipment: variant.equipment,
    scenario,
    layoutConstraints: variant.layoutConstraints,
  }) : [], [scenario, variant])
  const equipmentRecommendations = recommendedCatalogIds(results)
  const hasBlockingArchitectureFinding = results.some((result) =>
    result.severity === 'blocker' && result.scope === 'architecture')

  const addRecommendations = (onlyCatalogId?: string) => {
    const operations = buildRecommendedOperations({ results, variant, snapMm: project.snapMm, onlyCatalogId })
    if (!operations.length) {
      setMessage('No safe automatic placement was found. Open the catalog to place this item manually.')
      return
    }
    const intent = onlyCatalogId ? 'Add recommended essential' : 'Auto-fix missing essentials'
    const applied = store.getState().applyWorkspaceOperations(operations, intent)
    setMessage(applied.ok ? `${operations.length} recommended item${operations.length === 1 ? '' : 's'} added.` : applied.message)
  }

  return (
    <section className="essentials-checker" aria-label="Operational essentials">
      <header>
        <span className="eyebrow">Operational readiness</span>
        <strong>Check essentials</strong>
        <p>Scenario-based operational guidance, not regulatory certification.</p>
      </header>
      {showQuickFixes && (equipmentRecommendations.length > 0 || (hasBlockingArchitectureFinding && onEditRoom)) &&
        <section className="essentials-quick-fixes" aria-label="Quick fixes">
          {equipmentRecommendations.length > 0 &&
            <button type="button" className="primary-action" onClick={() => addRecommendations()}>Auto-fix missing essentials</button>}
          {hasBlockingArchitectureFinding && onEditRoom &&
            <button type="button" onClick={onEditRoom}>Fix room setup</button>}
        </section>}
      {(['blocker', 'warning', 'professional-review'] as const).map((severity) => {
        const findings = results.filter((result) => result.severity === severity)
        return <section key={severity} className={`essentials-group ${severity}`}>
          <h3>{titleFor(severity)}</h3>
          <span>{findings.length}</span>
          {findings.length === 0
            ? <p>None found in the current operational model.</p>
            : <ul>{findings.map((result, index) => {
              const catalogId = result.recommendedCatalogIds.find((id) => getCatalogEntry(id))
              const entry = catalogId ? getCatalogEntry(catalogId) : undefined
              const focused = Boolean(focusItemId && result.itemIds.includes(focusItemId))
              return <li key={`${result.code}-${index}`} className={focused ? 'focused-check' : undefined}>
                <p>{result.reason}</p>
                {result.scope === 'architecture' && <button type="button" onClick={onEditRoom} disabled={!onEditRoom} aria-label={`Edit room for ${result.reason}`}>Edit room</button>}
                {severity !== 'professional-review' && catalogId && entry && <button type="button" onClick={() => addRecommendations(catalogId)}>Add {entry.displayName}</button>}
                {result.itemIds.length > 0 && <button type="button" onClick={() => store.getState().selectItems(result.itemIds)}>Show on plan</button>}
              </li>
            })}</ul>}
        </section>
      })}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
