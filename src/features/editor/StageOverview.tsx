import { useMemo } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { evaluateOperationalRequirements } from '../../domain/requirements/operational-requirements'
import type { WorkflowStage } from '../../app/workflow'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'

type Props = {
  store: ProjectStore
  stage: WorkflowStage
  hideToolbarActions?: boolean
  onContinueToEquipment?(): void
  onCheckEssentials?(): void
  onSetUpSimulation?(): void
}

export function StageOverview({ store, stage, hideToolbarActions = false, onContinueToEquipment, onCheckEssentials, onSetUpSimulation }: Props) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const scenario = project.scenarios.find((entry) => entry.id === project.activeScenarioId) ?? project.scenarios[0]

  const geometryIssues = useMemo(
    () => analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints }),
    [variant],
  )
  const operationalResults = useMemo(
    () => scenario ? evaluateOperationalRequirements({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
      layoutConstraints: variant.layoutConstraints,
    }) : [],
    [scenario, variant],
  )
  const attentionCount = operationalResults.filter((result) => result.severity !== 'professional-review').length
  const staffCount = scenario?.staff.reduce((sum, entry) => sum + entry.count, 0) ?? 0

  if (stage === 'space') {
    const hasBoundary = variant.architecture.roomPolygon.length >= 3
    const hasAccess = variant.architecture.openings.some((opening) => opening.flow === 'entry' || opening.kind === 'door')
    const hasFixed = variant.architecture.pillars.length > 0
    const hasUtilities = variant.equipment.some((item) => item.category === 'hood' || item.catalogId?.startsWith('utility-'))
    const essentials = [
      { label: 'Room boundary defined', done: hasBoundary },
      { label: 'Main entrance added', done: hasAccess },
      { label: 'Ceiling height', done: variant.architecture.wallHeightMm > 0 },
      { label: 'Utility points', done: hasUtilities },
      { label: 'Fixed pillar added', done: hasFixed },
      { label: 'Service openings', done: variant.architecture.openings.some((opening) => opening.kind === 'service-window') },
    ]
    const complete = essentials.filter((item) => item.done).length
    return (
      <aside className="inspector stage-overview" aria-label="Space setup overview">
        <div className="panel-heading"><span className="eyebrow">Space setup</span><h2>Define the space</h2></div>
        <ul className="stage-checklist">
          {essentials.map((item) => (
            <li key={item.label} className={item.done ? 'done' : 'pending'}>
              {item.done ? '✓' : '○'} {item.label}
            </li>
          ))}
        </ul>
        <p className="stage-summary">{complete} of {essentials.length} essentials complete</p>
        {onContinueToEquipment && (
          <button type="button" className="primary-button" onClick={onContinueToEquipment}>Continue to equipment</button>
        )}
      </aside>
    )
  }

  if (stage === 'equipment') {
    return (
      <aside className="inspector stage-overview" aria-label="Layout overview">
        <div className="panel-heading"><span className="eyebrow">{variant.name}</span><h2>Equipment layout</h2></div>
        <ul className="stage-checklist">
          <li className="done">✓ {variant.equipment.length} equipment items</li>
          <li className={geometryIssues.length ? 'warning' : 'done'}>
            {geometryIssues.length ? '⚠' : '✓'} {geometryIssues.length || 'No'} physical checks require attention
          </li>
          <li className="pending">○ Menu and station details can be generated</li>
        </ul>
        <div className="stage-actions">
          {!hideToolbarActions && onCheckEssentials && (
            <button type="button" onClick={onCheckEssentials}>Validate Fit-Out{attentionCount ? ` ${attentionCount}` : ''}</button>
          )}
          {onSetUpSimulation && (
            <button type="button" className="primary-button" onClick={onSetUpSimulation}>Set up simulation</button>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="inspector stage-overview" aria-label="Simulation overview">
      <div className="panel-heading"><span className="eyebrow">{scenario?.name ?? 'Scenario'}</span><h2>Service simulation</h2></div>
      {scenario && (
        <ul className="stage-checklist">
          <li className="done">✓ {scenario.covers} covers in {scenario.durationMinutes} minutes</li>
          <li className="done">✓ {staffCount} staff</li>
          <li className="pending">○ {variant.equipment.length} equipment items mapped</li>
        </ul>
      )}
      <div className="stage-actions">
        {onSetUpSimulation && <button type="button" className="primary-button" onClick={onSetUpSimulation}>Run simulation</button>}
      </div>
    </aside>
  )
}
