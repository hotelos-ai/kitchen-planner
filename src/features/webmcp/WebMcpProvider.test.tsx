import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WebMcpProvider, useWebMcpController } from './WebMcpProvider'

describe('WebMcpProvider', () => {
  it('renders children and settles into unavailable without throwing in jsdom', async () => {
    let seen: ReturnType<typeof useWebMcpController> = null
    const Probe = () => {
      seen = useWebMcpController()
      return <p>child content</p>
    }
    render(
      <WebMcpProvider>
        <Probe />
      </WebMcpProvider>,
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
    expect(seen).not.toBeNull()
    await screen.findByText('child content')
    expect(seen!.getStatus()).toBe('unavailable')
  })

  it('exposes one stable controller instance across renders', () => {
    const instances: unknown[] = []
    const Probe = () => {
      instances.push(useWebMcpController())
      return null
    }
    const { rerender } = render(
      <WebMcpProvider>
        <Probe />
      </WebMcpProvider>,
    )
    rerender(
      <WebMcpProvider>
        <Probe />
      </WebMcpProvider>,
    )
    expect(instances[0]).toBe(instances[1])
    expect(instances[0]).not.toBeNull()
  })
})
