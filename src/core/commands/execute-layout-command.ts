import { normalizeRotation, snapMm } from '../../domain/geometry'
import type { ProjectEnvelope, SpatialDocumentAdapter, SpatialItem, SpatialProject } from '../spatial/types'
import { layoutCommandSchema, type LayoutCommand } from './layout-command'

export type CommandErrorCode = 'invalid-command' | 'stale-revision' | 'missing-item' | 'locked-item' | 'missing-variant' | 'last-variant'

export type CommandResult<TProject> =
  | { ok: true; project: TProject; revision: number; changedIds: string[]; warnings: string[]; dryRun: boolean }
  | { ok: false; code: CommandErrorCode; message: string; revision: number; issues?: unknown }

type ExecuteInput<TProject, TItem extends SpatialItem, TScenario> = {
  envelope: ProjectEnvelope<TProject>
  adapter: SpatialDocumentAdapter<TProject, TItem, TScenario>
  command: unknown
  expectedRevision?: number
  dryRun?: boolean
}

const unique = (ids: readonly string[]) => [...new Set(ids)]

const activeVariant = <TItem extends SpatialItem, TScenario>(project: SpatialProject<TItem, TScenario>) =>
  project.variants.find((variant) => variant.id === project.activeVariantId)

export function executeLayoutCommand<TProject, TItem extends SpatialItem, TScenario>(input: ExecuteInput<TProject, TItem, TScenario>): CommandResult<TProject> {
  const parsed = layoutCommandSchema.safeParse(input.command)
  if (!parsed.success) return { ok: false, code: 'invalid-command', message: 'Command payload is invalid.', revision: input.envelope.revision, issues: parsed.error.issues }
  if (input.expectedRevision !== undefined && input.expectedRevision !== input.envelope.revision) {
    return { ok: false, code: 'stale-revision', message: `Expected revision ${input.expectedRevision}, received ${input.envelope.revision}.`, revision: input.envelope.revision }
  }

  const project = structuredClone(input.adapter.read(input.envelope.project))
  const command = parsed.data
  const changedIds: string[] = []
  const fail = (code: CommandErrorCode, message: string): CommandResult<TProject> => ({ ok: false, code, message, revision: input.envelope.revision })
  const variant = activeVariant(project)

  const requireVariant = () => variant ?? null
  const requireItems = (ids: readonly string[]) => {
    const current = requireVariant()
    if (!current) return null
    const uniqueIds = unique(ids)
    return uniqueIds.every((id) => current.items.some((item) => item.id === id)) ? uniqueIds : null
  }

  const mutateItems = (mutation: (item: TItem) => TItem) => {
    if (!variant) return
    variant.items = variant.items.map(mutation)
  }

  const execute = (value: LayoutCommand): CommandResult<TProject> | null => {
    switch (value.type) {
      case 'move-items': {
        const ids = requireItems(value.ids)
        if (!ids || !variant) return fail('missing-item', 'One or more items do not exist in the active layout.')
        const anchor = variant.items.find((item) => item.id === ids[0])!
        const target = { x: snapMm(value.anchor.x, project.snapMm), y: snapMm(value.anchor.y, project.snapMm) }
        const delta = { x: target.x - anchor.xMm, y: target.y - anchor.yMm }
        mutateItems((item) => ids.includes(item.id) && item.movable ? { ...item, xMm: snapMm(item.xMm + delta.x, project.snapMm), yMm: snapMm(item.yMm + delta.y, project.snapMm) } : item)
        changedIds.push(...ids)
        break
      }
      case 'nudge-items':
      case 'rotate-items': {
        const ids = requireItems(value.ids)
        if (!ids) return fail('missing-item', 'One or more items do not exist in the active layout.')
        mutateItems((item) => {
          if (!ids.includes(item.id) || !item.movable) return item
          return value.type === 'nudge-items'
            ? { ...item, xMm: item.xMm + value.delta.x, yMm: item.yMm + value.delta.y }
            : { ...item, rotationDeg: normalizeRotation(item.rotationDeg + value.deltaDeg) }
        })
        changedIds.push(...ids)
        break
      }
      case 'resize-item': {
        const ids = requireItems([value.id])
        if (!ids || !variant) return fail('missing-item', `Item ${value.id} does not exist.`)
        const item = variant.items.find((candidate) => candidate.id === value.id)!
        if (item.dimensionsLocked) return fail('locked-item', `Item ${value.id} has locked dimensions.`)
        mutateItems((candidate) => candidate.id === value.id ? { ...candidate, widthMm: value.widthMm, depthMm: value.depthMm } : candidate)
        changedIds.push(value.id)
        break
      }
      case 'set-dimensions-locked': {
        if (!requireItems([value.id])) return fail('missing-item', `Item ${value.id} does not exist.`)
        mutateItems((item) => item.id === value.id ? { ...item, dimensionsLocked: value.locked } : item)
        changedIds.push(value.id)
        break
      }
      case 'update-item': {
        if (!requireItems([value.id]) || !variant) return fail('missing-item', `Item ${value.id} does not exist.`)
        const current = variant.items.find((item) => item.id === value.id)!
        const validated = input.adapter.validateItem({ ...current, ...value.patch, id: current.id })
        if (!validated.success) return { ok: false, code: 'invalid-command', message: `Item ${value.id} update is invalid.`, revision: input.envelope.revision, issues: validated.issues }
        mutateItems((item) => item.id === value.id ? validated.data : item)
        changedIds.push(value.id)
        break
      }
      case 'add-item': {
        if (!variant) return fail('missing-variant', 'The active layout does not exist.')
        const validated = input.adapter.validateItem(value.item)
        if (!validated.success) return { ok: false, code: 'invalid-command', message: 'The new item is invalid.', revision: input.envelope.revision, issues: validated.issues }
        if (variant.items.some((item) => item.id === validated.data.id)) return fail('invalid-command', `Item ${validated.data.id} already exists.`)
        variant.items.push(validated.data)
        changedIds.push(validated.data.id)
        break
      }
      case 'duplicate-item': {
        if (!requireItems([value.id]) || !variant) return fail('missing-item', `Item ${value.id} does not exist.`)
        if (variant.items.some((item) => item.id === value.duplicateId)) return fail('invalid-command', `Item ${value.duplicateId} already exists.`)
        const source = variant.items.find((item) => item.id === value.id)!
        variant.items.push({ ...structuredClone(source), id: value.duplicateId, label: `${source.label} copy`, xMm: source.xMm + project.snapMm, yMm: source.yMm + project.snapMm })
        changedIds.push(value.duplicateId)
        break
      }
      case 'remove-items': {
        const ids = requireItems(value.ids)
        if (!ids || !variant) return fail('missing-item', 'One or more items do not exist in the active layout.')
        const removable = ids.filter((id) => variant.items.find((item) => item.id === id)?.removable)
        variant.items = variant.items.filter((item) => !removable.includes(item.id))
        changedIds.push(...removable)
        break
      }
      case 'set-display-unit': project.displayUnit = value.unit; break
      case 'set-snap': project.snapMm = value.intervalMm; break
      case 'set-architecture-lock': project.architecture.locked = value.locked; break
      case 'create-variant': {
        if (!variant) return fail('missing-variant', 'The active layout does not exist.')
        if (project.variants.some((candidate) => candidate.id === value.id)) return fail('invalid-command', `Layout ${value.id} already exists.`)
        project.variants.push({ ...structuredClone(variant), id: value.id, name: value.name.trim(), parentId: variant.id, createdAt: value.now, updatedAt: value.now })
        changedIds.push(value.id)
        break
      }
      case 'activate-variant':
        if (!project.variants.some((candidate) => candidate.id === value.id)) return fail('missing-variant', `Layout ${value.id} does not exist.`)
        project.activeVariantId = value.id
        changedIds.push(value.id)
        break
      case 'rename-variant': {
        const target = project.variants.find((candidate) => candidate.id === value.id)
        if (!target) return fail('missing-variant', `Layout ${value.id} does not exist.`)
        target.name = value.name.trim() || target.name
        changedIds.push(value.id)
        break
      }
      case 'remove-variant': {
        if (!project.variants.some((candidate) => candidate.id === value.id)) return fail('missing-variant', `Layout ${value.id} does not exist.`)
        if (project.variants.length === 1) return fail('last-variant', 'The last layout cannot be removed.')
        project.variants = project.variants.filter((candidate) => candidate.id !== value.id)
        if (project.activeVariantId === value.id) project.activeVariantId = project.variants[0].id
        changedIds.push(value.id)
        break
      }
    }
    return null
  }

  const failure = execute(command)
  if (failure) return failure
  const dryRun = Boolean(input.dryRun)
  return {
    ok: true,
    project: dryRun ? input.envelope.project : input.adapter.write(project, input.envelope.project),
    revision: input.envelope.revision + (dryRun ? 0 : 1),
    changedIds,
    warnings: [],
    dryRun,
  }
}
