export type WebMcpErrorTaxonomyEntry = {
  code: string
  recovery: string
}

/**
 * Stable errors exposed by the registered tools and their shared workspace
 * facade. Keep this list alphabetized so clients can diff it between releases.
 */
export const WEBMCP_ERROR_TAXONOMY: readonly WebMcpErrorTaxonomyEntry[] = [
  { code: 'aborted', recovery: 'Retry the request only if the user still wants the operation.' },
  { code: 'auto-layout-active', recovery: 'Poll or cancel the active auto-layout run before starting another.' },
  { code: 'auto-layout-failed', recovery: 'Review the run error, adjust constraints or budget, and start a new run.' },
  { code: 'auto-layout-not-configured', recovery: 'Auto-layout is unavailable in this session; continue with explicit layout operations.' },
  { code: 'baseline-mismatch', recovery: 'Re-read the selected baseline layout and start a new auto-layout run against that exact layout.' },
  { code: 'batch-operation-failed', recovery: 'Inspect operationIndex and causeCode, correct that operation, then preview the complete batch again.' },
  { code: 'cancelled', recovery: 'Start a new run only if the user still wants the cancelled work.' },
  { code: 'checkpoint-failed', recovery: 'Re-read the checkpoint list and current revision, then retry the checkpoint action.' },
  { code: 'comparison-failed', recovery: 'Verify both layouts and the scenario still exist, then retry the comparison.' },
  { code: 'download-unavailable', recovery: 'Use the returned contents when present, or retry download in an interactive browser context.' },
  { code: 'duplicate-id', recovery: 'Choose a new stable ID that is unique in the targeted project or layout.' },
  { code: 'empty-batch', recovery: 'Provide at least one operation in the batch.' },
  { code: 'expired-preview-token', recovery: 'Preview the batch again to obtain a fresh token.' },
  { code: 'export-failed', recovery: 'Re-read the project, select a supported export format, and retry.' },
  { code: 'idempotency-conflict', recovery: 'Use a new idempotency key for different batch content.' },
  { code: 'import-failed', recovery: 'Validate the project JSON and retry with the latest revision.' },
  { code: 'internal-error', recovery: 'Retry once; if it recurs, report the tool name and message without guessing a write.' },
  { code: 'invalid-baseline', recovery: 'Re-read the baseline layout, correct its reported schema issues, and start a new auto-layout run.' },
  { code: 'invalid-candidate', recovery: 'Correct the candidate fields or referenced catalog configuration, then preview again.' },
  { code: 'invalid-input', recovery: 'Correct the request to match the tool inputSchema exactly and remove unknown fields.' },
  { code: 'invalid-manifest', recovery: 'Correct the auto-layout constraints and budgets to match the optimizer manifest schema, then retry.' },
  { code: 'invalid-operation', recovery: 'Correct the operation at operationIndex using operationSchema from get_workspace_guide.' },
  { code: 'invalid-preview-token', recovery: 'Call preview_layout_changes again and use its returned token in this page session.' },
  { code: 'invalid-project', recovery: 'Correct the reported project-schema issues before importing or committing again.' },
  { code: 'invalid-room-geometry', recovery: 'Supply positive room bounds and keep every polygon vertex within those bounds.' },
  { code: 'invalid-scenarios', recovery: 'Re-read the simulation scenarios, correct their reported schema issues, and start a new auto-layout run.' },
  { code: 'last-variant', recovery: 'Create another layout before removing the project\'s only layout.' },
  { code: 'locked-architecture', recovery: 'Explicitly unlock the architecture in a revision-guarded update before changing it.' },
  { code: 'locked-architecture-element', recovery: 'Remove the element from lockedArchitectureElementIds, with user approval, before editing it.' },
  { code: 'locked-component', recovery: 'Unlock the component, with user approval, before moving, resizing, or removing it.' },
  { code: 'missing-architecture-element', recovery: 'Re-read the architecture and use an existing opening, pillar, or storage-zone ID.' },
  { code: 'missing-checkpoint', recovery: 'List checkpoints again and use an ID that exists on the selected layout.' },
  { code: 'missing-component', recovery: 'Re-read the targeted layout and use existing component IDs.' },
  { code: 'missing-scenario', recovery: 'Read get_simulation_guide and use an existing scenario ID.' },
  { code: 'missing-simulation-result', recovery: 'Run run_simulation for this layout and scenario before reading its result.' },
  { code: 'missing-variant', recovery: 'Re-read get_layout and use an existing layout variant ID.' },
  { code: 'preview-document-mismatch', recovery: 'The open project changed; re-read it and create a new preview for this document.' },
  { code: 'preview-kind-mismatch', recovery: 'Use the token only with the matching apply tool, or create a new preview.' },
  { code: 'preview-revision-changed', recovery: 'Re-read get_layout, recompute the delta, and preview it again.' },
  { code: 'result-consumed', recovery: 'The result was already adopted; read the layouts instead of adopting it again.' },
  { code: 'result-not-finalist', recovery: 'Poll get_auto_layout_run and choose a confirmed finalist ID.' },
  { code: 'result-not-serializable', recovery: 'Retry with a smaller supported response; report the tool if the error recurs.' },
  { code: 'result-too-large', recovery: 'Request a narrower view or omit returned artifact contents and retry.' },
  { code: 'room-polygon-required', recovery: 'Include an explicit roomPolygon when resizing a non-rectangular room.' },
  { code: 'run-not-active', recovery: 'Read the run status; only a currently running auto-layout run can be cancelled.' },
  { code: 'run-not-complete', recovery: 'Poll get_auto_layout_run until completion before adopting a finalist.' },
  { code: 'run-not-found', recovery: 'Use a run ID created in this page session, or start a new run.' },
  { code: 'same-variant', recovery: 'Choose two different layout variant IDs to compare.' },
  { code: 'share-failed', recovery: 'Re-read the selected layout and scenario, then retry without browser download.' },
  { code: 'simulation-failed', recovery: 'Check the selected layout and scenario, reduce requested output if needed, and rerun.' },
  { code: 'simulation-not-configured', recovery: 'Simulation is unavailable in this session; do not present modeled metrics.' },
  { code: 'stale-document', recovery: 'The open project changed; re-read its document ID and start a new auto-layout run.' },
  { code: 'stale-revision', recovery: 'Re-read get_layout, recompute the intended delta, and submit it against the new revision.' },
  { code: 'unknown-catalog-entry', recovery: 'Query get_component_catalog again and use a returned catalogId.' },
  { code: 'unknown-component', recovery: 'Re-read the active layout and use one of its current component IDs.' },
  { code: 'unsupported-operation', recovery: 'Use a supported operation from supportedOperations or an available dedicated tool.' },
  { code: 'used-preview-token', recovery: 'Preview the batch again because each token can commit only once.' },
  { code: 'worker-error', recovery: 'Start a new auto-layout run; if the worker fails again, report its message and continue with explicit layout operations.' },
  { code: 'wrong-document', recovery: 'The open project was replaced; re-read it before preparing another change.' },
  { code: 'wrong-run-revision', recovery: 'Use the revision reported by the run and ensure the project has not changed before adoption.' },
] as const

export function recoveryForErrorCode(code: string): string {
  return WEBMCP_ERROR_TAXONOMY.find((entry) => entry.code === code)?.recovery
    ?? 'Re-read the relevant workspace state, inspect the error details, and retry only after correcting the request.'
}
