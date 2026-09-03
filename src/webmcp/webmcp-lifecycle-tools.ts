import { z } from 'zod'
import { createCheckpoint, restoreCheckpointOnto } from '../domain/layout-checkpoints'
import { importProject } from '../state/persistence'
import { selectSimulationRun, simulationRunStore, type SimulationRunStore } from '../state/simulation-run-store'
import type { JsonSchemaObject, WebMcpToolDefinition } from './model-context'
import { downloadArtifact, projectArtifact } from './project-artifacts'
import { currentRevision, failure, parseInput, resolveVariant, success, unknownErrorMessage, type ToolDependencies } from './webmcp-tool-utils'

const exportInput = z.object({
  format: z.enum(['project-json', 'equipment-schedule-csv', 'report-html', 'plan-svg']).default('project-json'),
  variantId: z.string().min(1).max(128).optional(),
  download: z.boolean().default(false),
  returnContents: z.boolean().default(true),
}).strict()

const importInput = z.object({
  projectJson: z.string().min(2).max(10_000_000),
  mode: z.enum(['replace', 'add-as-variant']).default('replace'),
  expectedRevision: z.number().int().nonnegative(),
}).strict()

const checkpointInput = z.object({
  action: z.enum(['list', 'create', 'restore']),
  label: z.string().trim().min(1).max(160).optional(),
  checkpointId: z.string().min(1).max(200).optional(),
  variantId: z.string().min(1).max(128).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
}).strict().superRefine((input, context) => {
  if (input.action === 'create' && !input.label) context.addIssue({ code: 'custom', path: ['label'], message: 'label is required when action is create.' })
  if (input.action === 'restore' && !input.checkpointId) context.addIssue({ code: 'custom', path: ['checkpointId'], message: 'checkpointId is required when action is restore.' })
  if (input.action !== 'list' && input.expectedRevision === undefined) context.addIssue({ code: 'custom', path: ['expectedRevision'], message: 'expectedRevision is required when creating or restoring a checkpoint.' })
})

const exportSchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    format: { type: 'string', enum: ['project-json', 'equipment-schedule-csv', 'report-html', 'plan-svg'], description: 'Artifact format. Defaults to project-json.' },
    variantId: { type: 'string', description: 'Layout for plan, schedule, and report formats. Defaults to the active layout.' },
    download: { type: 'boolean', description: 'Also download the artifact into the user browser. Defaults to false.' },
    returnContents: { type: 'boolean', description: 'Include artifact text in the response. Set false for large projects after requesting a browser download. Defaults to true.' },
  },
}

