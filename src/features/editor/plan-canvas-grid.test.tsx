import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { createProjectStore } from '../../state/project-store'

vi.mock('react-konva', () => ({ Stage: ({ children }: { children: ReactNode }) => <div data-testid="stage">{children}</div> }))
vi.mock('./ArchitectureLayer', () => ({ ArchitectureLayer: ({ architecture }: { architecture: { widthMm: number } }) => <div data-testid="architecture-layer" data-width={architecture.widthMm} /> }))
vi.mock('./GridLayer', () => ({ GridLayer: () => <div data-testid="grid-layer" /> }))
vi.mock('./EquipmentNode', () => ({ EquipmentLayer: () => <div data-testid="equipment-layer" /> }))
vi.mock('./OpeningOverlayLayer', () => ({ OpeningOverlayLayer: () => <div data-testid="opening-layer" /> }))

import { PlanCanvas } from './PlanCanvas'

describe('plan canvas grid', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  }))

  it('draws the grid above the white architectural floor and below equipment', () => {
    render(<PlanCanvas store={createProjectStore(createSeedProject())} showReference={false} />)
    const children = [...screen.getByTestId('stage').children]
    expect(children.indexOf(screen.getByTestId('architecture-layer'))).toBeLessThan(children.indexOf(screen.getByTestId('grid-layer')))
    expect(children.indexOf(screen.getByTestId('grid-layer'))).toBeLessThan(children.indexOf(screen.getByTestId('equipment-layer')))
  })

  it('renders the active variant architecture instead of the compatibility mirror', () => {
    const project = createSeedProject()
    project.variants[0].architecture.widthMm = 4321
    project.architecture.widthMm = 9999
    render(<PlanCanvas store={createProjectStore(project)} showReference={false} />)
    expect(screen.getByTestId('architecture-layer')).toHaveAttribute('data-width', '4321')
  })
})
