import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { KITCHEN_CATALOG } from '../../domain/catalog/kitchen-catalog'
import { buildLayoutWizardOperations, type LayoutWizardDraft as DomainLayoutWizardDraft } from '../../domain/layout-wizard'
import type { Architecture, ArrivalPattern, OperationalProfile, StaffAssignment, StaffRole } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'
import { PolygonRoomEditor } from './PolygonRoomEditor'

type Props = {
  store: ProjectStore
  onClose(): void
  initialStep?: 0 | 1
  initialMode?: WizardMode
}

type WizardMode = 'duplicate' | 'blank-existing' | 'rectangle' | 'polygon'

export type LayoutWizardDraft = {
  mode: WizardMode
  sourceVariantId: string
  name: string
  architecture: Architecture
  profile: OperationalProfile
  essentialCatalogIds: string[]
}

const steps = ['Starting point', 'Room', 'Operational profile', 'Essentials', 'Review new layout'] as const
const roles: Array<{ role: StaffRole; label: string }> = [
  { role: 'head-chef', label: 'Head chef' },
  { role: 'sous-chef', label: 'Sous chef' },
  { role: 'cdp', label: 'Chef de partie' },
  { role: 'busser-washer', label: 'Busser / washer' },
]

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
const clone = <T,>(value: T): T => structuredClone(value)
const rectangularArchitecture = (source: Architecture): Architecture => ({
  ...clone(source),
  roomPolygon: [{ x: 0, y: 0 }, { x: source.widthMm, y: 0 }, { x: source.widthMm, y: source.depthMm }, { x: 0, y: source.depthMm }],
  openings: [],
  pillars: [],
  storageZones: [],
  locked: false,
})
const polygonArchitecture = (source: Architecture): Architecture => ({
  ...clone(source),
  openings: [],
  pillars: [],
  storageZones: [],
  locked: false,
})

