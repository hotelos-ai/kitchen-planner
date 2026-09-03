import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/blank-project'
import { createSeedProject } from '../domain/seed-project'
import { appStateStore } from '../state/app-state-store'
import { projectStore } from '../state/project-store'
import { App } from './App'
import { buildWorkspaceDeepLink } from './workspace-deep-link'

describe('App workspace deep-link restoration', () => {
  beforeEach(() => {
    localStorage.clear()
    appStateStore.getState().reset()
    const project = createSeedProject()
    const secondVariant = structuredClone(project.variants[0])
    secondVariant.id = 'deep-link-layout'
    secondVariant.name = 'Deep-link layout'
    project.variants.push(secondVariant)
    const secondScenario = { ...project.scenarios[0], id: 'deep-link-scenario', name: 'Deep-link scenario' }
    project.scenarios.push(secondScenario)
    const link = buildWorkspaceDeepLink({
      project,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'equipment',
      view: 'scene',
      overlay: null,
    }, window.location.href)
    projectStore.getState().replaceProject(createBlankProject('Unrelated fresh-browser project'))
    window.history.replaceState(null, '', new URL(link).hash)
  })

  afterEach(() => window.history.replaceState(null, '', '/'))

  it('bypasses the start screen and restores the linked document and view without local persistence', async () => {
    render(<App />)

    await waitFor(() => expect(projectStore.getState().project).toMatchObject({
      activeVariantId: 'deep-link-layout',
      activeScenarioId: 'deep-link-scenario',
    }))
    expect(screen.getByRole('button', { name: '2 Fit-out' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: /Design commercial kitchens/i })).not.toBeInTheDocument()
    expect(localStorage.getItem('calmkitchen-designer:session')).toBe('1')
  })
})
