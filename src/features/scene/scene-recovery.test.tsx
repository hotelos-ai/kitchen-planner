import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResilientSceneBoundary } from './ResilientSceneBoundary'

function BrokenScene(): ReactNode {
  throw new Error('renderer exploded')
}

describe('resilient scene boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports unsupported WebGL without attempting to mount the scene', () => {
    const mounted = vi.fn()

    render(
      <ResilientSceneBoundary status="unsupported">
        <button type="button" onClick={mounted}>Rendered scene</button>
      </ResilientSceneBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/WebGL is not available/i)
    expect(screen.getByText(/plan remains available/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rendered scene/i })).not.toBeInTheDocument()
  })

  it('distinguishes an unexpected child exception and retries with a reset boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onRetry = vi.fn()

    function Host() {
      const [working, setWorking] = useState(false)
      return (
        <ResilientSceneBoundary status="ready" onRetry={() => { onRetry(); setWorking(true) }}>
          {working ? <p>Recovered scene</p> : <BrokenScene />}
        </ResilientSceneBoundary>
      )
    }

    render(<Host />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/unexpected 3D error/i)
    expect(alert).toHaveTextContent(/renderer exploded/i)

    await userEvent.click(screen.getByRole('button', { name: /Retry 3D view/i }))

    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.getByText('Recovered scene')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders children normally for a ready scene', () => {
    render(<ResilientSceneBoundary status="ready"><p>Kitchen overview</p></ResilientSceneBoundary>)
    expect(screen.getByText('Kitchen overview')).toBeInTheDocument()
  })
})