export function LayoutWizard({ store, onClose, initialStep = 0, initialMode = 'duplicate' }: Props) {
  const project = useStore(store, (state) => state.project)
  const active = project.variants.find((variant) => variant.id === project.activeVariantId) ?? project.variants[0]
  const [step, setStep] = useState<number>(initialStep)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<LayoutWizardDraft>(() => ({
    mode: initialMode,
    sourceVariantId: active.id,
    name: `Layout option ${project.variants.length + 1}`,
    architecture: clone(active.architecture),
    profile: clone(active.operationalProfile ?? {
      covers: project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)?.covers ?? 100,
      peakDurationMinutes: project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)?.durationMinutes ?? 120,
      arrivalPattern: project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)?.arrivalPattern ?? 'steady',
      serviceStyle: 'table-service',
      menuAssumptions: [],
      staff: project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)?.staff ?? [{ role: 'head-chef', count: 1 }],
      targetCapacityPerHour: 60,
    }),
    essentialCatalogIds: [],
  }))

  const recommended = useMemo(() => {
    const required = new Set(['food-prep', 'cold-retrieval', 'finish-plate', 'hand-wash', 'dirty-landing', 'dish-wash', 'clean-landing'])
    return KITCHEN_CATALOG.filter((entry) => entry.capabilities.some((capability) => required.has(capability)))
      .filter((entry, index, entries) => entry.capabilities.some((capability) => entries.findIndex((candidate) => candidate.capabilities.includes(capability)) === index))
      .slice(0, 8)
  }, [])

  const source = project.variants.find((variant) => variant.id === draft.sourceVariantId) ?? active
  const setMode = (mode: WizardMode) => setDraft((current) => ({
    ...current,
    mode,
    architecture: mode === 'rectangle'
      ? rectangularArchitecture(source.architecture)
      : mode === 'polygon' ? polygonArchitecture(source.architecture) : clone(source.architecture),
  }))
  const setRoomDimension = (axis: 'widthMm' | 'depthMm', dimension: number) => setDraft((current) => {
    const architecture = { ...current.architecture, [axis]: dimension }
    return { ...current, architecture: rectangularArchitecture(architecture) }
  })
  const setProfile = (patch: Partial<OperationalProfile>) => setDraft((current) => ({ ...current, profile: { ...current.profile, ...patch } }))
  const setStaff = (role: StaffRole, count: number) => {
    const existing = draft.profile.staff ?? []
    const staff: StaffAssignment[] = roles.map(({ role: candidate }) => ({
      role: candidate,
      count: candidate === role ? count : existing.find((assignment) => assignment.role === candidate)?.count ?? 0,
    }))
    setProfile({ staff })
  }

  const next = () => {
    setError('')
    if (!draft.name.trim()) { setError('Enter a layout name.'); return }
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }
  const create = () => {
    setError('')
    try {
      const common = {
        name: draft.name,
        profile: draft.profile,
        essentialCatalogIds: draft.essentialCatalogIds,
      }
      const builderDraft: DomainLayoutWizardDraft = draft.mode === 'duplicate'
        ? { ...common, mode: 'duplicate', sourceVariantId: draft.sourceVariantId }
        : draft.mode === 'blank-existing'
          ? { ...common, mode: 'blank-existing', sourceVariantId: draft.sourceVariantId }
          : draft.mode === 'rectangle'
            ? { ...common, mode: 'rectangle', sourceVariantId: draft.sourceVariantId, architecture: draft.architecture }
            : { ...common, mode: 'polygon', sourceVariantId: draft.sourceVariantId, architecture: draft.architecture }
      const operations = buildLayoutWizardOperations(builderDraft, {
        project,
        newVariantId: makeId('layout'),
      })
      const result = store.getState().applyWorkspaceOperations(operations, 'Create layout from wizard')
      if (!result.ok) {
        setError(result.message)
        return
      }
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The layout could not be created.')
    }
  }

  const serviceWindows = draft.architecture.openings.filter((opening) => opening.kind === 'service-window').length

  return (
    <div className="layout-wizard-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-wizard-title"
        className="layout-wizard"
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
      >
        <header>
          <p>Step {step + 1} of {steps.length}</p>
          <h2 id="layout-wizard-title">{steps[step]}</h2>
          <button type="button" aria-label="Cancel layout wizard" onClick={onClose}>×</button>
        </header>

        {error && <p role="alert">{error}</p>}

        {step === 0 && (
          <div>
            <label>Layout name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <fieldset>
              <legend>Starting point</legend>
              <label><input type="radio" name="wizard-mode" checked={draft.mode === 'duplicate'} onChange={() => setMode('duplicate')} />Duplicate a layout</label>
              <label><input type="radio" name="wizard-mode" checked={draft.mode === 'blank-existing'} onChange={() => setMode('blank-existing')} />Blank equipment in an existing room</label>
              <label><input type="radio" name="wizard-mode" checked={draft.mode === 'rectangle'} onChange={() => setMode('rectangle')} />New rectangular room</label>
              <label><input type="radio" name="wizard-mode" checked={draft.mode === 'polygon'} onChange={() => setMode('polygon')} />Advanced polygon room</label>
            </fieldset>
            {(draft.mode === 'duplicate' || draft.mode === 'blank-existing') && (
              <label>
                Source layout
                <select value={draft.sourceVariantId} onChange={(event) => {
                  const selected = project.variants.find((variant) => variant.id === event.target.value) ?? active
                  setDraft((current) => ({ ...current, sourceVariantId: selected.id, architecture: clone(selected.architecture) }))
                }}>
                  {project.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            {(draft.mode === 'duplicate' || draft.mode === 'blank-existing') && <p>Room geometry will be copied from {source.name}.</p>}
            {draft.mode === 'rectangle' && (
              <fieldset>
                <legend>Rectangular room</legend>
                <label>Room width (mm)<input type="number" min="1000" step="100" value={draft.architecture.widthMm} onChange={(event) => setRoomDimension('widthMm', Number(event.target.value))} /></label>
                <label>Room depth (mm)<input type="number" min="1000" step="100" value={draft.architecture.depthMm} onChange={(event) => setRoomDimension('depthMm', Number(event.target.value))} /></label>
                <label>Wall height (mm)<input type="number" min="1000" step="100" value={draft.architecture.wallHeightMm} onChange={(event) => setDraft((current) => ({ ...current, architecture: { ...current.architecture, wallHeightMm: Number(event.target.value) } }))} /></label>
              </fieldset>
            )}
            {draft.mode === 'polygon' && <PolygonRoomEditor value={draft.architecture} onChange={(architecture) => setDraft((current) => ({ ...current, architecture }))} />}
          </div>
        )}

        {step === 2 && (
          <div>
            <label>Covers<input type="number" min="1" value={draft.profile.covers ?? 100} onChange={(event) => setProfile({ covers: Number(event.target.value) })} /></label>
            <label>Peak duration (minutes)<input type="number" min="1" value={draft.profile.peakDurationMinutes ?? 120} onChange={(event) => setProfile({ peakDurationMinutes: Number(event.target.value) })} /></label>
            <label>
              Arrival pattern
              <select value={draft.profile.arrivalPattern ?? 'steady'} onChange={(event) => setProfile({ arrivalPattern: event.target.value as ArrivalPattern })}>
                <option value="steady">Steady</option><option value="seating-wave">Seating wave</option><option value="two-waves">Two waves</option>
              </select>
            </label>
            <label>
              Service style
              <select value={draft.profile.serviceStyle ?? 'table-service'} onChange={(event) => setProfile({ serviceStyle: event.target.value })}>
                <option value="table-service">Table service</option><option value="counter-service">Counter service</option><option value="buffet">Buffet</option><option value="delivery">Delivery / takeaway</option>
              </select>
            </label>
            <label>Target capacity per hour<input type="number" min="1" value={draft.profile.targetCapacityPerHour ?? 60} onChange={(event) => setProfile({ targetCapacityPerHour: Number(event.target.value) })} /></label>
            <label>Menu and task assumptions<textarea value={(draft.profile.menuAssumptions ?? []).join(', ')} onChange={(event) => setProfile({ menuAssumptions: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            <fieldset>
              <legend>Staff roles and counts</legend>
              {roles.map(({ role, label }) => (
                <label key={role}>{label} count<input type="number" min="0" value={draft.profile.staff?.find((assignment) => assignment.role === role)?.count ?? 0} onChange={(event) => setStaff(role, Number(event.target.value))} /></label>
              ))}
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div>
            <p>Choose recommended operational components, alternatives, or start with an empty room.</p>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, essentialCatalogIds: [] }))}>Start without recommended equipment</button>
            <fieldset>
              <legend>Recommended equipment</legend>
              {recommended.map((entry) => (
                <label key={entry.catalogId}>
                  <input
                    type="checkbox"
                    checked={draft.essentialCatalogIds.includes(entry.catalogId)}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      essentialCatalogIds: event.target.checked
                        ? [...current.essentialCatalogIds, entry.catalogId]
                        : current.essentialCatalogIds.filter((catalogId) => catalogId !== entry.catalogId),
                    }))}
                  />
                  {entry.displayName} — {entry.description}
                </label>
              ))}
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div>
            <dl>
              <dt>Name</dt><dd>{draft.name}</dd>
              <dt>Starting point</dt><dd>{draft.mode}</dd>
              <dt>Room</dt><dd>{draft.architecture.widthMm} × {draft.architecture.depthMm} mm; {draft.architecture.roomPolygon.length} wall vertices</dd>
              <dt>Geometry</dt><dd>{serviceWindows} service window{serviceWindows === 1 ? '' : 's'}, {draft.architecture.pillars.length} pillar{draft.architecture.pillars.length === 1 ? '' : 's'}, {draft.architecture.storageZones.length} storage zone{draft.architecture.storageZones.length === 1 ? '' : 's'}</dd>
              <dt>Demand</dt><dd>{draft.profile.covers} covers · {(draft.profile.arrivalPattern ?? 'steady').replace('-', ' ')} · {draft.profile.peakDurationMinutes} minute peak</dd>
              <dt>Capacity</dt><dd>{draft.profile.targetCapacityPerHour} covers per hour</dd>
              <dt>Equipment</dt><dd>{draft.mode === 'duplicate' ? `${source.equipment.length} duplicated` : `${draft.essentialCatalogIds.length} selected essentials`}</dd>
            </dl>
            <p>Planning checks describe modeled operational assumptions. Kitchen Planner does not certify regulatory compliance; engage qualified professionals for local requirements.</p>
          </div>
        )}

        <footer>
          {step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)}>Back</button>}
          {step < steps.length - 1 && <button type="button" onClick={next}>Next</button>}
          {step === steps.length - 1 && <button type="button" onClick={create}>Create layout</button>}
        </footer>
      </section>
    </div>
  )
}
