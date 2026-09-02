import { applyEquipmentConfiguration } from '../../domain/equipment-configurations'
import { normalizeRotation, snapMm } from '../../domain/geometry'
import type { Architecture, EquipmentItem, KitchenProject, LayoutVariant, PointMm, StationCapability } from '../../domain/project'
import { architectureSchema, projectSchema, scenarioSchema } from '../../domain/project-schema'
import { workspaceOperationSchema, type WorkspaceOperation } from './workspace-operation'

export type WorkspaceOperationErrorCode =
  | 'missing-variant'
  | 'missing-component'
  | 'missing-scenario'
  | 'locked-component'
  | 'locked-architecture'
  | 'duplicate-id'
  | 'last-variant'
  | 'invalid-candidate'
  | 'unsupported-operation'

export type WorkspaceBatchResult =
  | {
    ok: true
    project: KitchenProject
    revision: number
    changedIds: string[]
    warnings: string[]
    normalizedOperations: WorkspaceOperation[]
  }
  | {
    ok: false
    code: 'stale-revision' | 'empty-batch' | 'invalid-operation' | 'batch-operation-failed' | 'invalid-project'
    message: string
    revision: number
    operationIndex?: number
    causeCode?: WorkspaceOperationErrorCode
    issues?: unknown
  }

type CatalogAddOperation = Extract<WorkspaceOperation, { type: 'add_component' }>
type AdoptOperation = Extract<WorkspaceOperation, { type: 'adopt_auto_layout_result' }>

type BatchOptions = {
  project: KitchenProject
  revision: number
  expectedRevision?: number
  operations: readonly unknown[]
  now?: () => string
  resolveCatalogComponent?: (operation: CatalogAddOperation, project: KitchenProject) => EquipmentItem
  resolveAdoptedVariant?: (operation: AdoptOperation, project: KitchenProject) => LayoutVariant
}

type OperationFailure = { code: WorkspaceOperationErrorCode; message: string; issues?: unknown }

const fail = (code: WorkspaceOperationErrorCode, message: string, issues?: unknown): OperationFailure => ({ code, message, issues })
const unique = (values: readonly string[]) => [...new Set(values)]

const variantById = (project: KitchenProject, variantId: string) =>
  project.variants.find((variant) => variant.id === variantId)

const requireComponents = (variant: LayoutVariant, ids: readonly string[]): EquipmentItem[] | undefined => {
  const items = ids.map((id) => variant.equipment.find((item) => item.id === id))
  return items.every(Boolean) ? items as EquipmentItem[] : undefined
}

const operationPoint = (point: { xMm: number; yMm: number }): PointMm => ({ x: point.xMm, y: point.yMm })

const architecturePatch = (patch: Extract<WorkspaceOperation, { type: 'update_architecture' }>['patch']): Partial<Architecture> => ({
  ...patch,
  roomPolygon: patch.roomPolygon?.map(operationPoint),
})

const customItem = (operation: Extract<WorkspaceOperation, { type: 'add_custom_component' }>): EquipmentItem => ({
  id: operation.componentId,
  label: operation.label,
  category: 'custom',
  xMm: operation.position.xMm,
  yMm: operation.position.yMm,
  widthMm: operation.dimensions.widthMm,
  depthMm: operation.dimensions.depthMm,
  heightMm: operation.dimensions.heightMm ?? 850,
  rotationDeg: normalizeRotation(operation.rotationDeg ?? 0),
  dimensionsLocked: false,
  movable: true,
  removable: true,
  capabilities: (operation.capabilities ?? []) as StationCapability[],
  visualPreset: 'generic',
  appearanceSkinId: 'stainless-clean',
})

