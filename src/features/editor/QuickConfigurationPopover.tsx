import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { APPEARANCE_SKINS } from '../../domain/catalog/appearance-skins'
import { getCatalogEntry } from '../../domain/catalog/kitchen-catalog'
import type { EquipmentItem } from '../../domain/project'
import { getActiveVariant, type ProjectStore } from '../../state/project-store'
import { EquipmentConfigurationField } from './EquipmentConfigurationField'
import type { OverlayPosition } from './ComponentContextMenu'

export type QuickConfigurationMode = 'configure' | 'skin'

export function QuickConfigurationPopover({ item, store, mode, position, onClose, onSkinChange }: {
  item: EquipmentItem
  store: ProjectStore
  mode: QuickConfigurationMode
  position: OverlayPosition
  onClose(): void
  onSkinChange?(itemId: string, skinId: string): void
}) {
  const liveItem = useStore(store, (state) => getActiveVariant(state).equipment.find((candidate) => candidate.id === item.id)) ?? item
  const entry = liveItem.catalogId ? getCatalogEntry(liveItem.catalogId) : undefined
  const compatibleSkins = APPEARANCE_SKINS.filter((skin) => !entry || entry.appearanceSkinIds.includes(skin.skinId))
  const [skinId, setSkinId] = useState(() => compatibleSkins.some((skin) => skin.skinId === liveItem.appearanceSkinId)
    ? liveItem.appearanceSkinId!
    : compatibleSkins[0]?.skinId ?? '')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const configuring = mode === 'configure'
  const label = configuring ? `Quick configure ${liveItem.label}` : `Choose skin for ${liveItem.label}`
  return <section
    role="dialog"
    aria-label={label}
    className="quick-configuration-popover"
    style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 21 }}
    onMouseDown={(event) => event.stopPropagation()}
  >
    <div>
      <strong>{label}</strong>
      <button type="button" aria-label="Close quick configuration" onClick={onClose}>×</button>
    </div>
    {configuring ? <EquipmentConfigurationField item={liveItem} store={store} onApplied={onClose} /> : <>
      <label>Appearance skin<select aria-label="Appearance skin" value={skinId} onChange={(event) => setSkinId(event.target.value)}>
        {compatibleSkins.map((skin) => <option key={skin.skinId} value={skin.skinId}>{skin.displayName}</option>)}
      </select></label>
      <button type="button" disabled={!skinId.trim()} onClick={() => {
        onSkinChange?.(liveItem.id, skinId.trim())
        onClose()
      }}>Apply skin</button>
    </>}
  </section>
}
