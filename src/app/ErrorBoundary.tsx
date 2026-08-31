import { Component, type ErrorInfo, type ReactNode } from 'react'
import { loadProject } from '../state/persistence'
import { projectStore } from '../state/project-store'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Kitchen workspace error', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return <section className="recovery-panel" role="alert"><span className="eyebrow">Recoverable workspace error</span><h2>The current view could not be displayed.</h2><p>{this.state.error.message}</p><div><button type="button" onClick={() => this.setState({ error: null })}>Try this view again</button><button type="button" onClick={() => { projectStore.getState().replaceProject(loadProject(localStorage)); this.setState({ error: null }) }}>Restore last good project</button></div></section>
  }
}