export function executeWorkspaceBatch(options: BatchOptions): WorkspaceBatchResult {
  if (options.expectedRevision !== undefined && options.expectedRevision !== options.revision) return {
    ok: false,
    code: 'stale-revision',
    message: `Expected revision ${options.expectedRevision}, received ${options.revision}.`,
    revision: options.revision,
  }
  if (options.operations.length === 0) return { ok: false, code: 'empty-batch', message: 'At least one workspace operation is required.', revision: options.revision }

  const normalizedOperations: WorkspaceOperation[] = []
  for (let index = 0; index < options.operations.length; index += 1) {
    const parsed = workspaceOperationSchema.safeParse(options.operations[index])
    if (!parsed.success) return {
      ok: false,
      code: 'invalid-operation',
      message: 'Workspace operation is invalid.',
      revision: options.revision,
      operationIndex: index,
      issues: parsed.error.issues,
    }
    normalizedOperations.push(parsed.data)
  }

  const project = structuredClone(options.project)
  const changedIds: string[] = []
  const now = options.now ?? (() => new Date().toISOString())

  const execute = (operation: WorkspaceOperation): OperationFailure | undefined => {
    if (operation.type === 'create_layout') {
      if (variantById(project, operation.variantId)) return fail('duplicate-id', `Layout ${operation.variantId} already exists.`)
      const parent = variantById(project, operation.parentVariantId ?? project.activeVariantId)
      if (!parent) return fail('missing-variant', 'The source layout does not exist.')
      const timestamp = now()
      project.variants.push({
        ...structuredClone(parent),
        id: operation.variantId,
        name: operation.name,
        parentId: parent.id,
        equipment: operation.equipmentMode === 'duplicate' ? structuredClone(parent.equipment) : [],
        adoptedExperimentManifest: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      changedIds.push(operation.variantId)
      return
    }

    const variant = variantById(project, operation.variantId)
    if (!variant) return fail('missing-variant', `Layout ${operation.variantId} does not exist.`)

    switch (operation.type) {
      case 'activate_layout':
        project.activeVariantId = variant.id
        project.architecture = structuredClone(variant.architecture)
        changedIds.push(variant.id)
        return
      case 'rename_layout':
        variant.name = operation.name
        changedIds.push(variant.id)
        return
      case 'remove_layout': {
        if (project.variants.length === 1) return fail('last-variant', 'The last layout cannot be removed.')
        const index = project.variants.findIndex((candidate) => candidate.id === variant.id)
        project.variants.splice(index, 1)
        if (project.activeVariantId === variant.id) {
          const next = project.variants[Math.min(index, project.variants.length - 1)]
          project.activeVariantId = next.id
          project.architecture = structuredClone(next.architecture)
        }
        changedIds.push(variant.id)
        return
      }
      case 'add_component': {
        if (!options.resolveCatalogComponent) return fail('unsupported-operation', 'Catalog component resolution is not configured.')
        if (variant.equipment.some((item) => item.id === operation.componentId)) return fail('duplicate-id', `Component ${operation.componentId} already exists.`)
        let item: EquipmentItem
        try { item = options.resolveCatalogComponent(operation, project) } catch (error) { return fail('invalid-candidate', error instanceof Error ? error.message : 'Catalog component is invalid.') }
        variant.equipment.push({ ...structuredClone(item), id: operation.componentId })
        changedIds.push(operation.componentId)
        return
      }
      case 'add_custom_component':
        if (variant.equipment.some((item) => item.id === operation.componentId)) return fail('duplicate-id', `Component ${operation.componentId} already exists.`)
        variant.equipment.push(customItem(operation))
        changedIds.push(operation.componentId)
        return
      case 'configure_component': {
        const item = requireComponents(variant, [operation.componentId])?.[0]
        if (!item) return fail('missing-component', `Component ${operation.componentId} does not exist in layout ${variant.id}.`)
        if (variant.layoutConstraints?.lockedComponentIds?.includes(item.id)) return fail('locked-component', `Component ${item.id} is locked.`)
        try {
          const configured = applyEquipmentConfiguration(item, operation.configurationId)
          variant.equipment = variant.equipment.map((candidate) => candidate.id === item.id ? configured : candidate)
        } catch (error) { return fail('invalid-candidate', error instanceof Error ? error.message : 'Configuration is invalid.') }
        changedIds.push(item.id)
        return
      }
      case 'skin_component': {
        const item = requireComponents(variant, [operation.componentId])?.[0]
        if (!item) return fail('missing-component', `Component ${operation.componentId} does not exist in layout ${variant.id}.`)
        variant.equipment = variant.equipment.map((candidate) => candidate.id === item.id ? { ...candidate, appearanceSkinId: operation.skinId } : candidate)
        changedIds.push(item.id)
        return
      }
      case 'update_component': {
        const item = requireComponents(variant, [operation.componentId])?.[0]
        if (!item) return fail('missing-component', `Component ${operation.componentId} does not exist in layout ${variant.id}.`)
        if (variant.layoutConstraints?.lockedComponentIds?.includes(item.id)) return fail('locked-component', `Component ${item.id} is locked.`)
        variant.equipment = variant.equipment.map((candidate) => candidate.id === item.id ? { ...candidate, ...operation.patch, id: candidate.id } : candidate)
        changedIds.push(item.id)
        return
      }
      case 'move_components':
      case 'nudge_components':
      case 'rotate_components': {
        const items = requireComponents(variant, operation.componentIds)
        if (!items) return fail('missing-component', 'One or more components do not exist in the targeted layout.')
        if (items.some((item) => !item.movable || variant.layoutConstraints?.lockedComponentIds?.includes(item.id))) return fail('locked-component', 'One or more targeted components are locked.')
        const ids = operation.componentIds
        const first = items[0]
        const delta = operation.type === 'move_components'
          ? { x: snapMm(operation.anchor.xMm, project.snapMm) - first.xMm, y: snapMm(operation.anchor.yMm, project.snapMm) - first.yMm }
          : operation.type === 'nudge_components' ? operationPoint(operation.delta) : undefined
        variant.equipment = variant.equipment.map((item) => {
          if (!ids.includes(item.id)) return item
          if (operation.type === 'rotate_components') return { ...item, rotationDeg: normalizeRotation(item.rotationDeg + operation.deltaDeg) }
          return { ...item, xMm: snapMm(item.xMm + delta!.x, project.snapMm), yMm: snapMm(item.yMm + delta!.y, project.snapMm) }
        })
        changedIds.push(...ids)
        return
      }
      case 'resize_component': {
        const item = requireComponents(variant, [operation.componentId])?.[0]
        if (!item) return fail('missing-component', `Component ${operation.componentId} does not exist in layout ${variant.id}.`)
        if (item.dimensionsLocked || variant.layoutConstraints?.lockedComponentIds?.includes(item.id)) return fail('locked-component', `Component ${item.id} is locked.`)
        variant.equipment = variant.equipment.map((candidate) => candidate.id === item.id ? {
          ...candidate,
          widthMm: operation.dimensions.widthMm,
          depthMm: operation.dimensions.depthMm,
          heightMm: operation.dimensions.heightMm ?? candidate.heightMm,
        } : candidate)
        changedIds.push(item.id)
        return
      }
      case 'set_component_dimensions_lock': {
        const item = requireComponents(variant, [operation.componentId])?.[0]
        if (!item) return fail('missing-component', `Component ${operation.componentId} does not exist in layout ${variant.id}.`)
        variant.equipment = variant.equipment.map((candidate) => candidate.id === item.id ? { ...candidate, dimensionsLocked: operation.locked } : candidate)
        changedIds.push(item.id)
        return
      }
      case 'duplicate_components': {
        const sourceIds = operation.components.map((entry) => entry.componentId)
        const sources = requireComponents(variant, sourceIds)
        if (!sources) return fail('missing-component', 'One or more source components do not exist in the targeted layout.')
        if (operation.components.some((entry) => variant.equipment.some((item) => item.id === entry.duplicateId))) return fail('duplicate-id', 'One or more duplicate component IDs already exist.')
        const offset = operation.offset ?? { xMm: project.snapMm, yMm: project.snapMm }
        operation.components.forEach((entry, index) => {
          const source = sources[index]
          variant.equipment.push({ ...structuredClone(source), id: entry.duplicateId, label: `${source.label} copy`, xMm: source.xMm + offset.xMm, yMm: source.yMm + offset.yMm })
          changedIds.push(entry.duplicateId)
        })
        return
      }
      case 'lock_components': {
        const items = requireComponents(variant, operation.componentIds)
        if (!items) return fail('missing-component', 'One or more components do not exist in the targeted layout.')
        const locked = new Set(variant.layoutConstraints?.lockedComponentIds ?? [])
        operation.componentIds.forEach((id) => operation.locked ? locked.add(id) : locked.delete(id))
        variant.layoutConstraints = { ...variant.layoutConstraints, lockedComponentIds: [...locked] }
        changedIds.push(...operation.componentIds)
        return
      }
      case 'remove_components': {
        const items = requireComponents(variant, operation.componentIds)
        if (!items) return fail('missing-component', 'One or more components do not exist in the targeted layout.')
        if (items.some((item) => !item.removable || variant.layoutConstraints?.lockedComponentIds?.includes(item.id))) return fail('locked-component', 'One or more targeted components are locked.')
        variant.equipment = variant.equipment.filter((item) => !operation.componentIds.includes(item.id))
        changedIds.push(...operation.componentIds)
        return
      }
      case 'update_architecture': {
        if (variant.architecture.locked && operation.patch.locked !== false) return fail('locked-architecture', 'Architecture must be explicitly unlocked before it can be changed.')
        const parsed = architectureSchema.safeParse({ ...variant.architecture, ...architecturePatch(operation.patch) })
        if (!parsed.success) return fail('invalid-candidate', 'Architecture update is invalid.', parsed.error.issues)
        variant.architecture = parsed.data
        if (project.activeVariantId === variant.id) project.architecture = structuredClone(parsed.data)
        changedIds.push('architecture')
        return
      }
      case 'update_workspace_settings':
        if (operation.patch.displayUnit) project.displayUnit = operation.patch.displayUnit
        if (operation.patch.snapMm) project.snapMm = operation.patch.snapMm
        changedIds.push('workspace-settings')
        return
      case 'update_scenario': {
        const index = project.scenarios.findIndex((scenario) => scenario.id === operation.scenarioId)
        if (index < 0) return fail('missing-scenario', `Scenario ${operation.scenarioId} does not exist.`)
        const parsed = scenarioSchema.safeParse({ ...project.scenarios[index], ...operation.patch, id: operation.scenarioId })
        if (!parsed.success) return fail('invalid-candidate', 'Scenario update is invalid.', parsed.error.issues)
        project.scenarios[index] = parsed.data
        changedIds.push(operation.scenarioId)
        return
      }
      case 'adopt_auto_layout_result': {
        if (!options.resolveAdoptedVariant) return fail('unsupported-operation', 'Auto-layout result resolution is not configured.')
        if (variantById(project, operation.newVariantId)) return fail('duplicate-id', `Layout ${operation.newVariantId} already exists.`)
        let adopted: LayoutVariant
        try { adopted = options.resolveAdoptedVariant(operation, project) } catch (error) { return fail('invalid-candidate', error instanceof Error ? error.message : 'Auto-layout result is invalid.') }
        project.variants.push({ ...structuredClone(adopted), id: operation.newVariantId, name: operation.name, parentId: operation.variantId })
        changedIds.push(operation.newVariantId)
        return
      }
    }
  }

  for (let index = 0; index < normalizedOperations.length; index += 1) {
    const failure = execute(normalizedOperations[index])
    if (failure) return {
      ok: false,
      code: 'batch-operation-failed',
      message: failure.message,
      revision: options.revision,
      operationIndex: index,
      causeCode: failure.code,
      issues: failure.issues,
    }
  }

  const parsed = projectSchema.safeParse(project)
  if (!parsed.success) return { ok: false, code: 'invalid-project', message: 'Workspace batch produced an invalid project.', revision: options.revision, issues: parsed.error.issues }
  return {
    ok: true,
    project: parsed.data,
    revision: options.revision + 1,
    changedIds: unique(changedIds),
    warnings: [],
    normalizedOperations: structuredClone(normalizedOperations),
  }
}
