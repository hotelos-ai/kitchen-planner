import { useState } from 'react'
import {
  isEquipmentConfigurationModified,
  listCompatibleConfigurations,
} from '../../domain/equipment-configurations'
import type { EquipmentItem } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'

export function EquipmentConfigurationField({ item, store, onApplied }: {
  item: EquipmentItem
  store: ProjectStore
  onApplied?(): void
}) {
  const options = listCompatibleConfigurations(item)
  const modified = isEquipmentConfigurationModified(item)
  const [error, setError] = useState('')

  return (
    <label className="equipment-configuration-field">
      Configuration
      <select
        aria-label="Equipment configuration"
        value={item.configurationPreset ?? 'custom'}
        onChange={(event) => {
          if (event.target.value === 'custom') return
          if (store.getState().applyEquipmentConfiguration(item.id, event.target.value)) {
            setError('')
            onApplied?.()
          } else setError('This configuration could not be applied. Unlock the item and try again.')
        }}
      >
        <option value="custom">Custom / manual</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <small>
        {modified
          ? 'Configuration active · custom size or settings preserved'
          : 'Preserves size · updates clearance, capabilities, and 3D form'}
      </small>
      {error && <small role="alert">{error}</small>}
    </label>
  )
}
