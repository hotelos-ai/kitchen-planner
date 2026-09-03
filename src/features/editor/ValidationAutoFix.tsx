import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { analyzeLayout } from '../../domain/layout-diagnostics'
import { validateSimulationInput } from '../../simulation/validation'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { applyAutomaticPlanFixes } from './auto-fix-orchestrator'

export function ValidationAutoFix({ store, onEditRoom }: { store: ProjectStore; onEditRoom?(): void }) {
  const project = useStore(store, (state) => state.project)
  const variant = useStore(store, getActiveVariant)
  const [status, setStatus] = useState('')
  const [fixing, setFixing] = useState(false)
  const { blockerCount, hasArchitectureBlocker } = useMemo(() => {
    const scenario = project.scenarios.find((candidate) => candidate.id === project.activeScenarioId) ?? project.scenarios[0]
    const simulationBlockers = scenario ? validateSimulationInput({
      architecture: variant.architecture,
      equipment: variant.equipment,
      scenario,
      layoutConstraints: variant.layoutConstraints,
    }) : []
    const geometryBlockers = analyzeLayout(variant.architecture, variant.equipment, { layoutConstraints: variant.layoutConstraints })
      .filter((issue) => issue.severity === 'error').length
    return {
      blockerCount: geometryBlockers + simulationBlockers.length,
      hasArchitectureBlocker: simulationBlockers.some((blocker) => blocker.scope === 'architecture'),
    }
  }, [project, variant])
  const runAutomaticFix = () => {
    setFixing(true)
    setStatus('Fixing the plan…')
    window.setTimeout(() => {
      setStatus(applyAutomaticPlanFixes(store).message)
      setFixing(false)
    }, 0)
  }

  return (
    <section className={`validation-auto-fix${blockerCount === 0 ? ' ready' : ''}`} aria-label="Validation status">
      {blockerCount > 0 ? <>
        <button
          type="button"
          className="validation-auto-fix-button"
          disabled={fixing}
          onClick={runAutomaticFix}
        >
          {fixing ? 'Fixing plan…' : 'Fix everything automatically'}
        </button>
        {hasArchitectureBlocker && onEditRoom && <button type="button" className="validation-room-fix" onClick={onEditRoom}>Fix room setup</button>}
        <p>{blockerCount} blocking issue{blockerCount === 1 ? '' : 's'} found. Automatic changes are one undoable step.</p>
      </> : <>
        <strong>Ready</strong>
        <p>No blocking issues. Warnings and professional notes are available under Review details.</p>
      </>}
      {status && <p className="validation-auto-fix-status" role="status">{status}</p>}
    </section>
  )
}
