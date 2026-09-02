import { Component, type ErrorInfo, type ReactNode } from 'react'

export type SceneSupportStatus = 'ready' | 'unsupported'

type Props = {
  children: ReactNode
  status: SceneSupportStatus
  onRetry?: () => void
  resetKey?: string | number
}

type State = { error: Error | null }

export class ResilientSceneBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected 3D scene error', error, info)
  }

  componentDidUpdate(previous: Props) {
    const supportChanged = previous.status !== this.props.status
    const resetRequested = previous.resetKey !== this.props.resetKey
    if (this.state.error && (supportChanged || resetRequested)) this.setState({ error: null })
  }

  private retry = () => {
    this.props.onRetry?.()
    this.setState({ error: null })
  }

  render() {
    if (this.props.status === 'unsupported') {
      return (
        <section className="scene-context-message" role="alert">
          <strong>WebGL is not available</strong>
          <p>This browser or device cannot start the 3D renderer. The plan remains available and unchanged.</p>
        </section>
      )
    }

    if (this.state.error) {
      return (
        <section className="scene-context-message" role="alert">
          <strong>Unexpected 3D error</strong>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={this.retry}>Retry 3D view</button>
        </section>
      )
    }

    return this.props.children
  }
}
