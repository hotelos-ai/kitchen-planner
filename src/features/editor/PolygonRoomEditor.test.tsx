import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Architecture } from '../../domain/project'
import { PolygonRoomEditor } from './PolygonRoomEditor'

const room = (): Architecture => ({
  widthMm: 6000,
  depthMm: 4000,
  wallHeightMm: 2800,
  roomPolygon: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }],
  openings: [],
  pillars: [],
  storageZones: [],
  locked: false,
})

describe('advanced polygon room editor', () => {
  it('updates vertices immutably and protects the three-vertex minimum', async () => {
    const user = userEvent.setup()
    let value = room()
    const onChange = vi.fn((next: Architecture) => { value = next; rerender(<PolygonRoomEditor value={value} onChange={onChange} />) })
    const { rerender } = render(<PolygonRoomEditor value={value} onChange={onChange} />)

    await user.clear(screen.getByRole('spinbutton', { name: 'Vertex 2 X (mm)' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Vertex 2 X (mm)' }), '5500')
    expect(value.roomPolygon[1]).toEqual({ x: 5500, y: 0 })

    await user.click(screen.getByRole('button', { name: 'Remove vertex 4' }))
    expect(value.roomPolygon).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /Remove vertex/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /Remove vertex/ })[0]).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Add wall vertex' }))
    expect(value.roomPolygon).toHaveLength(4)
  })

  it('adds doors, regular windows, service windows, pillars, and storage zones as first-class geometry', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'geometry-id' })
    const user = userEvent.setup()
    let value = room()
    const onChange = vi.fn((next: Architecture) => { value = next; rerender(<PolygonRoomEditor value={value} onChange={onChange} />) })
    const { rerender } = render(<PolygonRoomEditor value={value} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Add door opening' }))
    expect(value.openings[0]).toMatchObject({ kind: 'door', wall: 'top', widthMm: 900 })
    await user.click(screen.getByRole('button', { name: 'Add regular window' }))
    expect(value.openings[1]).toMatchObject({ kind: 'window', flow: 'closed', sillHeightMm: 1000, heightMm: 1200 })
    await user.click(screen.getByRole('button', { name: 'Add service window' }))
    expect(value.openings[2]).toMatchObject({ kind: 'service-window', flow: 'clean-out' })
    await user.click(screen.getByRole('button', { name: 'Add pillar' }))
    expect(value.pillars[0]).toMatchObject({ widthMm: 400, depthMm: 400 })
    await user.click(screen.getByRole('button', { name: 'Add storage zone' }))
    expect(value.storageZones[0]).toMatchObject({ label: 'Storage zone', adjacent: true })

    await user.selectOptions(screen.getByLabelText('Opening 3 flow'), 'dirty-in')
    await user.selectOptions(screen.getByLabelText('Opening 3 wall segment'), '2')
    await user.clear(screen.getByLabelText('Pillar 1 width (mm)'))
    await user.type(screen.getByLabelText('Pillar 1 width (mm)'), '650')
    expect(value.openings[2].flow).toBe('dirty-in')
    expect((value.openings[2] as typeof value.openings[number] & { segmentIndex?: number }).segmentIndex).toBe(1)
    expect(value.pillars[0].widthMm).toBe(650)
  })
})
