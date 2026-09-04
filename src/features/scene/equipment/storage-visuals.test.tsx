import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/drei', () => ({
  RoundedBox: ({ position, args }: { position?: number[]; args?: number[] }) =>
    <span data-testid="shelf-deck" data-size={args?.join(',')} data-position={position?.join(',')} />,
}))

import { getCatalogEntry } from '../../../domain/catalog/kitchen-catalog'
import type { EquipmentItem } from '../../../domain/project'
import { StorageOverheadVisual, StorageOvershelfVisual, StorageWallShelfVisual } from './StorageVisuals'

const itemWithPreset = (catalogId: string, configurationPreset?: string): EquipmentItem => {
  const entry = getCatalogEntry(catalogId)!
  const item: EquipmentItem = {
    id: catalogId, catalogId, label: entry.displayName, category: 'storage',
    widthMm: entry.typicalDimensions.widthMm, depthMm: entry.typicalDimensions.depthMm, heightMm: entry.typicalDimensions.heightMm,
    xMm: 0, yMm: 0, rotationDeg: 0, dimensionsLocked: false, movable: true, removable: true, capabilities: [],
  }
  return configurationPreset ? { ...item, configurationPreset } : item
}

const deckElevations = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-testid="shelf-deck"]')]
  .map((element) => ({ widthM: Number.parseFloat((element.dataset.size ?? '').split(',')[0] ?? ''), yM: Number.parseFloat((element.dataset.position ?? '').split(',')[1] ?? '') }))
  .filter((deck) => deck.widthM >= .5)
  .map((deck) => deck.yM)

describe('storage visual elevation model', () => {
  it('updates a mounted wall shelf from one tier to three tiers', () => {
    const entry = getCatalogEntry('storage-wall-shelf')!
    const oneTier = entry.physicalConfigurations.find((candidate) => candidate.id === 'wall-shelf-one-tier')!
    const threeTier = entry.physicalConfigurations.find((candidate) => candidate.id === 'wall-shelf-three-tier')!
    const { container, rerender } = render(<StorageWallShelfVisual
      item={itemWithPreset('storage-wall-shelf', oneTier.id)}
      widthM={1.2}
      depthM={.35}
      heightM={.3}
    />)

    expect(deckElevations(container)).toHaveLength(1)
    rerender(<StorageWallShelfVisual
      item={itemWithPreset('storage-wall-shelf', threeTier.id)}
      widthM={1.2}
      depthM={.35}
      heightM={.9}
    />)
    expect(deckElevations(container)).toHaveLength(3)
  })

  it('anchors wall shelf decks at the configured preset elevation', () => {
    const entry = getCatalogEntry('storage-wall-shelf')!
    const preset = entry.physicalConfigurations.find((candidate) => candidate.id === 'wall-shelf-three-tier')!
    const { container } = render(<StorageWallShelfVisual
      item={itemWithPreset('storage-wall-shelf', preset.id)}
      widthM={1.2}
      depthM={.35}
      heightM={.3}
    />)

    const decks = deckElevations(container)
    expect(decks).toEqual([(preset.elevationMm ?? 0) / 1000 - .3, (preset.elevationMm ?? 0) / 1000 - .15, (preset.elevationMm ?? 0) / 1000])
    expect(decks[2]).toBeGreaterThanOrEqual(1.5)
  })

  it('resizes the shelf stack with the configured item height', () => {
    const compact = itemWithPreset('storage-wall-shelf', 'wall-shelf-three-tier')
    const tall = { ...compact, heightMm: 600 }
    const { container, rerender } = render(<StorageWallShelfVisual item={compact} widthM={1.2} depthM={.35} heightM={.3} />)

    expect(deckElevations(container)).toEqual([1.2, 1.35, 1.5])
    rerender(<StorageWallShelfVisual item={tall} widthM={1.2} depthM={.35} heightM={.6} />)
    expect(deckElevations(container)).toEqual([.9, 1.2, 1.5])
  })

  it('renders custom shelf elevations in the 3D model', () => {
    const item = { ...itemWithPreset('storage-wall-shelf', 'wall-shelf-three-tier'), shelfElevationsMm: [305, 635, 1015] }
    const { container } = render(<StorageWallShelfVisual item={item} widthM={1.2} depthM={.35} heightM={.3} />)

    expect(deckElevations(container)).toEqual([.305, .635, 1.015])
  })

  it('keeps presetless wall shelves at a reachable working height above their own extent', () => {
    const { container } = render(<StorageWallShelfVisual item={itemWithPreset('storage-wall-shelf')} widthM={1.2} depthM={.35} heightM={.3} />)

    expect(deckElevations(container)[0]).toBe(.45)
  })

  it('mounts overshelf decks above a table at the catalog mounting height', () => {
    const entry = getCatalogEntry('storage-overshelf')!
    const { container } = render(<StorageOvershelfVisual
      item={itemWithPreset('storage-overshelf', entry.configurationIds[0])}
      widthM={1.2}
      depthM={.35}
      heightM={.7}
    />)

    const deck = deckElevations(container)[0]
    expect(deck).toBeGreaterThanOrEqual(1.45)
    expect(deck).toBeLessThanOrEqual(1.6)
  })

  it('hangs overhead storage above walk-under height', () => {
    const entry = getCatalogEntry('storage-overhead-rack')!
    const preset = entry.physicalConfigurations[0]
    const { container } = render(<StorageOverheadVisual item={itemWithPreset('storage-overhead-rack', preset.id)} widthM={1.2} depthM={.4} heightM={.6} />)

    expect(deckElevations(container)[0]).toBeGreaterThanOrEqual(1.9)
  })
})