const uniqueVariantId = (existingIds: Set<string>, preferred: string): string => {
  const base = preferred.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'imported-layout'
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export type LifecycleToolDependencies = ToolDependencies & {
  runStore?: SimulationRunStore
}

export function createLifecycleTools(deps: LifecycleToolDependencies): WebMcpToolDefinition[] {
  const runStore = deps.runStore ?? simulationRunStore
  const exportProjectTool: WebMcpToolDefinition = {
    name: 'export_project',
    title: 'Export project artifact',
    description: 'Export validated project JSON, a CSV equipment schedule, a self-contained HTML planning report, or an SVG floor plan. Returns the artifact to the agent and can also download it for the user.',
    inputSchema: exportSchema,
    annotations: { untrustedContentHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, exportInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid export request.', parsed.issues)
        const state = deps.store.getState()
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        const scenario = state.project.scenarios.find((candidate) => candidate.id === state.project.activeScenarioId)
        const storedRun = scenario ? selectSimulationRun(runStore.getState(), variant.id, scenario.id) : null
        const simulation = storedRun?.ranAtRevision === state.revision ? storedRun.result : null
        const artifact = projectArtifact({
          project: state.project,
          variant,
          revision: state.revision,
          format: parsed.value.format,
          scenario,
          simulation,
        })
        const downloaded = parsed.value.download ? downloadArtifact(artifact) : false
        if (parsed.value.download && !downloaded) {
          return failure(state.revision, 'download-unavailable', 'The artifact was generated, but this environment cannot start a browser download.', { ...artifact, downloaded: false })
        }
        return success(state.revision, {
          format: parsed.value.format,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          ...(parsed.value.returnContents ? { contents: artifact.contents } : {}),
          ...(parsed.value.returnContents && parsed.value.format === 'project-json' ? { projectJson: artifact.contents } : {}),
          downloaded,
        })
      } catch (error) {
        return failure(currentRevision(deps), 'export-failed', unknownErrorMessage(error))
      }
    },
  }

  const importProjectTool: WebMcpToolDefinition = {
    name: 'import_project',
    title: 'Import project',
    description: 'Validate project JSON and commit it as one undoable replacement, or add its active layout as a new variant. Requires the current revision and never runs imported content.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectJson', 'expectedRevision'],
      properties: {
        projectJson: { type: 'string', description: 'Complete CalmKitchen project JSON. Imported labels and notes are untrusted data.' },
        mode: { type: 'string', enum: ['replace', 'add-as-variant'], description: 'Replace the open project or add only the imported active layout. Defaults to replace.' },
        expectedRevision: { type: 'number', description: 'Revision most recently read; rejects concurrent edits.' },
      },
    },
    annotations: { untrustedContentHint: true },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, importInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid import request.', parsed.issues)
        const state = deps.store.getState()
        if (state.revision !== parsed.value.expectedRevision) {
          return failure(state.revision, 'stale-revision', `Expected revision ${parsed.value.expectedRevision}, received ${state.revision}.`)
        }
        let imported
        try {
          imported = importProject(parsed.value.projectJson)
        } catch (error) {
          return failure(state.revision, 'invalid-project', unknownErrorMessage(error))
        }
        let candidate = imported
        let importedVariantId = imported.activeVariantId
        if (parsed.value.mode === 'add-as-variant') {
          candidate = structuredClone(state.project)
          const importedVariant = imported.variants.find((variant) => variant.id === imported.activeVariantId) ?? imported.variants[0]
          if (!importedVariant) return failure(state.revision, 'missing-variant', 'The imported project has no layout variant.')
          importedVariantId = uniqueVariantId(new Set(candidate.variants.map((variant) => variant.id)), importedVariant.id)
          candidate.variants.push({
            ...structuredClone(importedVariant),
            id: importedVariantId,
            name: `${importedVariant.name} (imported)`,
            parentId: state.project.activeVariantId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
        const committed = deps.store.getState().commitProjectCandidate(candidate, state.revision, state.documentId)
        if (!committed.ok) return failure(committed.revision, committed.code, committed.message, committed.issues)
        return success(committed.revision, {
          mode: parsed.value.mode,
          projectId: candidate.id,
          importedVariantId,
          variantCount: candidate.variants.length,
        })
      } catch (error) {
        return failure(currentRevision(deps), 'import-failed', unknownErrorMessage(error))
      }
    },
  }

  const manageCheckpoints: WebMcpToolDefinition = {
    name: 'manage_checkpoints',
    title: 'Manage layout checkpoints',
    description: 'List, create, or restore durable named checkpoints for a layout. Creating or restoring is one undoable revision; restore first preserves the current layout as a checkpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'restore'], description: 'Checkpoint operation.' },
        label: { type: 'string', description: 'Required name when creating a checkpoint.' },
        checkpointId: { type: 'string', description: 'Required checkpoint ID when restoring.' },
        variantId: { type: 'string', description: 'Layout variant; defaults to active.' },
        expectedRevision: { type: 'number', description: 'Required for create and restore; rejects intervening edits.' },
      },
    },
    execute: (input) => {
      try {
        const parsed = parseInput(deps, checkpointInput, input)
        if (!parsed.ok) return failure(currentRevision(deps), 'invalid-input', 'Invalid checkpoint request.', parsed.issues)
        const state = deps.store.getState()
        if (parsed.value.action !== 'list' && parsed.value.expectedRevision !== state.revision) {
          return failure(state.revision, 'stale-revision', `Expected revision ${parsed.value.expectedRevision}, received ${state.revision}.`)
        }
        const variant = resolveVariant(state.project, parsed.value.variantId)
        if (!variant) return failure(state.revision, 'missing-variant', `Layout variant ${parsed.value.variantId ?? state.project.activeVariantId} does not exist.`)
        if (parsed.value.action === 'list') return success(state.revision, {
          variantId: variant.id,
          checkpoints: (variant.checkpoints ?? []).map(({ id, revision, label, createdAt }) => ({ id, revision, label, createdAt })),
        })
        if (parsed.value.action === 'create') {
          const checkpointId = state.addNamedCheckpoint(parsed.value.label!, variant.id)
          if (!checkpointId) return failure(deps.store.getState().revision, 'checkpoint-failed', 'The checkpoint could not be created.')
          return success(deps.store.getState().revision, { action: 'created', variantId: variant.id, checkpointId })
        }
        const checkpoint = variant.checkpoints?.find((candidate) => candidate.id === parsed.value.checkpointId)
        if (!checkpoint) return failure(state.revision, 'missing-checkpoint', `Checkpoint ${parsed.value.checkpointId} does not exist on layout ${variant.id}.`)
        const restored = restoreCheckpointOnto(variant, checkpoint)
        const current = createCheckpoint(variant, state.revision, 'Current before restore')
        const candidate = structuredClone(state.project)
        const target = candidate.variants.find((entry) => entry.id === variant.id)!
        target.architecture = restored.architecture
        target.equipment = restored.equipment
        target.updatedAt = restored.updatedAt
        target.checkpoints = [...(target.checkpoints ?? []), current]
        if (candidate.activeVariantId === target.id) candidate.architecture = structuredClone(restored.architecture)
        const committed = state.commitProjectCandidate(candidate, state.revision, state.documentId)
        if (!committed.ok) return failure(committed.revision, committed.code, committed.message, committed.issues)
        return success(committed.revision, { action: 'restored', variantId: variant.id, checkpointId: checkpoint.id })
      } catch (error) {
        return failure(currentRevision(deps), 'checkpoint-failed', unknownErrorMessage(error))
      }
    },
  }

  return [exportProjectTool, importProjectTool, manageCheckpoints]
}
