import type { EquipmentItem } from '../../domain/project'

/** Forces procedural meshes to be recreated when geometry-affecting data changes. */
export function equipmentSceneKey(item: EquipmentItem): string {
  return [
    item.id,
    item.category,
    item.configurationPreset ?? 'custom',
    item.visualPreset ?? 'generic',
    item.appearanceSkinId ?? 'default',
    item.accessFlow?.inputFace ?? '',
    item.accessFlow?.outputFace ?? '',
    item.widthMm,
    item.depthMm,
    item.heightMm,
    item.baseElevationMm ?? 'auto-elevation',
    item.shelfElevationsMm?.join(',') ?? '',
  ].join(':')
}
