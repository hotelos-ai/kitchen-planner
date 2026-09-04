/**
 * Domain capability manifest consumed by the WebMCP tools. The adapter layer
 * stays domain-neutral; everything kitchen-specific lives here so a different
 * spatial domain could substitute its own manifest.
 */

export type WorkspaceCoordinateSystem = {
  origin: string
  xAxis: string
  yAxis: string
  unit: string
  rotation: string
  componentAnchor: string
  walls: string
}

export type CapabilityManifest = {
  workspaceKind: string
  displayName: string
  domainSummary: string
  coordinateSystem: WorkspaceCoordinateSystem
  supportedDisplayUnits: readonly ('mm' | 'cm' | 'in' | 'ft')[]
  referenceImagePolicy: string
  agentWorkflow: readonly string[]
  uncertaintyGuidance: string
  limitations: readonly string[]
}

export const kitchenCapabilityManifest: CapabilityManifest = {
  workspaceKind: 'commercial-kitchen',
  displayName: 'CalmKitchen Designer',
  domainSummary:
    'Dimensionally accurate commercial-kitchen planning: 2D plan editing, 3D walkthrough, deterministic service simulation, and layout comparison.',
  coordinateSystem: {
    origin: "Origin (0, 0) is the top-left corner of the room's axis-aligned bounding box.",
    xAxis: '+x runs left to right (west to east) along the room width, in millimetres.',
    yAxis: '+y runs top to bottom (north to south) along the room depth, in millimetres.',
    unit: 'All coordinates and dimensions are canonical millimetres as plain numbers (2450 means 2.45 m). Never send formatted length strings.',
    rotation: 'rotationDeg rotates the component clockwise around its own centre; multiples of 90 are conventional.',
    componentAnchor: 'A component position (xMm, yMm) is the top-left corner of its unrotated bounding box.',
    walls: 'Walls are named as drawn on the plan: top (+y edge), right (+x edge), bottom (-y edge), left (-x edge).',
  },
  supportedDisplayUnits: ['mm', 'cm', 'in', 'ft'],
  referenceImagePolicy:
    'This application does not receive, upload, store, or interpret attached reference images. The external agent interprets the image and sends structured millimetre operations. Optional intent text is retained only as a human-readable action summary; it is not parsed into layout instructions.',
  agentWorkflow: [
    'Choose the smallest set of tools that fits the user’s goal; get_workspace_guide explains coordinates, units, revision rules, and limitations when needed.',
    'Use a filtered get_component_catalog query and the narrowest get_layout view when the task needs catalog IDs or current plan state.',
    'Translate reference material into explicit millimetre operations with stable component IDs, preserving material uncertainty as approximate data or notes.',
    'For reviewable edits, preview_layout_changes validates an ordered batch at the current revision; apply_layout_changes commits the returned single-use token.',
    'For retry-safe trusted clients, apply_layout_changes also accepts a direct current-revision batch and an optional idempotency key.',
    'After a persistent edit, use the relevant read or analysis tools to verify visible state and review the diagnostics returned by apply.',
    'For follow-up edits, re-read state when necessary and prefer a focused delta that preserves unrelated user work.',
    'For operational questions, get_simulation_guide explains scenario inputs; update only the needed scenario fields, then use run_simulation when execution evidence is required.',
    'Treat auto-layout as an opt-in, computationally expensive search. Use it only when the user explicitly requests generated alternatives; prefer focused preview/apply edits and comparison of existing variants.',
  ],
  uncertaintyGuidance:
    'Never invent exact measurements when the reference has no trustworthy scale. Mark uncertain components with approximate: true in update_component, record assumptions in notes, and ask the user when an ambiguity materially affects the layout.',
  limitations: [
    'Comparative planning aid only — not architectural, fire, ventilation, food-safety, accessibility, structural, or regulatory certification.',
    'Simulation outputs are deterministic model assumptions, never observed service data.',
    'Generic layout-edit operations do not replace the whole project; import_project performs explicit validated replacement when requested.',
    'Preview and direct-apply batches carry expectedRevision; preview-token apply verifies the revision encoded by the token. A stale-revision error means the plan changed underneath you—re-read it and recompute the affected delta.',
    'Tool-driven edits apply immediately to the live 2D/3D/simulation views through the shared workspace state; no page reload occurs.',
  ],
}
