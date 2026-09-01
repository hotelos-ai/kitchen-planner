import {
  isEquipmentConfigurationModified,
  listCompatibleConfigurations,
} from '../../domain/equipment-configurations'
import type { EquipmentItem } from '../../domain/project'
import type { ProjectStore } from '../../state/project-store'

export function EquipmentConfigurationField({ item, store }: {
  item: EquipmentItem
  store: ProjectStore
}) {
  const options = listCompatibleConfigurations(item)
  const modified = isEquipmentConfigurationModified(item)

  return (
    <label className="equipment-configuration-field">
      Configuration
      <select
        aria-label="Equipment configuration"
        value={item.configurationPreset ?? 'custom'}
        onChange={(event) => {
          if (event.target.value !== 'custom') {
            store.getState().applyEquipmentConfiguration(item.id, event.target.value)
          }
        }}
      >
        <option value="custom">Custom / manual</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <small>
        {modified
          ? 'Typical configuration · modified'
          : 'Applies typical size, clearance, capabilities, and 3D skin'}
      </small>
    </label>
  )
}
