import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'
import { EquipmentInspector } from './EquipmentInspector'

it('does not duplicate explicit toolbar rotation with an inspector dropdown', () => {
  const store = createProjectStore(createSeedProject())
  store.getState().selectItems(['tandoor'])
  render(<EquipmentInspector store={store} />)
  expect(screen.queryByRole('combobox', { name: 'Rotation' })).not.toBeInTheDocument()
})
