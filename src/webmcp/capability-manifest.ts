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
    'This application never receives, uploads, stores, or interprets reference images or natural-language instructions. The external agent interprets any attached image and translates it into explicit millimetre coordinates, dimensions, rotations, and component identifiers.',
  agentWorkflow: [
    'Call get_workspace_guide to learn the coordinate system, units, revision rules, and limitations.',
    'Call get_component_catalog and get_layout to understand available component types and the current plan.',
    'Translate your interpretation of the user material into explicit millimetre operations with stable component IDs.',
    'Call preview_layout_changes with the current revision and a complete, ordered operation batch.',
    'If preview succeeds, call apply_layout_changes with the returned single-use preview token.',
    'Verify with analyze_layout and get_layout; read the diagnostics delta returned by apply.',
    'For follow-up edits, re-read the current revision and preview only the requested delta — never rebuild the whole project.',
    'For operational questions, read get_simulation_guide, edit scenario parameters through preview_layout_changes (update_scenario operations), then run_simulation.',
  ],
  uncertaintyGuidance:
    'Never invent exact measurements when the reference has no trustworthy scale. Mark uncertain components with approximate: true in update_component, record assumptions in notes, and ask the user when an ambiguity materially affects the layout.',
  limitations: [
    'Comparative planning aid only — not architectural, fire, ventilation, food-safety, accessibility, structural, or regulatory certification.',
    'Simulation outputs are deterministic model assumptions, never observed service data.',
    'Every mutation goes through preview_layout_changes then apply_layout_changes; there is no direct write or whole-project overwrite tool.',
    'Writes carry an expectedRevision; a stale-revision error means the plan changed underneath you — re-read it and recompute your delta.',
    'Tool-driven edits apply immediately to the live 2D/3D/simulation views through the shared workspace state; no page reload occurs.',
  ],
}
