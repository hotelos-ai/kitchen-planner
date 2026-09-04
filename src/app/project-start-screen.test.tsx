import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectStartScreen } from './ProjectStartScreen'
import { rectangularArchitecture } from '../domain/blank-project'

const { sceneRenderSpy } = vi.hoisted(() => ({ sceneRenderSpy: vi.fn() }))

vi.mock('../features/scene/SceneWorkspace', () => ({
  SceneWorkspace: () => {
    sceneRenderSpy()
    return <div data-testid="landing-scene-renderer" />
  },
}))

function stubPreviewViewport(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const media = {
    get matches() { return matches },
    media: '(min-width: 901px)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener) },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener) },
    addListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener) },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener) },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return {
    setMatches(next: boolean) {
      matches = next
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent))
    },
  }
}

describe('project start screen', () => {
  beforeEach(() => sceneRenderSpy.mockClear())
  afterEach(() => vi.unstubAllGlobals())

  it('describes its commercial kitchen design capabilities in visible landing content', () => {
    stubPreviewViewport(false)
    render(<ProjectStartScreen onCreateRoom={vi.fn()} onDrawManually={vi.fn()} onOpenProject={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /Commercial kitchen planning, from floor plan to service/i })).toBeInTheDocument()
    expect(screen.getByText(/doors, windows, stainless-steel equipment, storage, and waste stations/i)).toBeInTheDocument()
  })

  it('does not initialize the CSS-hidden 3D preview on mobile', () => {
    stubPreviewViewport(false)
    render(<ProjectStartScreen onCreateRoom={vi.fn()} onDrawManually={vi.fn()} onOpenProject={vi.fn()} />)

    expect(screen.queryByLabelText('Example kitchen in 3D')).not.toBeInTheDocument()
    expect(screen.queryByTestId('landing-scene-renderer')).not.toBeInTheDocument()
    expect(sceneRenderSpy).not.toHaveBeenCalled()
  })

  it('renders the preview on desktop and follows breakpoint changes', async () => {
    const viewport = stubPreviewViewport(true)
    render(<ProjectStartScreen onCreateRoom={vi.fn()} onDrawManually={vi.fn()} onOpenProject={vi.fn()} />)

    expect(await screen.findByTestId('landing-scene-renderer')).toBeInTheDocument()
    expect(sceneRenderSpy).toHaveBeenCalled()

    act(() => viewport.setMatches(false))
    expect(screen.queryByLabelText('Example kitchen in 3D')).not.toBeInTheDocument()
    expect(screen.queryByTestId('landing-scene-renderer')).not.toBeInTheDocument()
  })

  it('creates a room from dimensions', async () => {
    const user = userEvent.setup()
    const onCreateRoom = vi.fn()
    render(<ProjectStartScreen onCreateRoom={onCreateRoom} onDrawManually={vi.fn()} onOpenProject={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Design from scratch/i }))
    await user.click(screen.getByRole('button', { name: /Enter room dimensions/i }))
    await user.selectOptions(screen.getByLabelText('Room shape'), 'l')
    await user.click(screen.getByRole('button', { name: 'Create room' }))

    expect(onCreateRoom).toHaveBeenCalledOnce()
    expect(onCreateRoom.mock.calls[0][0].roomPolygon.length).toBe(6)
  })

  it('offers tracing and manual drawing paths', async () => {
    const user = userEvent.setup()
    const onDrawManually = vi.fn()
    render(<ProjectStartScreen onCreateRoom={vi.fn()} onDrawManually={onDrawManually} onOpenProject={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Design from scratch/i }))
    await user.click(screen.getByRole('button', { name: /Trace a floor plan/i }))
    expect(screen.getByLabelText('Upload floor plan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue to drawing' }))
    expect(onDrawManually).toHaveBeenCalledOnce()
  })

  it('uses a rectangular starter when asked', () => {
    expect(rectangularArchitecture(6200, 4800).widthMm).toBe(6200)
  })
})
